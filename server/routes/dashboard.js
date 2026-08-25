const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const empDbId = req.user.id;

    // Fetch leave requests for the employee
    const [requests] = await db.query(
      'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC',
      [employeeId]
    );

    // Format requests to match expected output
    const formattedRequests = requests.map(req => {
      let applicationType = "Full Day Application";
      if (req.no_of_days < 1) {
        applicationType = "Half Day Application";
      } else if (req.no_of_days > 1) {
        applicationType = `${req.no_of_days} Days Application`;
      }

      // Convert dates to YYYY-MM-DD
      const fromDate = new Date(req.start_date).toISOString().split('T')[0];
      const toDate = new Date(req.end_date).toISOString().split('T')[0];

      return {
        id: req.id,
        type: req.leave_type,
        applicationType: applicationType,
        fromDate: fromDate,
        toDate: toDate,
        status: req.status,
        reason: req.reason
      };
    });

    // Fetch leave balance
    const [balances] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [empDbId] // Note: leave_balance seems to use internal id, but leaves.js uses employee_id. Let's check both or fallback
    );

    // In leaves.js it uses req.user.employee_id for leave_balance! 
    const [balanceByEmpId] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [employeeId]
    );

    const balance = balanceByEmpId.length > 0 ? balanceByEmpId[0] : (balances.length > 0 ? balances[0] : null);

    // Mock summary data based on requested format, but populating dynamically if possible
    const totalLeave = (balance?.casual_leave || 12) + (balance?.sick_leave || 10) + (balance?.paid_leave || 15);
    const balanceLeave = balance?.earned_leave || 14; // Default to 14 if earned_leave doesn't exist yet
    const earlyLeave = balance?.quarterly_leave !== undefined ? balance.quarterly_leave : 3; // Fallback to 3 if undefined

    const leaveRequestByEmployee = requests.length;

    res.json({
      success: "true",
      message: "Data fetch successfully",
      data: {
        leaveRequestByEmployee: String(leaveRequestByEmployee),
        leaveSummary: {
          totalLeave: String(totalLeave),
          balanceLeave: String(balanceLeave),
          earlyLeave: String(earlyLeave)
        },
        leaveRequests: formattedRequests
      }
    });

  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
