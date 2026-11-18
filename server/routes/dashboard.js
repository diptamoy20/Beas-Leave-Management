const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const toLocalYMD = (d) => {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date)) return d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

      // Convert dates to YYYY-MM-DD local
      const fromDate = toLocalYMD(req.start_date);
      const toDate = toLocalYMD(req.end_date);

      return {
        id: req.id,
        type: req.leave_type,
        transactionType: req.type || (req.leave_type === 'Compensatory Off' || req.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT'),
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

    // Live leave balances
    const earnedLeaveBal = Number(balance?.earned_leave || 0);
    const quarterlyLeaveBal = Number(balance?.quarterly_leave || 0);
    const compOff = Number(balance?.comp_off || 0);
    const totalLeave = earnedLeaveBal + quarterlyLeaveBal;
    const balanceLeave = earnedLeaveBal;
    const earlyLeave = quarterlyLeaveBal;

    // Live Comp-Off summary metrics from comp_off_history and leave_requests
    const [creditedRows] = await db.query(
      "SELECT COALESCE(SUM(days), 0) as total_credited FROM comp_off_history WHERE employee_id = ? AND type = 'CREDIT'",
      [employeeId]
    );
    const totalCompOffCredited = Number(creditedRows[0]?.total_credited || 0);

    const [usedRows] = await db.query(
      "SELECT COALESCE(SUM(days), 0) as total_used FROM comp_off_history WHERE employee_id = ? AND type = 'DEBIT'",
      [employeeId]
    );
    const totalCompOffUsed = Number(usedRows[0]?.total_used || 0);

    const [pendingCompRows] = await db.query(
      `SELECT COALESCE(SUM(no_of_days), 0) as pending_days, COUNT(*) as pending_count 
       FROM leave_requests 
       WHERE employee_id = ? AND status = 'Pending' AND (leave_type = 'Compensatory Off' OR duration = 'Compensatory Off')`,
      [employeeId]
    );
    const pendingCompOffDays = Number(pendingCompRows[0]?.pending_days || 0);
    const pendingCompOffCount = Number(pendingCompRows[0]?.pending_count || 0);

    const leaveRequestByEmployee = requests.length;

    res.json({
      success: "true",
      message: "Data fetch successfully",
      data: {
        leaveRequestByEmployee: String(leaveRequestByEmployee),
        leaveSummary: {
          totalLeave: String(totalLeave),
          balanceLeave: String(balanceLeave),
          earlyLeave: String(earlyLeave),
          compOff: String(compOff),
          compOffCredited: totalCompOffCredited,
          compOffUsed: totalCompOffUsed,
          compOffPendingDays: pendingCompOffDays,
          compOffPendingCount: pendingCompOffCount
        },
        compOffSummary: {
          balance: compOff,
          totalCredited: totalCompOffCredited,
          totalUsed: totalCompOffUsed,
          pendingDays: pendingCompOffDays,
          pendingCount: pendingCompOffCount
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
