const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.post('/clock-in', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [req.user.id, today]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Already clocked in today' });
    }

    const clockInTime = new Date().toISOString();
    await db.run(
      'INSERT INTO attendance (employee_id, date, clock_in) VALUES (?, ?, ?)',
      [req.user.id, today, clockInTime]
    );

    res.json({ message: 'Clocked in successfully', clock_in: clockInTime });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/clock-out', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [req.user.id, today]
    );

    if (existing.length === 0) {
      return res.status(400).json({ message: 'No clock-in record found for today' });
    }

    if (existing[0].clock_out) {
      return res.status(400).json({ message: 'Already clocked out today' });
    }

    const clockOutTime = new Date().toISOString();
    await db.run(
      'UPDATE attendance SET clock_out = ? WHERE employee_id = ? AND date = ?',
      [clockOutTime, req.user.id, today]
    );

    res.json({ message: 'Clocked out successfully', clock_out: clockOutTime });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-attendance', auth, async (req, res) => {
  try {
    const [attendance] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 30',
      [req.user.id]
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
       JOIN employees e ON a.employee_id = e.id 
       ORDER BY a.date DESC LIMIT 100`
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
