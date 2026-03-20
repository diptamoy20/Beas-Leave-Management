const ZKAttendanceClient = require('zk-attendance-sdk');
const db = require('../config/db');

const DEVICE_PORT = Number(process.env.ATTENDANCE_DEVICE_PORT || 4370);
const DEVICE_TIMEOUT_MS = Number(process.env.ATTENDANCE_DEVICE_TIMEOUT_MS || 5000);
const DEVICE_INPORT = Number(process.env.ATTENDANCE_DEVICE_INPORT || 5200);

const DEVICE_IP_IN = process.env.ATTENDANCE_DEVICE_IN_IP || '192.168.1.91';
const DEVICE_IP_OUT = process.env.ATTENDANCE_DEVICE_OUT_IP || '192.168.1.92';

// Keep it fairly small to reduce device load, but large enough to cover downtime.
const SYNC_INTERVAL_MS = Number(process.env.ATTENDANCE_SYNC_INTERVAL_MS || 5 * 60 * 10000);
const LOOKBACK_DAYS = Number(process.env.ATTENDANCE_LOOKBACK_DAYS || 10);

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toMySqlDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMySqlDateTime(date) {
  return `${toMySqlDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function parseDeviceTimestamp(raw) {
  if (!raw) return null;

  // Some SDKs may provide already-parsed Date
  if (raw instanceof Date) return raw;

  // Numbers sometimes arrive as seconds or milliseconds
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw; // heuristic
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  // Strings: try to parse, then validate
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  return null;
}

function extractEmployeeDeviceId(record) {
  // Heuristic mapping across SDK versions
  return (
    record.userId ??
    record.user_id ??
    record.userid ??
    record.uid ??
    record.empId ??
    record.employeeId ??
    record.deviceUserId ??
    record.userSn ??
    record.employee_id ??
    null
  );
}

function extractTimestamp(record) {
  // Try common single-field timestamp formats first
  const direct =
    parseDeviceTimestamp(record.attTime) ??
    parseDeviceTimestamp(record.attendanceTime) ??
    parseDeviceTimestamp(record.timestamp) ??
    parseDeviceTimestamp(record.time) ??
    parseDeviceTimestamp(record.att_time) ??
    parseDeviceTimestamp(record.datetime) ??
    parseDeviceTimestamp(record.attDateTime) ??
    parseDeviceTimestamp(record.dateTime) ??
    parseDeviceTimestamp(record.recordTime);

  if (direct) return direct;

  // Some payloads separate date & time into two fields
  const datePart = record.attDate ?? record.date ?? record.att_date ?? null;
  const timePart = record.attTimeOnly ?? record.attTimeStr ?? record.timePart ?? record.att_time_only ?? record.punchTime ?? record.att_time_str ?? null;
  if (datePart && timePart) {
    return parseDeviceTimestamp(`${datePart} ${timePart}`);
  }

  return null;
}

async function fetchAttendancesFromDevice(ip) {
  const client = new ZKAttendanceClient(ip, DEVICE_PORT, DEVICE_TIMEOUT_MS, DEVICE_INPORT);
  await client.createSocket();
  const logs = await client.getAttendances();
  await client.disconnect();
  // Expected shape: { data: [...] }
  return logs?.data || [];
}

async function upsertAttendanceMerged({ employeeId, dateStr, clockInDate, clockOutDate }) {
  const [rows] = await db.query(
    'SELECT id, clock_in, clock_out, total_time FROM attendance WHERE employee_id = ? AND date = ? ORDER BY id ASC',
    [employeeId, dateStr]
  );

  // Merge if duplicates exist
  const allClockIns = [];
  const allClockOuts = [];
  for (const r of rows) {
    if (r.clock_in) allClockIns.push(new Date(r.clock_in));
    if (r.clock_out) allClockOuts.push(new Date(r.clock_out));
  }
  if (clockInDate) allClockIns.push(clockInDate);
  if (clockOutDate) allClockOuts.push(clockOutDate);

  const mergedClockIn = allClockIns.length ? new Date(Math.min(...allClockIns.map((d) => d.getTime()))) : null;
  const mergedClockOut = allClockOuts.length ? new Date(Math.max(...allClockOuts.map((d) => d.getTime()))) : null;

  const totalTimeMinutes =
    mergedClockIn && mergedClockOut
      ? Math.max(0, Math.round((mergedClockOut.getTime() - mergedClockIn.getTime()) / 60000))
      : null;

  if (!rows.length) {
    await db.query(
      'INSERT INTO attendance (employee_id, date, clock_in, clock_out, total_time) VALUES (?, ?, ?, ?, ?)',
      [
        employeeId,
        dateStr,
        mergedClockIn ? toMySqlDateTime(mergedClockIn) : null,
        mergedClockOut ? toMySqlDateTime(mergedClockOut) : null,
        totalTimeMinutes,
      ]
    );
    return;
  }

  // Keep earliest row id, delete the rest (duplicate handling)
  const keepId = rows[0].id;
  if (rows.length > 1) {
    const idsToDelete = rows.slice(1).map((r) => r.id);
    await db.query(`DELETE FROM attendance WHERE id IN (${idsToDelete.join(',')})`, []);
  }

  await db.query(
    `
      UPDATE attendance
      SET
        clock_in = ?,
        clock_out = ?,
        total_time = ?
      WHERE id = ?
    `,
    [
      mergedClockIn ? toMySqlDateTime(mergedClockIn) : null,
      mergedClockOut ? toMySqlDateTime(mergedClockOut) : null,
      totalTimeMinutes,
      keepId,
    ]
  );
}

async function syncFromDevices() {
  // Map device `employee_id` (string) -> employees.employee_id (INT)
  const [employees] = await db.query('SELECT employee_id FROM employees');
  const employeeIdToDeviceId = new Map(employees.map((e) => [String(e.employee_id), e.employee_id]));

  const lookbackFrom = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const allDeviceIps = [DEVICE_IP_IN, DEVICE_IP_OUT];
  const groups = new Map(); // key: `${employeeDbId}|${dateStr}` => { clockInDate, clockOutDate }

  for (const ip of allDeviceIps) {
    let deviceLogs = [];
    try {
      deviceLogs = await fetchAttendancesFromDevice(ip);
      console.log(`[DEVICE SYNC] Device ${ip}: fetched ${deviceLogs.length} records`);
    } catch (err) {
      console.error(`Attendance sync: failed to fetch logs from device ${ip}`, err?.message || err);
      continue;
    }

    for (const record of deviceLogs) {
      const deviceEmployeeId = extractEmployeeDeviceId(record);
      const ts = extractTimestamp(record);

      console.log(`[DEVICE RECORD] Raw:`, JSON.stringify(record));
      console.log(`[DEVICE RECORD] Extracted ID: ${deviceEmployeeId}, Timestamp: ${ts ? ts.toISOString() : 'null'}`);

      if (deviceEmployeeId == null || !ts) {
        console.log(`[DEVICE RECORD] ❌ SKIPPED: Missing ID or timestamp`);
        continue;
      }
      if (ts < lookbackFrom) {
        console.log(`[DEVICE RECORD] ❌ SKIPPED: Too old (before ${lookbackFrom.toISOString()})`);
        continue;
      }

      const employeeId = employeeIdToDeviceId.get(String(deviceEmployeeId));
      if (!employeeId) {
        console.log(`[DEVICE RECORD] ❌ SKIPPED: Device ID ${deviceEmployeeId} not found in employees table. Available IDs:`, Array.from(employeeIdToDeviceId.keys()));
        continue;
      }
      console.log(`[DEVICE RECORD] ✅ MAPPED: Device ID ${deviceEmployeeId} -> Employee ID ${employeeId}`);

      const dateStr = toMySqlDate(ts);
      const key = `${employeeId}|${dateStr}`;

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { employeeId, dateStr, clockInDate: ts, clockOutDate: ts });
      } else {
        if (ts < existing.clockInDate) existing.clockInDate = ts;
        if (ts > existing.clockOutDate) existing.clockOutDate = ts;
      }
    }
  }

  // Upsert merged values into DB
  for (const entry of groups.values()) {
    await upsertAttendanceMerged(entry);
  }

  // Clean up old attendance records (keep only last 10 days)
  await db.query('DELETE FROM attendance WHERE date < DATE_SUB(CURDATE(), INTERVAL 10 DAY)');
}

function startAttendanceDeviceSync() {
  if (global.__attendanceDeviceSyncRunning) return;

  const runOnce = async () => {
    if (global.__attendanceDeviceSyncRunning) return;
    global.__attendanceDeviceSyncRunning = true;
    try {
      console.log('Attendance device sync: starting');
      await syncFromDevices();
      console.log('Attendance device sync: completed');
    } catch (err) {
      console.error('Attendance device sync: failed', err?.message || err);
    } finally {
      global.__attendanceDeviceSyncRunning = false;
    }
  };

  // Initial sync on startup
  runOnce();

  // Periodic sync (interval-based cron)
  setInterval(runOnce, SYNC_INTERVAL_MS);
}

module.exports = startAttendanceDeviceSync;

