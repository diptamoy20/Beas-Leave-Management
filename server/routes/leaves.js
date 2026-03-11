const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.post('/apply', auth, async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;
    
    const [result] = await db.run(
      'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, leave_type, start_date, end_date, reason, 'Pending']
    );

    res.status(201).json({ message: 'Leave request submitted', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-leaves', auth, async (req, res) => {
  try {
    const [leaves] = await db.query(
      'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const [balance] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [req.user.id]
    );
    res.json(balance[0] || { casual_leave: 0, sick_leave: 0, paid_leave: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', auth, isManager, async (req, res) => {
  try {
    const [leaves] = await db.query(
      `SELECT lr.*, e.name as employee_name, e.department 
       FROM leave_requests lr 
       JOIN employees e ON lr.employee_id = e.id 
       ORDER BY lr.created_at DESC`
    );
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/status', auth, isManager, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const [leave] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (leave.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    await db.run('UPDATE leave_requests SET status = ? WHERE id = ?', [status, id]);

    if (status === 'Approved') {
      const leaveData = leave[0];
      const days = Math.ceil((new Date(leaveData.end_date) - new Date(leaveData.start_date)) / (1000 * 60 * 60 * 24)) + 1;
      
      const leaveTypeMap = {
        'Casual Leave': 'casual_leave',
        'Sick Leave': 'sick_leave',
        'Paid Leave': 'paid_leave'
      };
      
      const column = leaveTypeMap[leaveData.leave_type];
      if (column) {
        await db.run(
          `UPDATE leave_balance SET ${column} = ${column} - ? WHERE employee_id = ?`,
          [days, leaveData.employee_id]
        );
      }
    }

    res.json({ message: 'Leave status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
