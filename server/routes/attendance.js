const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');
const startAttendanceDeviceSync = require('../services/attendanceDeviceSync');

const router = express.Router();

function formatDateLocal(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateOnlyString(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function toLocalDateString(date) {
  if (!date) return null;

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  const dateStr = toDateOnlyString(value);
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getAttendanceDateKey(attendanceRow) {
  if (attendanceRow?.clock_in) return formatDateLocal(attendanceRow.clock_in);
  if (attendanceRow?.clock_out) return formatDateLocal(attendanceRow.clock_out);
  return formatDateLocal(attendanceRow?.derived_date || attendanceRow?.date);
}

// Start device -> DB sync once (cron/interval).
// This is attendance-only; it runs in the background and keeps the `attendance` table updated.
// if (!global.__attendanceDeviceSyncStarted) {
//   global.__attendanceDeviceSyncStarted = true;
//   startAttendanceDeviceSync();
// }

router.post('/clock-in', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ success: "false", message: 'Employee not found' });
    const employeeId = empData[0].employee_id;

    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: "false", message: 'Already clocked in today' });
    }

    const clockInTime = new Date().toISOString();
    await db.run(
      'INSERT INTO attendance (employee_id, date, clock_in, total_time) VALUES (?, ?, ?, NULL)',
      [employeeId, today, clockInTime]
    );

    res.json({ success: "true", message: 'Clocked in successfully', data: { clock_in: clockInTime } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.post('/clock-out', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ success: "false", message: 'Employee not found' });
    const employeeId = empData[0].employee_id;

    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length === 0) {
      return res.status(400).json({ success: "false", message: 'No clock-in record found for today' });
    }

    if (existing[0].clock_out) {
      return res.status(400).json({ success: "false", message: 'Already clocked out today' });
    }

    const clockOutTime = new Date().toISOString();
    await db.run(
      `
      UPDATE attendance
      SET
        clock_out = ?,
        total_time = TIMESTAMPDIFF(MINUTE, clock_in, ?)
      WHERE employee_id = ? AND date = ?
      `,
      [clockOutTime, clockOutTime, employeeId, today]
    );

    res.json({ success: "true", message: 'Clocked out successfully', data: { clock_out: clockOutTime } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/my-attendance', auth, async (req, res) => {
  try {
    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ success: "false", message: 'Employee not found' });
    const employeeId = empData[0].employee_id;
    const { from, to } = req.query;

    // If a date range is provided, return flattened day-wise rows for that range (server-side expansion)
    if (from || to) {
      const start = from ? parseDateOnly(from) : null;
      const end = to ? parseDateOnly(to) : null;
      // default to last 30 days if missing
      const endDate = end || new Date();
      const startDate = start || new Date(new Date().setDate(endDate.getDate() - 29));

      // fetch attendance rows in range
      const [attRows] = await db.query(
        `SELECT a.*, e.name as employee_name,
                COALESCE(DATE(a.clock_in), DATE(a.clock_out), a.date) AS derived_date
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE a.employee_id = ? AND COALESCE(DATE(a.clock_in), DATE(a.clock_out), a.date) BETWEEN ? AND ?`,
        [employeeId, toDateOnlyString(startDate), toDateOnlyString(endDate)]
      );

      // fetch approved leaves for this employee overlapping range
      const [empRows] = await db.query('SELECT id, name FROM employees WHERE employee_id = ?', [employeeId]);
      const empDbId = empRows.length ? empRows[0].id : null;
      let leaveRows = [];
      if (empDbId) {
        const [lr] = await db.query(
          `SELECT lr.* FROM leave_requests lr WHERE lr.employee_id = ? AND lr.status = 'Approved' AND NOT (lr.end_date < ? OR lr.start_date > ?) ORDER BY lr.start_date ASC`,
          [empDbId, toDateOnlyString(startDate), toDateOnlyString(endDate)]
        );
        leaveRows = lr || [];
      }

      // fetch holidays in range
      const [holidayRows] = await db.query('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC', [toDateOnlyString(startDate), toDateOnlyString(endDate)]);

      // build maps
      const attMap = new Map();
      (attRows || []).forEach((a) => {
        attMap.set(getAttendanceDateKey(a), a);
      });

      const leaveDays = [];
      (leaveRows || []).forEach((l) => {
        const s = parseDateOnly(l.start_date);
        const e = parseDateOnly(l.end_date);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const key = toDateOnlyString(d);
          leaveDays.push({ date: key, ...l });
        }
      });
      const leaveMap = new Map();
      leaveDays.forEach((d) => leaveMap.set(String(d.date), d));

      const holidayMap = new Map();
      (holidayRows || []).forEach((h) => holidayMap.set(toDateOnlyString(h.date), h));

      const rows = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = toDateOnlyString(d);
        const att = attMap.get(key) || null;
        const lv = leaveMap.get(key) || null;
        const hl = holidayMap.get(key) || null;

        const row = {
          date: att ? toDateOnlyString(att.date) : key,
          employee_id: employeeId,
          employee_name: empRows.length ? empRows[0].name : '',
          clock_in: att ? att.clock_in : null,
          clock_out: att ? att.clock_out : null,
          total_time: att ? att.total_time : null,
          leave_type: lv ? lv.leave_type : null,
          isLeave: !!lv,
          holiday_type: hl ? hl.type : null,
          holiday_purpose: hl ? hl.purpose : null,
        };

        if (hl && String(hl.type).toLowerCase() === 'general') {
          row.status = 'holiday';
          row.statusText = 'General Holiday';
        } else if (lv) {
          const lt = String(lv.leave_type || '').toLowerCase();
          if (lt.includes('restricted')) {
            row.status = 'restricted_leave';
            row.statusText = 'Taken Restricted Leave';
          } else {
            row.status = 'taken_leave';
            row.statusText = 'Taken Leave';
          }
        } else if (att) {
          row.status = 'present';
          row.statusText = 'Present';
        } else {
          row.status = 'absent';
          row.statusText = 'Absent';
        }

        rows.push(row);
      }

      return res.json({ success: "true", message: "Attendance rows fetched", data: { rows } });
    }

    // fallback: return raw attendance rows with leave/holiday joins
    const [attendance] = await db.query(
      `SELECT a.*, lr.leave_type AS leave_type, h.type AS holiday_type, h.purpose AS holiday_purpose
       FROM attendance a
       JOIN employees e ON a.employee_id = e.employee_id
       LEFT JOIN leave_requests lr ON lr.employee_id = e.id AND lr.status = 'Approved' AND a.date BETWEEN lr.start_date AND lr.end_date
       LEFT JOIN holidays h ON a.date = h.date
       WHERE a.employee_id = ?
       ORDER BY a.date DESC`,
      [employeeId]
    );
    attendance.forEach(a => {
      a.date = toDateOnlyString(a.date);
    });
    res.json({ success: "true", message: "Attendance fetched", data: attendance });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error' });
  }
});

