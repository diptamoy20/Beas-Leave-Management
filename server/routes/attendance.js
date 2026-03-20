const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');
const startAttendanceDeviceSync = require('../services/attendanceDeviceSync');

const router = express.Router();

// Start device -> DB sync once (cron/interval).
// This is attendance-only; it runs in the background and keeps the `attendance` table updated.
if (!global.__attendanceDeviceSyncStarted) {
  global.__attendanceDeviceSyncStarted = true;
  startAttendanceDeviceSync();
}

router.post('/clock-in', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ message: 'Employee not found' });
    const employeeId = empData[0].employee_id;
    
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Already clocked in today' });
    }

    const clockInTime = new Date().toISOString();
    await db.run(
      'INSERT INTO attendance (employee_id, date, clock_in, total_time) VALUES (?, ?, ?, NULL)',
      [employeeId, today, clockInTime]
    );

    res.json({ message: 'Clocked in successfully', clock_in: clockInTime });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/clock-out', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ message: 'Employee not found' });
    const employeeId = empData[0].employee_id;
    
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length === 0) {
      return res.status(400).json({ message: 'No clock-in record found for today' });
    }

    if (existing[0].clock_out) {
      return res.status(400).json({ message: 'Already clocked out today' });
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

    res.json({ message: 'Clocked out successfully', clock_out: clockOutTime });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-attendance', auth, async (req, res) => {
  try {
    // Get employee_id from employees table
    const [empData] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [req.user.id]);
    if (!empData.length) return res.status(404).json({ message: 'Employee not found' });
    const employeeId = empData[0].employee_id;
    
    const [attendance] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 30',
      [employeeId]
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', auth, isManager, async (req, res) => {
  try {
    const [attendance] = await db.query(
      `SELECT a.*, e.name as employee_name, e.department 
       FROM attendance a 
       JOIN employees e ON a.employee_id = e.employee_id 
       ORDER BY a.date DESC LIMIT 100`
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
