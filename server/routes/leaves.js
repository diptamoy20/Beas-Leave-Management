const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.post('/apply', auth, async (req, res) => {
  try {

    const {employee_id, leave_type, start_date, end_date, no_of_days, reason, manager_id } = req.body;

    const [result] = await db.run(
      'INSERT INTO leave_requests (employee_id, manager_id, leave_type, start_date, end_date, no_of_days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, manager_id || null, leave_type, start_date, end_date, no_of_days, reason, 'Pending']
    );

    res.status(201).json({ message: 'Leave request submitted', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// router.get('/my-leaves', auth, async (req, res) => {
//   try {
//     const [leaves] = await db.query(
//       'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC',
//       [req.user.employee_id]
//     );
//     res.json(leaves);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// router.get('/my-leaves', auth, async (req, res) => {
//   try {

//     const [leaves] = await db.query(
//       'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC',
//       [req.user.employee_id]
//     );

//     const [balance] = await db.query(
//       'SELECT earned_leave FROM leave_balance WHERE employee_id = ?',
//       [req.user.employee_id]
//     );

//     res.json({
//       leave_balance: balance[0]?.earned_leave || 0,
//       leaves: leaves
//     });

//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/my-leaves', auth, async (req, res) => {
  try {
    const [leaves] = await db.query(
      `SELECT lr.*, lb.earned_leave
       FROM leave_requests lr
       LEFT JOIN leave_balance lb
       ON lr.employee_id = lb.employee_id
       WHERE lr.employee_id = ?
       ORDER BY lr.created_at DESC`,
      [req.user.employee_id]
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
      [req.user.employee_id]
    );
    res.json(balance[0] || { earned_leave: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', auth, isManager, async (req, res) => {
  try {
    const [leaves] = await db.query(
      `SELECT lr.*, e.name as employee_name, e.designation 
       FROM leave_requests lr 
       JOIN employees e ON lr.employee_id = e.employee_id 
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
      const days = leaveData.no_of_days;

      await db.run(
        `UPDATE leave_balance SET earned_leave = earned_leave - ? WHERE employee_id = ?`,
        [days, leaveData.employee_id]
      );
    }

    res.json({ message: 'Leave status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