router.get('/all', auth, isManager, async (req, res) => {
  try {
    const [attendance] = await db.query(
      `SELECT a.*, e.name as employee_name, e.designation, lr.leave_type AS leave_type, h.type AS holiday_type
       FROM attendance a 
       JOIN employees e ON a.employee_id = e.employee_id
       LEFT JOIN leave_requests lr ON lr.employee_id = e.id AND lr.status = 'Approved' AND a.date BETWEEN lr.start_date AND lr.end_date
       LEFT JOIN holidays h ON a.date = h.date
       ORDER BY a.date DESC`
    );
    res.json({ success: "true", message: "All attendance fetched", data: attendance });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error' });
  }
});

// Attendance summary for a given employee and date range
// ✅ Helper: format date in LOCAL (IST)
function formatDateLocal(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Route
router.get('/summary', auth, isManager, async (req, res) => {
  try {
    const { employeeId, from, to } = req.query;

    if (employeeId && (from || to)) {
      const startDate = from ? new Date(from) : null;
      const endDate = to ? new Date(to) : new Date();

      const finalStart =
        startDate ||
        new Date(new Date(endDate).setDate(endDate.getDate() - 29));

      // ✅ Get employee
      const [empRows] = await db.query(
        'SELECT id, name FROM employees WHERE employee_id = ?',
        [employeeId]
      );

      if (!empRows.length) {
        return res.status(404).json({ success: "false", message: 'Employee not found' });
      }

      const empDbId = empRows[0].id;

      // ✅ Attendance (FIXED TIMEZONE ISSUE)
      const [attRows] = await db.query(
        `SELECT a.*, e.name as employee_name,
          COALESCE(
            DATE(CONVERT_TZ(a.clock_in, '+00:00', '+05:30')),
            DATE(CONVERT_TZ(a.clock_out, '+00:00', '+05:30')),
            a.date
          ) AS derived_date
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE a.employee_id = ?
         AND COALESCE(
              DATE(CONVERT_TZ(a.clock_in, '+00:00', '+05:30')),
              DATE(CONVERT_TZ(a.clock_out, '+00:00', '+05:30')),
              a.date
            ) BETWEEN ? AND ?`,
        [
          employeeId,
          formatDateLocal(finalStart),
          formatDateLocal(endDate),
        ]
      );

      // ✅ Leaves
      const [leaveRows] = await db.query(
        `SELECT * FROM leave_requests
         WHERE employee_id = ?
         AND status = 'Approved'
         AND NOT (end_date < ? OR start_date > ?)`,
        [
          empDbId,
          formatDateLocal(finalStart),
          formatDateLocal(endDate),
        ]
      );

      // ✅ Holidays
      const [holidayRows] = await db.query(
        `SELECT * FROM holidays
         WHERE date BETWEEN ? AND ?`,
        [
          formatDateLocal(finalStart),
          formatDateLocal(endDate),
        ]
      );

      // ✅ Attendance Map (KEY FIX HERE)
      const attMap = new Map();
      attRows.forEach((a) => {
        const key = formatDateLocal(a.derived_date); // 🔥 IMPORTANT
        attMap.set(key, a);
      });

      // ✅ Leave Map (expand days)
      const leaveMap = new Map();
      leaveRows.forEach((l) => {
        let d = new Date(l.start_date);
        const end = new Date(l.end_date);

        while (d <= end) {
          leaveMap.set(formatDateLocal(d), l);
          d.setDate(d.getDate() + 1);
        }
      });

      // ✅ Holiday Map
      const holidayMap = new Map();
      holidayRows.forEach((h) => {
        holidayMap.set(formatDateLocal(h.date), h);
      });

      // ✅ FINAL ROWS (NO DUPLICATES)
      const rows = [];
      let d = new Date(finalStart);

      while (d <= endDate) {
        const key = formatDateLocal(d);

        const att = attMap.get(key) || null;
        const lv = leaveMap.get(key) || null;
        const hl = holidayMap.get(key) || null;

        const row = {
          date: key,
          employee_id: employeeId,
          employee_name: empRows[0].name,
          clock_in: att ? att.clock_in : null,
          clock_out: att ? att.clock_out : null,
          total_time: att ? att.total_time : null,
          leave_type: lv ? lv.leave_type : null,
          isLeave: !!lv,
          holiday_type: hl ? hl.type : null,
          holiday_purpose: hl ? hl.purpose : null,
        };

        // ✅ Status logic
        if (hl && String(hl.type).toLowerCase() === 'general') {
          row.status = 'holiday';
          row.statusText = 'General Holiday';
        } else if (lv) {
          const lt = String(lv.leave_type || '').toLowerCase();

          if (lt.includes('restricted')) {
            row.status = 'restricted_leave';
            row.statusText = 'Taken Restricted Leave';
          } else {
            row.status = 'taken_leave';
            row.statusText = 'Taken Leave';
          }
        } else if (att) {
          row.status = 'present';
          row.statusText = 'Present';
        } else {
          row.status = 'absent';
          row.statusText = 'Absent';
        }

        rows.push(row);
        d.setDate(d.getDate() + 1);
      }

      return res.json({ success: "true", message: "Summary rows fetched", data: { rows } });
    }

    // ✅ FALLBACK (simple query)
    let query = `
      SELECT a.*, e.name as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE 1=1
    `;

    const params = [];

    if (employeeId) {
      query += ' AND a.employee_id = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY a.date DESC';

    const [attendance] = await db.query(query, params);

    const normalized = attendance.map((a) => ({
      ...a,
      date: formatDateLocal(a.date),
    }));

    res.json({ success: "true", message: "Summary fetched", data: normalized });

  } catch (error) {
    res.status(500).json({
      success: "false",
      message: 'Server error',
      error: error.message,
    });
  }
});

module.exports = router;
