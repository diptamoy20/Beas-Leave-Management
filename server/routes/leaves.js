const express = require('express');
const db = require('../config/db');
const { auth, isManager, isAdmin } = require('../middleware/auth');
const { sendLeaveApplicationEmail } = require('../utils/email');

const router = express.Router();

router.post('/apply', auth, async (req, res) => {
  try {

    const {employee_id, leave_type = 'Leave', start_date, end_date, no_of_days, reason, manager_id, duration = 'Full Day', is_restricted = false } = req.body;

    const [result] = await db.run(
      'INSERT INTO leave_requests (employee_id, manager_id, leave_type, start_date, end_date, no_of_days, reason, status, duration, is_restricted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, manager_id || null, leave_type, start_date, end_date, no_of_days, reason, 'Pending', duration, is_restricted]
    );

    // Send email notification to managers if manager_id is present
    if (manager_id) {
      try {
        const [managerRows] = await db.query('SELECT name, email FROM employees WHERE FIND_IN_SET(employee_id, ?) > 0', [manager_id]);
        const [employeeRows] = await db.query('SELECT name, email FROM employees WHERE employee_id = ?', [employee_id]);
        
        if (managerRows.length > 0 && employeeRows.length > 0) {
          const employee = employeeRows[0];
          
          for (const manager of managerRows) {
            if (manager.email) {
              await sendLeaveApplicationEmail(
                manager.email,
                manager.name,
                employee.name,
                employee.email,
                { leave_type, start_date, end_date, no_of_days, reason, duration, is_restricted }
              );
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send leave application email:', emailError);
        // Continue with the success response even if email fails
      }
    }

    res.status(201).json({ success: "true", message: 'Leave request submitted', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/apply-meta', auth, async (req, res) => {
  try {
    const employee_id = req.user.employee_id;
    const currentYear = new Date().getFullYear();

    // 1. Fetch leave balance
    const [balance] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [employee_id]
    );
    const b = balance[0] || {};
    
    const totalLeave = String(b.earned_leave || 0);
    const balanceLeave = String((b.casual_leave || 0) + (b.sick_leave || 0) + (b.paid_leave || 0) + (b.earned_leave || 0));
    const restrictedLieve = String(b.restricted_leave ?? 1);
    
    // 2. Fetch holidays
    const [holidays] = await db.query(
      'SELECT date, purpose as name, type FROM holidays WHERE year = ? ORDER BY date ASC',
      [currentYear]
    );
    const formattedHolidays = holidays.map(h => {
      // YYYY-MM-DD
      const dateStr = h.date ? new Date(h.date).toISOString().split('T')[0] : null;
      return {
        date: dateStr,
        name: h.name,
        restricted: h.type === 'Restricted'
      };
    });

    // 3. Fetch authorities
    let query = "SELECT id, name, designation, employee_id FROM employees WHERE role = 'manager' OR role = 'admin'";
    const [authorities] = await db.query(query);

    res.json({
      success: "true",
      message: "Data fetch successfully",
      data: {
        totalLeave,
        "balance Leave": balanceLeave,
        "restrictedLieve": restrictedLieve,
        holidays: formattedHolidays,
        authorities
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
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
      `SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC`,
      [req.user.employee_id]
    );

    const [balance] = await db.query(
      `SELECT earned_leave FROM leave_balance WHERE employee_id = ?`,
      [req.user.employee_id]
    );

    res.json({
      success: "true",
      message: "Leaves fetched successfully",
      data: {
        leaves,
        earned_leave: balance[0]?.earned_leave ?? 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const [balance] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [req.user.employee_id]
    );
    res.json({ success: "true", message: "Balance fetched successfully", data: balance[0] || { earned_leave: 0 } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/all', auth, isManager, async (req, res) => {
  try {
    const approverEmployeeId = req.user.employee_id;
    const [leaves] = await db.query(
      `SELECT lr.*, e.name as employee_name, e.designation 
       FROM leave_requests lr 
       JOIN employees e ON lr.employee_id = e.employee_id 
       WHERE FIND_IN_SET(?, lr.manager_id) > 0
       ORDER BY lr.created_at DESC`
      ,
      [approverEmployeeId]
    );
    res.json({ success: "true", message: "All leaves fetched successfully", data: leaves });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.put('/:id/status', auth, isManager, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const { id } = req.params;
    const approverEmployeeId = req.user.employee_id;

    const [leave] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (leave.length === 0) {
      return res.status(404).json({ success: "false", message: 'Leave request not found' });
    }

    // Check if the approver is in the comma-separated string of manager_ids
    const managerIds = String(leave[0].manager_id || '').split(',');
    if (!managerIds.includes(String(approverEmployeeId))) {
      return res.status(403).json({ success: "false", message: 'Access denied. This leave request is not assigned to you.' });
    }

    await db.run('UPDATE leave_requests SET status = ?, rejection_reason = ? WHERE id = ?', [status, rejection_reason || null, id]);

    if (status === 'Approved') {
      const leaveData = leave[0];
      const days = leaveData.no_of_days;

      if (leaveData.duration === 'Quarterly Leave') {
        await db.run(
          `UPDATE leave_balance SET quarterly_leave = quarterly_leave - 1 WHERE employee_id = ?`,
          [leaveData.employee_id]
        );
      } else {
        await db.run(
          `UPDATE leave_balance SET earned_leave = earned_leave - ? WHERE employee_id = ?`,
          [days, leaveData.employee_id]
        );
      }
      
      if (leaveData.is_restricted) {
        await db.run(
          `UPDATE leave_balance SET restricted_leave = restricted_leave - 1 WHERE employee_id = ?`,
          [leaveData.employee_id]
        );
      }
    }

    res.json({ success: "true", message: 'Leave status updated', data: {} });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/approved', auth, isAdmin, async (req, res) => {
  try {
    const [leaves] = await db.query(
      `SELECT lr.*, e.name as employee_name, e.employee_id as emp_id, e.designation
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE lr.status = 'Approved'
       ORDER BY lr.created_at DESC`
    );
    res.json({ success: "true", message: "Approved leaves fetched successfully", data: leaves });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
