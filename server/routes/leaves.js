const express = require('express');
const db = require('../config/db');
const { auth, isManager, isAdmin, isSuperAdmin, hasPermission, ADMIN_ROLES } = require('../middleware/auth');
// const { sendLeaveApplicationEmail } = require('../utils/email');

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

// Calculate working days excluding weekends and general holidays
async function calculateWorkingDays(startDateStr, endDateStr, duration = 'Full Day') {
  if (!startDateStr || !endDateStr) return 0;
  if (duration === 'First Half' || duration === 'Second Half') {
    return 0.5;
  }
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  const [holidays] = await db.query(
    `SELECT date FROM holidays WHERE type = 'General' AND date BETWEEN ? AND ?`,
    [startDateStr, endDateStr]
  );
  const holidaySet = new Set(holidays.map(h => toLocalYMD(h.date)));

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = toLocalYMD(current);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Check for overlapping leave requests for an employee
async function checkLeaveOverlap(employeeId, startDateStr, endDateStr, excludeLeaveId = null) {
  let query = `
    SELECT id, leave_type, start_date, end_date, no_of_days, status 
    FROM leave_requests 
    WHERE employee_id = ? 
      AND status IN ('Approved', 'Pending') 
      AND NOT (end_date < ? OR start_date > ?)
  `;
  const params = [employeeId, startDateStr, endDateStr];
  if (excludeLeaveId) {
    query += ` AND id != ?`;
    params.push(excludeLeaveId);
  }
  const [conflicts] = await db.query(query, params);
  return conflicts;
}

// Public/Auth endpoint to calculate working days for date range preview
router.post('/calculate-days', auth, async (req, res) => {
  try {
    const { start_date, end_date, duration = 'Full Day' } = req.body;
    const days = await calculateWorkingDays(start_date, end_date, duration);
    res.json({ success: "true", data: { days } });
  } catch (error) {
    res.status(500).json({ success: "false", message: error.message });
  }
});

router.post('/apply', auth, async (req, res) => {
  try {

    const { employee_id, leave_type = 'Leave', start_date, end_date, no_of_days, reason, manager_id, duration = 'Full Day', is_restricted = false } = req.body;

    const isCompOff = (leave_type === 'Compensatory Off' || duration === 'Compensatory Off');
    if (isCompOff) {
      const [balanceRows] = await db.query('SELECT comp_off FROM leave_balance WHERE employee_id = ?', [employee_id]);
      const availableCompOff = Number(balanceRows[0]?.comp_off || 0);

      // Check already pending comp-off requests to prevent over-commitment
      const [pendingRows] = await db.query(
        "SELECT COALESCE(SUM(no_of_days), 0) as pending_days FROM leave_requests WHERE employee_id = ? AND status = 'Pending' AND (leave_type = 'Compensatory Off' OR duration = 'Compensatory Off')",
        [employee_id]
      );
      const pendingDays = Number(pendingRows[0]?.pending_days || 0);
      const effectiveAvailable = availableCompOff - pendingDays;

      if (Number(no_of_days) > effectiveAvailable) {
        return res.status(400).json({
          success: "false",
          message: `Insufficient Comp-Off balance. You have ${availableCompOff} day(s) available (${pendingDays} day(s) currently pending approval). Maximum you can apply right now is ${Math.max(0, effectiveAvailable)} day(s).`
        });
      }
    }

    const [result] = await db.run(
      'INSERT INTO leave_requests (employee_id, manager_id, leave_type, start_date, end_date, no_of_days, reason, status, duration, is_restricted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, manager_id || null, leave_type, start_date, end_date, no_of_days, reason, 'Pending', duration, is_restricted]
    );

    const leaveId = result.insertId;

    if (manager_id) {
      const managerIds = String(manager_id).split(',').map(id => id.trim()).filter(id => id);
      for (const mgrId of managerIds) {
        await db.run(
          'INSERT INTO leave_approvals (leave_id, manager_id, status) VALUES (?, ?, ?)',
          [leaveId, mgrId, 'Pending']
        );
      }
    }

    // Send email notification to managers if manager_id is present
    if (manager_id) {
      try {
        const [managerRows] = await db.query('SELECT name, email FROM employees WHERE FIND_IN_SET(employee_id, ?) > 0', [manager_id]);
        const [employeeRows] = await db.query('SELECT name, email FROM employees WHERE employee_id = ?', [employee_id]);

        // if (managerRows.length > 0 && employeeRows.length > 0) {
        //   const employee = employeeRows[0];

        //   for (const manager of managerRows) {
        //     if (manager.email) {
        //       await sendLeaveApplicationEmail(
        //         manager.email,
        //         manager.name,
        //         employee.name,
        //         employee.email,
        //         { leave_type, start_date, end_date, no_of_days, reason, duration, is_restricted }
        //       );
        //     }
        //   }
        // }
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

    const totalLeave = Number(b.earned_leave || 0);
    const balanceLeave = Number((b.casual_leave || 0) + (b.sick_leave || 0) + (b.paid_leave || 0) + (b.earned_leave || 0));
    const restrictedLeave = Number(b.restricted_leave ?? 1);
    const quarterlyLeave = Number(b.quarterly_leave || 0);
    const compOffLeave = Number(b.comp_off || 0);

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

    // 3. Fetch authorities (managers and all admin tiers)
    let query = "SELECT id, name, designation, employee_id FROM employees WHERE (role = 'manager' OR role IN ('admin', 'super_admin', 'admin_1', 'admin_2', 'admin_3')) AND employee_id != ?";
    const [authorities] = await db.query(query, [employee_id]);

    // 4. Fetch existing leaves (to block dates)
    const [existingLeaves] = await db.query(
      'SELECT start_date, end_date FROM leave_requests WHERE employee_id = ? AND status != "Rejected"',
      [employee_id]
    );
    const formattedLeaves = existingLeaves.map(l => ({
      from_date: toLocalYMD(l.start_date),
      to_date: toLocalYMD(l.end_date)
    }));

    res.json({
      success: "true",
      message: "Leave fetched successfully",
      data: {
        leaveBalance: {
          totalLeave,
          balanceLeave,
          restrictedLeave,
          quarterlyLeave,
          compOffLeave
        },
        holidays: formattedHolidays,
        authorities,
        leave: formattedLeaves
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

router.get('/leave-details/:id?', auth, async (req, res) => {
  try {
    const [balance] = await db.query(
      `SELECT earned_leave FROM leave_balance WHERE employee_id = ?`,
      [req.user.employee_id]
    );

    // --- Single leave detail (by ID) ---
    if (req.params.id) {
      const [rows] = await db.query(
        `SELECT * FROM leave_requests WHERE id = ?`,
        [req.params.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: "false", message: 'Leave not found' });
      }

      const leave = rows[0];
      let approvals = [];

      if (leave.manager_id) {
        const managerIds = String(leave.manager_id).split(',').map(id => id.trim()).filter(id => id);

        if (managerIds.length > 0) {
          const placeholders = managerIds.map(() => '?').join(',');
          const [managers] = await db.query(
            `SELECT employee_id, name, designation FROM employees WHERE employee_id IN (${placeholders})`,
            managerIds
          );

          const [approvalRows] = await db.query(
            'SELECT manager_id, status, updated_at FROM leave_approvals WHERE leave_id = ?',
            [leave.id]
          );

          approvals = managers.map((mgr, idx) => {
            const approvalRecord = approvalRows.find(a => String(a.manager_id) === String(mgr.employee_id));
            let managerStatus = approvalRecord ? approvalRecord.status : 'Pending';

            // Fallback for old leaves without leave_approvals records
            if (!approvalRecord) {
              if (leave.status === 'Approved') managerStatus = 'Approved';
              else if (leave.status === 'Rejected') managerStatus = 'Rejected';
            }

            let approvalDate = '';
            if (approvalRecord && approvalRecord.updated_at) {
              const d = new Date(approvalRecord.updated_at);
              approvalDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }

            return {
              id: idx + 1,
              name: mgr.name,
              designation: mgr.designation || 'Manager',
              status: managerStatus,
              date: approvalDate,
            };
          });
        }
      }

      const formatDate = (dateStr) => toLocalYMD(dateStr);

      const leaveDetail = {
        id: leave.id,
        employee_id: leave.employee_id,
        leaveType: leave.leave_type,
        applicationType: leave.duration || 'Full Day',
        status: leave.status,
        fromDate: formatDate(leave.start_date),
        toDate: formatDate(leave.end_date),
        appliedOn: formatDate(leave.created_at),
        totalDays: leave.no_of_days,
        reason: leave.reason,
        rejectionReason: leave.rejection_reason || null,
        approvals,
        originalStartDate: formatDate(leave.original_start_date),
        originalEndDate: formatDate(leave.original_end_date),
        originalDays: leave.original_no_of_days,
        isModifiedOnApproval: Boolean(leave.is_modified_on_approval),
        approvalEditReason: leave.approval_edit_reason,
        cancellationReason: leave.cancellation_reason,
        cancelledBy: leave.cancelled_by,
        cancelledAt: leave.cancelled_at,
        adminOverrideStatus: leave.admin_override_status,
        adminModifiedBy: leave.admin_modified_by,
        adminModificationReason: leave.admin_modification_reason,
        adminModifiedAt: leave.admin_modified_at,
      };

      return res.json({
        success: "true",
        message: "Leave fetched successfully",
        data: {
          leave: leaveDetail,
          earned_leave: balance[0]?.earned_leave ?? 0,
        }
      });
    }

    // --- List of leaves (no ID) ---
    let queryStr = `SELECT * FROM leave_requests WHERE employee_id = ?`;
    const queryParams = [req.user.employee_id];

    if (req.query.search) {
      queryStr += ` AND (leave_type LIKE ? OR status LIKE ? OR reason LIKE ?)`;
      const searchPattern = `%${req.query.search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    queryStr += ` ORDER BY created_at DESC`;

    const [rows] = await db.query(queryStr, queryParams);
    const leaves = rows;

    for (let i = 0; i < leaves.length; i++) {
      const leave = leaves[i];
      let approvalDetails = [];

      if (leave.manager_id) {
        const managerIds = String(leave.manager_id).split(',').map(id => id.trim()).filter(id => id);

        if (managerIds.length > 0) {
          const placeholders = managerIds.map(() => '?').join(',');
          const [managers] = await db.query(
            `SELECT employee_id, name, designation FROM employees WHERE employee_id IN (${placeholders})`,
            managerIds
          );

          const [approvalRows] = await db.query(
            'SELECT manager_id, status, updated_at FROM leave_approvals WHERE leave_id = ?',
            [leave.id]
          );

          approvalDetails = managers.map(mgr => {
            const approvalRecord = approvalRows.find(a => String(a.manager_id) === String(mgr.employee_id));
            let managerStatus = approvalRecord ? approvalRecord.status : 'Pending';

            if (!approvalRecord) {
              if (leave.status === 'Approved') managerStatus = 'Approved';
              else if (leave.status === 'Rejected') managerStatus = 'Rejected';
            }

            return {
              manager_id: mgr.employee_id,
              manager_name: mgr.name,
              designation: mgr.designation,
              status: managerStatus,
              date: approvalRecord ? approvalRecord.updated_at : null,
            };
          });
        }
      }

      leaves[i].start_date = toLocalYMD(leave.start_date);
      leaves[i].end_date = toLocalYMD(leave.end_date);
      leaves[i].approvalDetails = approvalDetails;
    }

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
    const [balance] = await db.query(
      `SELECT earned_leave FROM leave_balance WHERE employee_id = ?`,
      [approverEmployeeId]
    );

    let queryStr = `SELECT lr.*, e.name as employee_name, e.designation, la.status as manager_status
       FROM leave_requests lr 
       JOIN employees e ON lr.employee_id = e.employee_id 
       LEFT JOIN leave_approvals la ON lr.id = la.leave_id AND la.manager_id = ?
       WHERE FIND_IN_SET(?, lr.manager_id) > 0`;
       
    const queryParams = [approverEmployeeId, approverEmployeeId];

    if (req.query.search) {
      queryStr += ` AND (e.name LIKE ? OR lr.leave_type LIKE ? OR lr.status LIKE ? OR la.status LIKE ? OR lr.reason LIKE ?)`;
      const searchPattern = `%${req.query.search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    queryStr += ` ORDER BY lr.created_at DESC`;

    const [leaves] = await db.query(queryStr, queryParams);

    leaves.forEach(leave => {
      leave.start_date = toLocalYMD(leave.start_date);
      leave.end_date = toLocalYMD(leave.end_date);
      if (leave.manager_status) {
        leave.global_status = leave.status;
        leave.status = leave.manager_status;
      }
    });

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

router.put('/:id/status', auth, isManager, async (req, res) => {
  try {
    const {
      status,
      rejection_reason,
      start_date: modifiedStartDate,
      end_date: modifiedEndDate,
      duration: modifiedDuration,
      no_of_days: modifiedDays,
      approval_edit_reason
    } = req.body;
    const { id } = req.params;
    const approverEmployeeId = req.user.employee_id;
    const isCallerAdmin = ADMIN_ROLES.includes(req.user.role);

    const [leave] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (leave.length === 0) {
      return res.status(404).json({ success: "false", message: 'Leave request not found' });
    }

    const leaveData = leave[0];

    // Check if the approver is in the comma-separated string of manager_ids or is an Admin
    const managerIds = String(leaveData.manager_id || '').split(',').map(m => m.trim());
    if (!isCallerAdmin && !managerIds.includes(String(approverEmployeeId))) {
      return res.status(403).json({ success: "false", message: 'Access denied. This leave request is not assigned to you.' });
    }

    // -------------------------------------------------------------------------
    // LEAVE APPROVAL - DAY EDIT (Modify dates/days during approval)
    // -------------------------------------------------------------------------
    let finalStartDate = leaveData.start_date;
    let finalEndDate = leaveData.end_date;
    let finalDuration = leaveData.duration || 'Full Day';
    let finalDays = Number(leaveData.no_of_days);
    let isDayEdited = false;

    if (status === 'Approved' && (modifiedStartDate || modifiedEndDate || modifiedDuration || modifiedDays !== undefined)) {
      const newStart = modifiedStartDate ? toLocalYMD(modifiedStartDate) : toLocalYMD(leaveData.start_date);
      const newEnd = modifiedEndDate ? toLocalYMD(modifiedEndDate) : toLocalYMD(leaveData.end_date);
      const newDur = modifiedDuration || leaveData.duration || 'Full Day';

      if (new Date(newStart) > new Date(newEnd)) {
        return res.status(400).json({ success: "false", message: 'Start date cannot be after end date.' });
      }

      // Check overlapping leaves for employee on modified dates
      const overlaps = await checkLeaveOverlap(leaveData.employee_id, newStart, newEnd, id);
      if (overlaps.length > 0) {
        return res.status(400).json({
          success: "false",
          message: `Modified dates overlap with existing leave (#REQ-${overlaps[0].id} from ${toLocalYMD(overlaps[0].start_date)} to ${toLocalYMD(overlaps[0].end_date)}).`
        });
      }

      // Calculate working days
      const calculatedWorkingDays = await calculateWorkingDays(newStart, newEnd, newDur);
      const calculatedFinalDays = (modifiedDays !== undefined && Number(modifiedDays) > 0)
        ? Number(modifiedDays)
        : (calculatedWorkingDays > 0 ? calculatedWorkingDays : 1);

      // Check if dates or days actually changed
      const oldStartStr = toLocalYMD(leaveData.start_date);
      const oldEndStr = toLocalYMD(leaveData.end_date);
      if (newStart !== oldStartStr || newEnd !== oldEndStr || calculatedFinalDays !== Number(leaveData.no_of_days) || newDur !== leaveData.duration) {
        isDayEdited = true;
        finalStartDate = newStart;
        finalEndDate = newEnd;
        finalDuration = newDur;
        finalDays = calculatedFinalDays;

        // Preserve original details if not already saved
        const origStart = leaveData.original_start_date ? toLocalYMD(leaveData.original_start_date) : oldStartStr;
        const origEnd = leaveData.original_end_date ? toLocalYMD(leaveData.original_end_date) : oldEndStr;
        const origDays = leaveData.original_no_of_days !== null && leaveData.original_no_of_days !== undefined
          ? leaveData.original_no_of_days
          : leaveData.no_of_days;

        await db.run(`
          UPDATE leave_requests SET
            start_date = ?,
            end_date = ?,
            duration = ?,
            no_of_days = ?,
            original_start_date = ?,
            original_end_date = ?,
            original_no_of_days = ?,
            is_modified_on_approval = TRUE,
            approval_edit_reason = ?
          WHERE id = ?
        `, [
          finalStartDate,
          finalEndDate,
          finalDuration,
          finalDays,
          origStart,
          origEnd,
          origDays,
          approval_edit_reason ? approval_edit_reason.trim() : `Modified dates/duration by Approver on approval`,
          id
        ]);
      }
    }

    // Ensure a record exists in leave_approvals (for backward compatibility)
    const [approvalRow] = await db.query('SELECT * FROM leave_approvals WHERE leave_id = ? AND manager_id = ?', [id, approverEmployeeId]);
    if (approvalRow.length === 0) {
      await db.run('INSERT INTO leave_approvals (leave_id, manager_id, status) VALUES (?, ?, ?)', [id, approverEmployeeId, status]);
    } else {
      await db.run('UPDATE leave_approvals SET status = ? WHERE leave_id = ? AND manager_id = ?', [status, id, approverEmployeeId]);
    }

    // Check all approvals
    const [allApprovals] = await db.query('SELECT status FROM leave_approvals WHERE leave_id = ?', [id]);

    let overallStatus = 'Pending';
    const hasRejected = allApprovals.some(a => a.status === 'Rejected');

    const expectedManagerCount = managerIds.filter(mid => mid.trim()).length;
    const allApproved = allApprovals.length > 0 && (allApprovals.length === expectedManagerCount || isCallerAdmin) && allApprovals.every(a => a.status === 'Approved');

    if (hasRejected || status === 'Rejected') {
      overallStatus = 'Rejected';
    } else if (allApproved || (status === 'Approved' && (expectedManagerCount === 0 || isCallerAdmin))) {
      overallStatus = 'Approved';
    }

    if (overallStatus !== 'Pending' && leaveData.status !== overallStatus) {
      await db.run('UPDATE leave_requests SET status = ?, rejection_reason = ? WHERE id = ?', [overallStatus, rejection_reason || null, id]);

      if (overallStatus === 'Approved') {
        const daysToDeduct = finalDays;

        if (finalDuration === 'Quarterly Leave' || leaveData.duration === 'Quarterly Leave') {
          await db.run(
            `UPDATE leave_balance SET quarterly_leave = quarterly_leave - 1 WHERE employee_id = ?`,
            [leaveData.employee_id]
          );
        } else if (leaveData.leave_type === 'Compensatory Off' || finalDuration === 'Compensatory Off') {
          await db.run(
            `UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?`,
            [daysToDeduct, leaveData.employee_id]
          );
          await db.run(
            `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'DEBIT', ?, ?, ?)`,
            [leaveData.employee_id, daysToDeduct, `Comp-Off leave approved (#${leaveData.id})${isDayEdited ? ' with modified days' : ''}`, leaveData.id]
          );
        } else {
          await db.run(
            `UPDATE leave_balance SET earned_leave = earned_leave - ? WHERE employee_id = ?`,
            [daysToDeduct, leaveData.employee_id]
          );
        }

        if (leaveData.is_restricted) {
          await db.run(
            `UPDATE leave_balance SET restricted_leave = restricted_leave - 1 WHERE employee_id = ?`,
            [leaveData.employee_id]
          );
        }
      }
    }

    res.json({
      success: "true",
      message: `Leave status updated to ${overallStatus}${isDayEdited ? ' with updated dates/days' : ''}`,
      data: {
        id,
        status: overallStatus,
        days: finalDays,
        isModifiedOnApproval: isDayEdited
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// LEAVE CANCELLATION WORKFLOW (with automatic balance refund)
// ---------------------------------------------------------------------------
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason = 'Cancelled by user' } = req.body;
    const callerEmpId = req.user.employee_id;
    const isCallerAdmin = ADMIN_ROLES.includes(req.user.role);

    const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Leave request not found' });
    }
    const leave = rows[0];

    const isOwner = String(leave.employee_id) === String(callerEmpId);
    const managerIds = String(leave.manager_id || '').split(',').map(m => m.trim());
    const isAssignedManager = managerIds.includes(String(callerEmpId));

    if (!isOwner && !isAssignedManager && !isCallerAdmin) {
      return res.status(403).json({ success: "false", message: 'Access denied. You are not authorized to cancel this leave.' });
    }

    if (leave.status === 'Cancelled') {
      return res.status(400).json({ success: "false", message: 'This leave request is already cancelled.' });
    }

    if (leave.status === 'Rejected') {
      return res.status(400).json({ success: "false", message: 'Rejected leave requests cannot be cancelled.' });
    }

    // If leave was Approved, automatically refund the deducted days!
    if (leave.status === 'Approved') {
      const days = Number(leave.no_of_days || 0);
      const employeeId = leave.employee_id;

      if (leave.duration === 'Quarterly Leave') {
        await db.run('UPDATE leave_balance SET quarterly_leave = quarterly_leave + 1 WHERE employee_id = ?', [employeeId]);
      } else if (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off') {
        await db.run('UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?', [days, employeeId]);
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by) VALUES (?, 'CREDIT', ?, ?, ?, ?)`,
          [employeeId, days, `Comp-Off refunded due to cancellation (#${id}): ${cancellation_reason}`, id, callerEmpId]
        );
      } else {
        await db.run('UPDATE leave_balance SET earned_leave = earned_leave + ? WHERE employee_id = ?', [days, employeeId]);
      }

      if (leave.is_restricted) {
        await db.run('UPDATE leave_balance SET restricted_leave = restricted_leave + 1 WHERE employee_id = ?', [employeeId]);
      }
    }

    // Update leave request status to Cancelled
    await db.run(`
      UPDATE leave_requests SET
        status = 'Cancelled',
        cancellation_reason = ?,
        cancelled_by = ?,
        cancelled_at = NOW()
      WHERE id = ?
    `, [cancellation_reason.trim(), callerEmpId, id]);

    res.json({
      success: "true",
      message: 'Leave request has been successfully cancelled and any deducted balance has been refunded.',
      data: { id, status: 'Cancelled' }
    });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// LEAVE RECORD DELETION (Protected for Admins with safety balance refund)
// ---------------------------------------------------------------------------
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'super_admin';
    const canModifyApproved = isSuperAdmin || Boolean(req.user.permissions?.can_modify_approved_leaves);

    const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Leave request not found' });
    }
    const leave = rows[0];

    // Protect approved records from unauthorized permanent deletion
    if (leave.status === 'Approved' && !canModifyApproved) {
      return res.status(403).json({
        success: "false",
        message: 'Permission denied. Approved leave records are protected and require elevated admin permissions to delete.'
      });
    }

    // If an approved leave is deleted by an authorized Admin, refund balance so employee quota is not permanently lost
    if (leave.status === 'Approved') {
      const days = Number(leave.no_of_days || 0);
      const employeeId = leave.employee_id;

      if (leave.duration === 'Quarterly Leave') {
        await db.run('UPDATE leave_balance SET quarterly_leave = quarterly_leave + 1 WHERE employee_id = ?', [employeeId]);
      } else if (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off') {
        await db.run('UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?', [days, employeeId]);
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by) VALUES (?, 'CREDIT', ?, ?, ?, ?)`,
          [employeeId, days, `Comp-Off refunded due to record deletion (#${id}) by Admin`, id, req.user.employee_id]
        );
      } else {
        await db.run('UPDATE leave_balance SET earned_leave = earned_leave + ? WHERE employee_id = ?', [days, employeeId]);
      }

      if (leave.is_restricted) {
        await db.run('UPDATE leave_balance SET restricted_leave = restricted_leave + 1 WHERE employee_id = ?', [employeeId]);
      }
    }

    await db.run('DELETE FROM leave_approvals WHERE leave_id = ?', [id]);
    await db.run('DELETE FROM leave_requests WHERE id = ?', [id]);

    res.json({ success: "true", message: `Leave record #${id} deleted successfully.`, data: { id } });
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// Admin: get a specific employee's leave records, balance and info
router.get('/employee/:employeeId', auth, isAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const statusFilter = req.query.status; // 'Approved', 'Pending', 'Rejected', or undefined for all

    // 1. Fetch employee info
    const [empRows] = await db.query(
      'SELECT id, name, email, designation, employee_id, role FROM employees WHERE employee_id = ?',
      [employeeId]
    );
    if (empRows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Employee not found' });
    }
    const employee = empRows[0];

    // 2. Fetch leave balance
    const [balanceRows] = await db.query(
      'SELECT * FROM leave_balance WHERE employee_id = ?',
      [employeeId]
    );
    const balance = balanceRows[0] || {};
    const totalLeave = Number(balance.earned_leave || 0) + Number(balance.quarterly_leave || 0);
    const balanceLeave = Number(balance.earned_leave || 0);
    const earlyLeave = Number(balance.quarterly_leave || 0);

    // 3. Fetch leave requests
    let queryStr = 'SELECT * FROM leave_requests WHERE employee_id = ?';
    const queryParams = [employeeId];

    if (statusFilter && statusFilter !== 'All') {
      queryStr += ' AND status = ?';
      queryParams.push(statusFilter);
    }

    queryStr += ' ORDER BY created_at DESC';

    const [leaveRows] = await db.query(queryStr, queryParams);

    const leaves = leaveRows.map(leave => ({
      id: leave.id,
      leaveType: leave.leave_type,
      applicationType: leave.duration || 'Full Day',
      status: leave.status,
      fromDate: toLocalYMD(leave.start_date),
      toDate: toLocalYMD(leave.end_date),
      appliedOn: toLocalYMD(leave.created_at),
      totalDays: leave.no_of_days,
      reason: leave.reason,
    }));

    res.json({
      success: "true",
      message: "Employee leave history fetched successfully",
      data: {
        employee: {
          name: employee.name,
          employeeId: employee.employee_id,
          designation: employee.designation,
          email: employee.email,
        },
        leaveSummary: {
          totalLeave: String(totalLeave),
          balanceLeave: String(balanceLeave),
          earlyLeave: String(earlyLeave),
        },
        leaves,
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// GET /api/leaves/manager-approved - View all manager-approved leaves for Super Admin & authorized Admins
router.get('/manager-approved', auth, hasPermission('can_view_all_leaves'), async (req, res) => {
  try {
    const statusFilter = req.query.status || 'All'; // 'Approved', 'Pending', 'Rejected', 'All'
    const search = req.query.search || '';

    let queryStr = `
      SELECT 
        lr.*,
        e.name as employee_name,
        e.email as employee_email,
        e.designation,
        adm.name as admin_modifier_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      LEFT JOIN employees adm ON lr.admin_modified_by = adm.employee_id
    `;

    const conditions = [];
    const params = [];

    if (statusFilter !== 'All') {
      conditions.push('lr.status = ?');
      params.push(statusFilter);
    }

    if (search) {
      conditions.push('(e.name LIKE ? OR e.employee_id LIKE ? OR lr.leave_type LIKE ? OR lr.reason LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY lr.created_at DESC LIMIT 200';

    const [rows] = await db.query(queryStr, params);
    const leaves = rows;

    for (let i = 0; i < leaves.length; i++) {
      const leave = leaves[i];
      let approvalDetails = [];

      if (leave.manager_id) {
        const managerIds = String(leave.manager_id).split(',').map(id => id.trim()).filter(id => id);

        if (managerIds.length > 0) {
          const placeholders = managerIds.map(() => '?').join(',');
          const [managers] = await db.query(
            `SELECT employee_id, name, designation FROM employees WHERE employee_id IN (${placeholders})`,
            managerIds
          );

          const [approvalRows] = await db.query(
            'SELECT manager_id, status, updated_at FROM leave_approvals WHERE leave_id = ?',
            [leave.id]
          );

          approvalDetails = managers.map(mgr => {
            const approvalRecord = approvalRows.find(a => String(a.manager_id) === String(mgr.employee_id));
            let managerStatus = approvalRecord ? approvalRecord.status : 'Pending';

            if (!approvalRecord) {
              if (leave.status === 'Approved') managerStatus = 'Approved';
              else if (leave.status === 'Rejected') managerStatus = 'Rejected';
            }

            return {
              manager_id: mgr.employee_id,
              manager_name: mgr.name,
              designation: mgr.designation,
              status: managerStatus,
              date: approvalRecord ? approvalRecord.updated_at : null,
            };
          });
        }
      }

      leaves[i].start_date = toLocalYMD(leave.start_date);
      leaves[i].end_date = toLocalYMD(leave.end_date);
      leaves[i].created_at = toLocalYMD(leave.created_at);
      leaves[i].approvalDetails = approvalDetails;
    }

    res.json({
      success: "true",
      message: "Manager-approved leaves fetched successfully",
      data: { leaves }
    });
  } catch (error) {
    console.error('Error fetching manager-approved leaves:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// PUT /api/leaves/:id/admin-modify - Super Admin / Authorized Admin modify or override leave
router.put('/:id/admin-modify', auth, hasPermission('can_modify_approved_leaves'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status, // 'Approved', 'Rejected', 'Revoked', 'Pending'
      start_date,
      end_date,
      no_of_days,
      reason,
      admin_modification_reason
    } = req.body;

    if (!admin_modification_reason) {
      return res.status(400).json({ success: "false", message: 'Admin reason is required for modification' });
    }

    const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Leave request not found' });
    }

    const oldLeave = rows[0];
    const employeeId = oldLeave.employee_id;
    const oldStatus = oldLeave.status;
    const oldDays = Number(oldLeave.no_of_days || 0);

    const newStatus = status || oldStatus;
    const newDays = no_of_days !== undefined ? Number(no_of_days) : oldDays;
    const newStartDate = start_date || oldLeave.start_date;
    const newEndDate = end_date || oldLeave.end_date;
    const newReason = reason !== undefined ? reason : oldLeave.reason;

    // Recalculate balance adjustments
    // Scenario 1: Was Approved, and remains Approved, but days changed
    if (oldStatus === 'Approved' && (newStatus === 'Approved' || newStatus === 'Modified')) {
      const daysDiff = oldDays - newDays; // If old was 3, new is 2 => daysDiff = +1 (refund 1 day)
      if (daysDiff !== 0) {
        if (oldLeave.duration === 'Quarterly Leave') {
          // No fractional days for quarterly
        } else if (oldLeave.leave_type === 'Compensatory Off' || oldLeave.duration === 'Compensatory Off') {
          await db.run(
            `UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?`,
            [daysDiff, employeeId]
          );
          await db.run(
            `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, ?, ?, ?, ?)`,
            [employeeId, daysDiff > 0 ? 'CREDIT' : 'DEBIT', Math.abs(daysDiff), `Comp-Off adjusted by Admin (#${id}): ${admin_modification_reason}`, id]
          );
        } else {
          await db.run(
            `UPDATE leave_balance SET earned_leave = earned_leave + ? WHERE employee_id = ?`,
            [daysDiff, employeeId]
          );
        }
      }
    }
    // Scenario 2: Was Approved, now Revoked or Rejected => refund all oldDays
    else if (oldStatus === 'Approved' && (newStatus === 'Rejected' || newStatus === 'Revoked')) {
      if (oldLeave.duration === 'Quarterly Leave') {
        await db.run(
          `UPDATE leave_balance SET quarterly_leave = quarterly_leave + 1 WHERE employee_id = ?`,
          [employeeId]
        );
      } else if (oldLeave.leave_type === 'Compensatory Off' || oldLeave.duration === 'Compensatory Off') {
        await db.run(
          `UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?`,
          [oldDays, employeeId]
        );
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'CREDIT', ?, ?, ?)`,
          [employeeId, oldDays, `Comp-Off refunded due to leave revocation by Admin (#${id}): ${admin_modification_reason}`, id]
        );
      } else {
        await db.run(
          `UPDATE leave_balance SET earned_leave = earned_leave + ? WHERE employee_id = ?`,
          [oldDays, employeeId]
        );
      }

      if (oldLeave.is_restricted) {
        await db.run(
          `UPDATE leave_balance SET restricted_leave = restricted_leave + 1 WHERE employee_id = ?`,
          [employeeId]
        );
      }
    }
    // Scenario 3: Was Rejected or Pending, now Admin forces Approved => deduct newDays
    else if (oldStatus !== 'Approved' && (newStatus === 'Approved' || newStatus === 'Modified')) {
      if (oldLeave.duration === 'Quarterly Leave') {
        await db.run(
          `UPDATE leave_balance SET quarterly_leave = quarterly_leave - 1 WHERE employee_id = ?`,
          [employeeId]
        );
      } else if (oldLeave.leave_type === 'Compensatory Off' || oldLeave.duration === 'Compensatory Off') {
        await db.run(
          `UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?`,
          [newDays, employeeId]
        );
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'DEBIT', ?, ?, ?)`,
          [employeeId, newDays, `Comp-Off leave force-approved by Admin (#${id}): ${admin_modification_reason}`, id]
        );
      } else {
        await db.run(
          `UPDATE leave_balance SET earned_leave = earned_leave - ? WHERE employee_id = ?`,
          [newDays, employeeId]
        );
      }

      if (oldLeave.is_restricted) {
        await db.run(
          `UPDATE leave_balance SET restricted_leave = restricted_leave - 1 WHERE employee_id = ?`,
          [employeeId]
        );
      }
    }

    // Determine target overall status
    const effectiveStatus = (newStatus === 'Revoked') ? 'Rejected' : newStatus;

    // Update leave_requests with admin audit columns
    await db.run(`
      UPDATE leave_requests SET 
        status = ?,
        start_date = ?,
        end_date = ?,
        no_of_days = ?,
        reason = ?,
        admin_override_status = ?,
        admin_modified_by = ?,
        admin_modification_reason = ?,
        admin_modified_at = NOW()
      WHERE id = ?
    `, [
      effectiveStatus,
      newStartDate,
      newEndDate,
      newDays,
      newReason,
      newStatus,
      req.user.employee_id,
      admin_modification_reason,
      id
    ]);

    res.json({
      success: "true",
      message: 'Leave successfully updated and audited by Admin',
      data: {
        id,
        status: effectiveStatus,
        admin_override_status: newStatus,
        no_of_days: newDays
      }
    });
  } catch (error) {
    console.error('Error modifying leave by admin:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;

