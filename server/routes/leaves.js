const express = require('express');
const db = require('../config/db');
const { auth, isManager, isAdmin, isSuperAdmin, hasPermission, ADMIN_ROLES } = require('../middleware/auth');
const { createNotification, createNotificationsForUsers } = require('../services/notificationService');
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

// Helper: Determine if user/applicant is Manager, HR, or Admin
function isManagerHrOrAdminRole(userRole, designation = '') {
  const r = String(userRole || '').toLowerCase();
  const d = String(designation || '').toLowerCase();
  if (r === 'manager' || r === 'hr' || r === 'admin' || r === 'super_admin') {
    return true;
  }
  if (d.includes('human resources') || d.includes('hr ') || d.startsWith('hr') || d.includes('manager')) {
    return true;
  }
  return false;
}

// Helper: Determine if user is CEO / Executive
function isCeoRole(userRole, designation = '') {
  const r = String(userRole || '').toLowerCase();
  const d = String(designation || '').toLowerCase();
  return r === 'ceo' || d.includes('ceo') || d.includes('chief executive') || d.includes('project director') || d.includes('managing director');
}

// Helper: Fetch CEO / Executive approval authority employees
async function getCeoAuthorities() {
  const [rows] = await db.query(`
    SELECT id, name, designation, employee_id, role, email 
    FROM employees 
    WHERE role = 'ceo' 
       OR designation LIKE '%CEO%' 
       OR designation LIKE '%Chief Executive%' 
       OR designation LIKE '%Project Director%'
       OR designation LIKE '%Managing Director%'
       OR role = 'super_admin'
    ORDER BY (role = 'ceo') DESC, (designation LIKE '%CEO%') DESC, (role = 'super_admin') DESC, id ASC
  `);
  return rows;
}

// Calculate working days and identify restricted holidays falling within the range
// Excludes weekends (Sat, Sun) and General holidays.
// If isRestrictedSelected is false: Restricted holidays within range are excluded from the leave calculation.
// If isRestrictedSelected is true: Restricted holidays within range are counted as additional leave days.
// Returns { totalDays, regularDays, restrictedDays, detectedRhCount, restrictedHolidayNames }
async function calculateLeaveBreakdown(startDateStr, endDateStr, duration = 'Full Day', isRestrictedSelected = false) {
  if (!startDateStr || !endDateStr) {
    return { totalDays: 0, regularDays: 0, restrictedDays: 0, detectedRhCount: 0, restrictedHolidayNames: [] };
  }
  if (duration === 'First Half' || duration === 'Second Half') {
    return { totalDays: 0.5, regularDays: 0.5, restrictedDays: 0, detectedRhCount: 0, restrictedHolidayNames: [] };
  }
  if (duration === 'Quarterly Leave') {
    return { totalDays: 1, regularDays: 1, restrictedDays: 0, detectedRhCount: 0, restrictedHolidayNames: [] };
  }
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return { totalDays: 0, regularDays: 0, restrictedDays: 0, detectedRhCount: 0, restrictedHolidayNames: [] };
  }

  const [holidays] = await db.query(
    `SELECT date, purpose, type FROM holidays WHERE date BETWEEN ? AND ?`,
    [startDateStr, endDateStr]
  );

  const generalHolidaySet = new Set();
  const restrictedHolidayMap = new Map(); // dateStr -> purpose

  holidays.forEach(h => {
    const dStr = toLocalYMD(h.date);
    if (h.type === 'General') {
      generalHolidaySet.add(dStr);
    } else if (h.type === 'Restricted') {
      restrictedHolidayMap.set(dStr, h.purpose || 'Restricted Holiday');
    }
  });

  let regularDays = 0;
  let detectedRhDays = 0;
  const restrictedHolidayNames = [];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = toLocalYMD(current);

    // Skip weekends and configured general holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !generalHolidaySet.has(dateStr)) {
      if (restrictedHolidayMap.has(dateStr)) {
        detectedRhDays += 1;
        restrictedHolidayNames.push(`${dateStr} (${restrictedHolidayMap.get(dateStr)})`);
      } else {
        regularDays += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const restrictedDays = isRestrictedSelected ? detectedRhDays : 0;
  const totalDays = regularDays + restrictedDays;
  return {
    totalDays,
    regularDays,
    restrictedDays,
    detectedRhCount: detectedRhDays,
    restrictedHolidayNames
  };
}

// Calculate working days excluding weekends and general holidays
async function calculateWorkingDays(startDateStr, endDateStr, duration = 'Full Day') {
  const breakdown = await calculateLeaveBreakdown(startDateStr, endDateStr, duration, false);
  return breakdown.totalDays;
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

// Deduct leave days according to priority:
// - Regular working days: Comp-Off first, then Earned Leave.
// - Selected Restricted Holidays: Earned Leave first, then Comp-Off.
async function deductLeaveWithPriority(employeeId, leaveId, regDays, resDays, actorId, reason) {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const [balances] = await connection.execute(
      'SELECT comp_off, earned_leave, restricted_leave FROM leave_balance WHERE employee_id = ? FOR UPDATE',
      [employeeId]
    );
    if (balances.length === 0) {
      throw new Error(`Leave balance not found for employee ${employeeId}`);
    }

    const currentCompOff = Math.max(0, Number(balances[0].comp_off || 0));
    const currentEarned = Math.max(0, Number(balances[0].earned_leave || 0));

    // Priority 1: Regular working days consume Comp-Off first, then Earned Leave
    const regCompOffUsed = Math.min(currentCompOff, regDays);
    const regEarnedUsed = Math.max(0, regDays - regCompOffUsed);

    const remCompOff = currentCompOff - regCompOffUsed;
    const remEarned = currentEarned - regEarnedUsed;

    // Priority 2: Selected Restricted Holidays consume Earned Leave first, then Comp-Off
    const resEarnedUsed = Math.min(Math.max(0, remEarned), resDays);
    const resCompOffUsed = Math.max(0, resDays - resEarnedUsed);

    const totalCompOffUsed = Number((regCompOffUsed + resCompOffUsed).toFixed(1));
    const totalEarnedUsed = Number((regEarnedUsed + resEarnedUsed).toFixed(1));

    if (totalCompOffUsed > currentCompOff || totalEarnedUsed > currentEarned) {
      throw new Error(
        `Insufficient balance for deduction: Requires ${totalCompOffUsed} Comp-Off and ${totalEarnedUsed} Regular Leave, but employee has ${currentCompOff} Comp-Off and ${currentEarned} Regular Leave.`
      );
    }

    await connection.execute(
      `UPDATE leave_balance 
       SET comp_off = GREATEST(0, comp_off - ?), 
           earned_leave = GREATEST(0, earned_leave - ?),
           restricted_leave = GREATEST(0, restricted_leave - ?)
       WHERE employee_id = ?`,
      [totalCompOffUsed, totalEarnedUsed, resDays, employeeId]
    );

    await connection.execute(
      'UPDATE leave_requests SET comp_off_used = ?, regular_days = ?, restricted_days = ? WHERE id = ?',
      [totalCompOffUsed, regDays, resDays, leaveId]
    );

    if (totalCompOffUsed > 0) {
      await connection.execute(
        `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by)
         VALUES (?, 'DEBIT', ?, ?, ?, ?)`,
        [employeeId, totalCompOffUsed, reason || `Comp-Off debited for leave (#${leaveId})`, leaveId, actorId]
      );
    }

    await connection.commit();
    return { compOffUsed: totalCompOffUsed, earnedLeaveUsed: totalEarnedUsed };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Refund leave days upon cancellation or rejection of previously approved leave
async function refundLeaveWithPriority(employeeId, leaveId, totalDays, compOffUsed, resDays, actorId, reason) {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const compOffRefund = Math.min(Math.max(0, Number(compOffUsed || 0)), totalDays);
    const earnedRefund = Math.max(0, totalDays - compOffRefund);
    const resRefund = Math.max(0, Number(resDays || 0));

    await connection.execute(
      `UPDATE leave_balance 
       SET comp_off = comp_off + ?, 
           earned_leave = earned_leave + ?,
           restricted_leave = restricted_leave + ?
       WHERE employee_id = ?`,
      [compOffRefund, earnedRefund, resRefund, employeeId]
    );

    await connection.execute(
      'UPDATE leave_requests SET comp_off_used = 0 WHERE id = ?',
      [leaveId]
    );

    if (compOffRefund > 0) {
      await connection.execute(
        `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by)
         VALUES (?, 'CREDIT', ?, ?, ?, ?)`,
        [employeeId, compOffRefund, reason || `Comp-Off refunded for leave (#${leaveId})`, leaveId, actorId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Backward compatibility alias
const deductRegularLeave = async (employeeId, leaveId, days, actorId, reason) => {
  return deductLeaveWithPriority(employeeId, leaveId, days, 0, actorId, reason);
};
const refundRegularLeave = async (employeeId, leaveId, days, compOffUsed, actorId, reason) => {
  return refundLeaveWithPriority(employeeId, leaveId, days, compOffUsed, 0, actorId, reason);
};

async function adjustRegularLeaveDeduction(employeeId, leaveId, oldDays, newDays, compOffUsed, actorId, reason) {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();
    const [balances] = await connection.execute(
      'SELECT comp_off FROM leave_balance WHERE employee_id = ? FOR UPDATE',
      [employeeId]
    );
    if (balances.length === 0) {
      throw new Error(`Leave balance not found for employee ${employeeId}`);
    }

    const change = newDays - oldDays;
    let updatedCompOffUsed = Math.max(0, compOffUsed);
    let compOffDelta = 0;
    let earnedLeaveDelta = 0;

    if (change < 0) {
      const daysRefunded = -change;
      compOffDelta = Math.min(updatedCompOffUsed, daysRefunded);
      earnedLeaveDelta = daysRefunded - compOffDelta;
      updatedCompOffUsed -= compOffDelta;
    } else if (change > 0) {
      const compOffAvailable = Math.max(0, Number(balances[0].comp_off || 0));
      const additionalCompOffUsed = Math.min(compOffAvailable, change);
      compOffDelta = -additionalCompOffUsed;
      earnedLeaveDelta = -(change - additionalCompOffUsed);
      updatedCompOffUsed += additionalCompOffUsed;
    }

    await connection.execute(
      'UPDATE leave_balance SET comp_off = comp_off + ?, earned_leave = earned_leave + ? WHERE employee_id = ?',
      [compOffDelta, earnedLeaveDelta, employeeId]
    );
    await connection.execute(
      'UPDATE leave_requests SET comp_off_used = ? WHERE id = ?',
      [updatedCompOffUsed, leaveId]
    );
    if (compOffDelta !== 0) {
      await connection.execute(
        `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          employeeId,
          compOffDelta > 0 ? 'CREDIT' : 'DEBIT',
          Math.abs(compOffDelta),
          reason,
          leaveId,
          actorId
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Public/Auth endpoint to calculate working days for date range preview with breakdown & live balance simulation
router.post('/calculate-days', auth, async (req, res) => {
  try {
    const { start_date, end_date, duration = 'Full Day', is_restricted = false } = req.body;
    const employee_id = req.user.employee_id;
    const isRhSelected = Boolean(is_restricted);

    const breakdown = await calculateLeaveBreakdown(start_date, end_date, duration, isRhSelected);

    // Fetch employee leave balances for live deduction simulation
    const [balRows] = await db.query(
      'SELECT comp_off, earned_leave FROM leave_balance WHERE employee_id = ?',
      [employee_id]
    );
    const compOffBal = Math.max(0, Number(balRows[0]?.comp_off || 0));
    const earnedLeaveBal = Math.max(0, Number(balRows[0]?.earned_leave || 0));

    // Priority simulation:
    // 1. Regular days: Comp-Off first, then Earned Leave
    const regCompOffUsed = Math.min(compOffBal, breakdown.regularDays);
    const regEarnedUsed = Math.max(0, breakdown.regularDays - regCompOffUsed);

    const remainingCompAfterReg = compOffBal - regCompOffUsed;
    const remainingEarnedAfterReg = earnedLeaveBal - regEarnedUsed;

    // 2. Restricted Holiday days: Earned Leave first, then Comp-Off
    const resEarnedUsed = Math.min(Math.max(0, remainingEarnedAfterReg), breakdown.restrictedDays);
    const resCompOffUsed = Math.max(0, breakdown.restrictedDays - resEarnedUsed);

    const totalCompOffDeduction = Number((regCompOffUsed + resCompOffUsed).toFixed(1));
    const totalEarnedDeduction = Number((regEarnedUsed + resEarnedUsed).toFixed(1));

    const totalAvailable = compOffBal + earnedLeaveBal;
    const isSufficient = breakdown.totalDays <= totalAvailable;

    res.json({
      success: "true",
      data: {
        days: breakdown.totalDays,
        regular_days: breakdown.regularDays,
        restricted_days: breakdown.restrictedDays,
        detected_rh_count: breakdown.detectedRhCount,
        restricted_holiday_names: breakdown.restrictedHolidayNames,
        simulation: {
          comp_off_available: compOffBal,
          earned_leave_available: earnedLeaveBal,
          total_available: totalAvailable,
          comp_off_deduction: totalCompOffDeduction,
          earned_leave_deduction: totalEarnedDeduction,
          remaining_comp_off: Math.max(0, Number((compOffBal - totalCompOffDeduction).toFixed(1))),
          remaining_earned_leave: Math.max(0, Number((earnedLeaveBal - totalEarnedDeduction).toFixed(1))),
          is_sufficient: isSufficient
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: error.message });
  }
});

router.post('/apply', auth, async (req, res) => {
  try {
    const { employee_id, leave_type = 'Leave', start_date, end_date, no_of_days, reason, manager_id, duration = 'Full Day', is_restricted = false, type } = req.body;

    const isCompOff = (leave_type === 'Compensatory Off' || duration === 'Compensatory Off');
    if (isCompOff) {
      if (!no_of_days || Number(no_of_days) <= 0) {
        return res.status(400).json({
          success: "false",
          message: 'Requested Comp-Off days must be greater than zero.'
        });
      }
    }

    // Fetch employee details to verify role & hierarchy
    const [empRows] = await db.query(
      'SELECT id, employee_id, name, email, role, designation FROM employees WHERE employee_id = ?',
      [employee_id]
    );
    const applicant = empRows[0] || {};
    const isApplicantHigherAuthority = isManagerHrOrAdminRole(req.user.role || applicant.role, applicant.designation);

    // Determine approver hierarchy for Comp-Off:
    // When a Manager, HR, or Admin applies for Comp-Off, it must go to the CEO / Super Admin for approval!
    let effectiveManagerId = manager_id;
    if (isCompOff && isApplicantHigherAuthority) {
      const ceoAuthorities = await getCeoAuthorities();
      const validCeoIds = ceoAuthorities.map(c => String(c.employee_id));
      const requestedIds = String(manager_id || '').split(',').map(s => s.trim()).filter(Boolean);

      const hasValidCeo = requestedIds.some(id => validCeoIds.includes(id));
      if (!hasValidCeo) {
        // Automatically route to CEO / Super Admin
        const defaultCeo = ceoAuthorities.find(c => String(c.employee_id) !== String(employee_id)) || ceoAuthorities[0];
        if (defaultCeo) {
          effectiveManagerId = String(defaultCeo.employee_id);
        }
      }
    }

    // Validation: Check Quarterly Leave balance if applying for Quarterly Leave
    if (duration === 'Quarterly Leave' || leave_type === 'Quarterly Leave') {
      const [balRows] = await db.query(
        'SELECT quarterly_leave FROM leave_balance WHERE employee_id = ?',
        [employee_id]
      );
      const qBal = Number(balRows[0]?.quarterly_leave || 0);
      if (qBal <= 0) {
        return res.status(400).json({
          success: "false",
          message: 'You have 0 Quarterly Leave balance remaining. You cannot apply for Quarterly Leave.'
        });
      }

      // Check if there is already a Pending Quarterly Leave application
      const [pendingQuarterly] = await db.query(
        "SELECT id FROM leave_requests WHERE employee_id = ? AND status = 'Pending' AND (duration = 'Quarterly Leave' OR leave_type = 'Quarterly Leave')",
        [employee_id]
      );
      if (pendingQuarterly.length >= qBal) {
        return res.status(400).json({
          success: "false",
          message: 'You already have a pending Quarterly Leave request awaiting approval.'
        });
      }
    }

    // Determine transaction nature: CREDIT for Comp-Off claim/request, DEBIT for taking leave
    const transactionType = type === 'CREDIT' || isCompOff ? 'CREDIT' : 'DEBIT';

    // Calculate regular days and restricted holiday days accurately
    let regDays = 0;
    let resDays = 0;
    let totalRequestedDays = 0;
    if (!isCompOff && duration !== 'Quarterly Leave') {
      const breakdown = await calculateLeaveBreakdown(start_date, end_date, duration, Boolean(is_restricted));
      regDays = breakdown.regularDays;
      resDays = breakdown.restrictedDays;
      totalRequestedDays = breakdown.totalDays;

      // Validate employee balance: available Comp-Off + Regular Leave must be >= requested days
      const [balRows] = await db.query(
        'SELECT comp_off, earned_leave FROM leave_balance WHERE employee_id = ?',
        [employee_id]
      );
      const availComp = Math.max(0, Number(balRows[0]?.comp_off || 0));
      const availEarned = Math.max(0, Number(balRows[0]?.earned_leave || 0));
      const totalAvailable = availComp + availEarned;

      if (totalRequestedDays > totalAvailable) {
        return res.status(400).json({
          success: "false",
          message: `Insufficient leave balance. You requested ${totalRequestedDays} day(s), but have only ${totalAvailable} day(s) available (${availComp} Comp-Off + ${availEarned} Regular Leave).`
        });
      }
    } else {
      regDays = Number(no_of_days || 0);
      resDays = 0;
      totalRequestedDays = regDays;
    }

    const hasRestricted = Boolean(is_restricted || resDays > 0);

    const [result] = await db.run(
      'INSERT INTO leave_requests (employee_id, manager_id, leave_type, start_date, end_date, no_of_days, reason, status, duration, is_restricted, type, regular_days, restricted_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, effectiveManagerId || null, leave_type, start_date, end_date, totalRequestedDays, reason, 'Pending', duration, hasRestricted, transactionType, regDays, resDays]
    );

    const leaveId = result.insertId;

    if (effectiveManagerId) {
      const managerIds = String(effectiveManagerId).split(',').map(id => id.trim()).filter(id => id);
      for (const mgrId of managerIds) {
        await db.run(
          'INSERT INTO leave_approvals (leave_id, manager_id, status) VALUES (?, ?, ?)',
          [leaveId, mgrId, 'Pending']
        );
      }

      // Notify the assigned approvers (managers/admins)
      const approverEmpIds = managerIds.map(Number).filter(id => !isNaN(id) && id > 0);
      const applicantName = applicant.name || req.user.name || `Employee #${employee_id}`;
      await createNotificationsForUsers(approverEmpIds, {
        sender_id: employee_id,
        type: 'LEAVE_REQUESTED',
        title: 'New Leave Request Received',
        message: `${applicantName} submitted a ${duration || leave_type} request for ${totalRequestedDays} day(s) (${start_date} to ${end_date}).`,
        reference_id: leaveId,
        reference_type: 'LEAVE',
        link: `/manage-leaves`
      });
    }

    // Confirmation notification to the applicant employee
    await createNotification({
      recipient_id: employee_id,
      sender_id: null,
      type: 'LEAVE_SUBMITTED',
      title: 'Leave Request Submitted',
      message: `Your ${duration || leave_type} application for ${totalRequestedDays} day(s) (${start_date} to ${end_date}) was submitted successfully.`,
      reference_id: leaveId,
      reference_type: 'LEAVE',
      link: `/leave-details/${leaveId}`
    });

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

    // Fetch pending comp-off requests
    const [pendingCompOffRows] = await db.query(
      "SELECT COALESCE(SUM(no_of_days), 0) as pending_days FROM leave_requests WHERE employee_id = ? AND status = 'Pending' AND (leave_type = 'Compensatory Off' OR duration = 'Compensatory Off')",
      [employee_id]
    );
    const pendingCompOffLeave = Number(pendingCompOffRows[0]?.pending_days || 0);

    // 2. Fetch holidays
    const [holidays] = await db.query(
      'SELECT date, purpose as name, type FROM holidays WHERE year = ? ORDER BY date ASC',
      [currentYear]
    );
    const formattedHolidays = holidays.map(h => {
      // Use toLocalYMD to prevent timezone offset shifts (e.g. UTC 18:30 shifting to previous day)
      const dateStr = toLocalYMD(h.date);
      return {
        date: dateStr,
        name: h.name,
        restricted: h.type === 'Restricted'
      };
    });

    // 3. Fetch employee details to check role & hierarchy
    const [empDetails] = await db.query(
      'SELECT id, employee_id, name, designation, role FROM employees WHERE employee_id = ?',
      [employee_id]
    );
    const applicantEmp = empDetails[0] || {};
    const isManagerHrOrAdmin = isManagerHrOrAdminRole(req.user.role || applicantEmp.role, applicantEmp.designation);
    const isCeo = isCeoRole(req.user.role || applicantEmp.role, applicantEmp.designation);

    // 4. Fetch authorities based on approval hierarchy:
    // If request is for Comp-Off and applicant is Manager, HR, or Admin -> route to CEO / Super Admin
    const isForCompOff = req.query.for_comp_off === 'true';
    let authorities = [];

    if (isForCompOff && isManagerHrOrAdmin) {
      // Must be approved by CEO / Super Admin
      const ceoList = await getCeoAuthorities();
      authorities = ceoList.filter(a => String(a.employee_id) !== String(employee_id));
      if (authorities.length === 0) {
        // Fallback if self is top super admin
        const [fallbackAdmins] = await db.query(
          "SELECT id, name, designation, employee_id FROM employees WHERE (role = 'super_admin' OR role = 'admin') AND employee_id != ?",
          [employee_id]
        );
        authorities = fallbackAdmins;
      }
    } else {
      // Regular employees: list managers and admins
      let query = "SELECT id, name, designation, employee_id FROM employees WHERE (role = 'manager' OR role IN ('admin', 'super_admin')) AND employee_id != ?";
      const [authList] = await db.query(query, [employee_id]);
      authorities = authList;
    }

    // 5. Fetch existing leaves (to block dates)
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
          compOffLeave,
          pendingCompOffLeave
        },
        holidays: formattedHolidays,
        authorities,
        leave: formattedLeaves,
        isManagerHrOrAdmin,
        isCeo
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
        regularDays: leave.regular_days !== undefined ? Number(leave.regular_days) : Number(leave.no_of_days || 0),
        restrictedDays: leave.restricted_days !== undefined ? Number(leave.restricted_days) : 0,
        type: leave.type || (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT'),
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
      leaves[i].regular_days = leave.regular_days !== undefined ? Number(leave.regular_days) : Number(leave.no_of_days || 0);
      leaves[i].restricted_days = leave.restricted_days !== undefined ? Number(leave.restricted_days) : 0;
      leaves[i].type = leave.type || (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT');
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
      leave.regular_days = leave.regular_days !== undefined ? Number(leave.regular_days) : Number(leave.no_of_days || 0);
      leave.restricted_days = leave.restricted_days !== undefined ? Number(leave.restricted_days) : 0;
      leave.type = leave.type || (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT');
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

    // If leave is already approved and the leave date is in the past, it cannot be changed
    if (leaveData.status === 'Approved') {
      const todayStr = toLocalYMD(new Date());
      const leaveStartDate = toLocalYMD(leaveData.start_date);
      if (leaveStartDate < todayStr) {
        return res.status(400).json({
          success: "false",
          message: 'This leave date has already passed. Past approved leaves cannot be changed.'
        });
      }
    }

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

    // Role and Hierarchy verification for Comp-Off approval:
    // If applicant is Manager, HR, or Admin applying for Comp-Off, approval requires CEO / Super Admin!
    const isLeaveCompOff = (leaveData.leave_type === 'Compensatory Off' || finalDuration === 'Compensatory Off' || leaveData.duration === 'Compensatory Off');
    if (isLeaveCompOff && overallStatus === 'Approved') {
      const [applicantRows] = await db.query('SELECT role, designation FROM employees WHERE employee_id = ?', [leaveData.employee_id]);
      const applicantEmp = applicantRows[0] || {};
      const applicantIsHigher = isManagerHrOrAdminRole(applicantEmp.role, applicantEmp.designation);

      if (applicantIsHigher) {
        const approverIsCeoOrSuper = req.user.role === 'super_admin' || isCeoRole(req.user.role, req.user.designation);
        if (!approverIsCeoOrSuper) {
          return res.status(403).json({
            success: "false",
            message: 'Comp-Off applications from Managers, HR, and Admins can only be approved by the CEO / Super Admin.'
          });
        }
      }
    }

    if (overallStatus !== 'Pending' && leaveData.status !== overallStatus) {
      await db.run('UPDATE leave_requests SET status = ?, rejection_reason = ? WHERE id = ?', [overallStatus, rejection_reason || null, id]);

      if (overallStatus === 'Approved') {
        const daysToDeduct = finalDays;

        if (finalDuration === 'Quarterly Leave' || leaveData.duration === 'Quarterly Leave') {
          await db.run(
            `UPDATE leave_balance SET quarterly_leave = GREATEST(0, quarterly_leave - 1) WHERE employee_id = ?`,
            [leaveData.employee_id]
          );
        } else if (isLeaveCompOff) {
          // Comp-Off request approved: CREDIT to employee's comp_off balance
          await db.run(
            `UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?`,
            [finalDays, leaveData.employee_id]
          );
          await db.run(
            `INSERT INTO comp_off_history (employee_id, type, days, work_date, reason, leave_request_id, credited_by) VALUES (?, 'CREDIT', ?, ?, ?, ?, ?)`,
            [
              leaveData.employee_id,
              finalDays,
              leaveData.start_date,
              leaveData.reason ? `${leaveData.reason}${isDayEdited ? ' (days modified on approval)' : ''}` : `Comp-Off approved (#${leaveData.id})`,
              leaveData.id,
              approverEmployeeId
            ]
          );
        } else {
          // Regular leave approval:
          // Priority 1: Regular working days consume Comp-Off first, then Earned Leave
          // Priority 2: Selected Restricted Holidays consume Earned Leave first, then Comp-Off
          let regDaysToDeduct = finalDays;
          let resDaysToDeduct = 0;

          if (leaveData.regular_days !== undefined && leaveData.restricted_days !== undefined && (Number(leaveData.regular_days) > 0 || Number(leaveData.restricted_days) > 0) && !isDayEdited) {
            regDaysToDeduct = Number(leaveData.regular_days || 0);
            resDaysToDeduct = leaveData.is_restricted ? Number(leaveData.restricted_days || 0) : 0;
          } else {
            const breakdown = await calculateLeaveBreakdown(finalStartDate, finalEndDate, finalDuration, Boolean(leaveData.is_restricted));
            regDaysToDeduct = breakdown.regularDays;
            resDaysToDeduct = breakdown.restrictedDays;
          }

          // Deduct with priority
          await deductLeaveWithPriority(
            leaveData.employee_id,
            id,
            regDaysToDeduct,
            resDaysToDeduct,
            approverEmployeeId,
            `Leave approved (#${id})`
          );
        }
      } else if (overallStatus === 'Rejected' && leaveData.status === 'Approved') {
        // Reversal: If an already approved leave is later rejected, restore balances!
        const daysToRestore = Number(leaveData.no_of_days || 0);
        if (finalDuration === 'Quarterly Leave' || leaveData.duration === 'Quarterly Leave') {
          await db.run(
            `UPDATE leave_balance SET quarterly_leave = quarterly_leave + 1 WHERE employee_id = ?`,
            [leaveData.employee_id]
          );
        } else if (isLeaveCompOff) {
          await db.run(
            `UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?`,
            [daysToRestore, leaveData.employee_id]
          );
          await db.run(
            `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by) VALUES (?, 'DEBIT', ?, ?, ?, ?)`,
            [leaveData.employee_id, daysToRestore, `Comp-Off approval revoked/rejected (#${id})`, id, approverEmployeeId]
          );
        } else {
          await refundLeaveWithPriority(
            leaveData.employee_id,
            id,
            daysToRestore,
            Number(leaveData.comp_off_used || 0),
            Number(leaveData.restricted_days || 0),
            approverEmployeeId,
            `Leave approval revoked/rejected (#${id})`
          );
        }
      }
    }

    // Trigger in-app notifications for status updates
    const approverName = req.user.name || `Approver #${approverEmployeeId}`;
    if (overallStatus === 'Approved') {
      let approvalMsg = `Your leave request (#REQ-${id}) has been approved by ${approverName}.`;
      if (isDayEdited) {
        approvalMsg = `Your leave request (#REQ-${id}) has been approved with modified dates/days (${finalDays} day(s), ${toLocalYMD(finalStartDate)} to ${toLocalYMD(finalEndDate)}).`;
      }
      await createNotification({
        recipient_id: leaveData.employee_id,
        sender_id: approverEmployeeId,
        type: 'LEAVE_APPROVED',
        title: isDayEdited ? 'Leave Approved with Modifications' : 'Leave Request Approved',
        message: approvalMsg,
        reference_id: id,
        reference_type: 'LEAVE',
        link: `/leave-details/${id}`
      });
    } else if (overallStatus === 'Rejected') {
      const rejectMsg = rejection_reason ? `Reason: ${rejection_reason}` : 'No reason provided';
      await createNotification({
        recipient_id: leaveData.employee_id,
        sender_id: approverEmployeeId,
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your leave request (#REQ-${id}) was rejected by ${approverName}. ${rejectMsg}`,
        reference_id: id,
        reference_type: 'LEAVE',
        link: `/leave-details/${id}`
      });
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

    // An approved leave can be cancelled only till the date of the leave.
    // Past leaves where the date has exceeded cannot be cancelled or changed.
    if (leave.status === 'Approved') {
      const todayStr = toLocalYMD(new Date());
      const leaveStartDate = toLocalYMD(leave.start_date);
      if (leaveStartDate < todayStr) {
        return res.status(400).json({
          success: "false",
          message: 'Approved leaves cannot be cancelled once the leave date has passed. Past leaves cannot be changed.'
        });
      }
    }

    // If leave was Approved, automatically refund the deducted days!
    if (leave.status === 'Approved') {
      const days = Number(leave.no_of_days || 0);
      const employeeId = leave.employee_id;

      if (leave.duration === 'Quarterly Leave') {
        await db.run('UPDATE leave_balance SET quarterly_leave = quarterly_leave + 1 WHERE employee_id = ?', [employeeId]);
      } else if (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off') {
        await db.run('UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?', [days, employeeId]);
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by) VALUES (?, 'DEBIT', ?, ?, ?, ?)`,
          [employeeId, days, `Comp-Off credit cancelled (#${id}): ${cancellation_reason}`, id, callerEmpId]
        );
      } else {
        await refundLeaveWithPriority(
          employeeId,
          id,
          days,
          Number(leave.comp_off_used || 0),
          Number(leave.restricted_days || 0),
          callerEmpId,
          `Leave cancelled (#${id}): ${cancellation_reason}`
        );
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

    // Send notifications regarding cancellation
    const cancellerName = req.user.name || `User #${callerEmpId}`;
    if (isOwner) {
      // Employee cancelled their own leave: notify the assigned managers
      const approverEmpIds = managerIds.map(Number).filter(mid => !isNaN(mid) && mid > 0);
      await createNotificationsForUsers(approverEmpIds, {
        sender_id: callerEmpId,
        type: 'LEAVE_CANCELLED',
        title: 'Leave Request Cancelled by Employee',
        message: `${cancellerName} has cancelled their leave request (#REQ-${id}). Reason: ${cancellation_reason}`,
        reference_id: id,
        reference_type: 'LEAVE',
        link: `/leave-details/${id}`
      });

      // Confirmation to employee
      await createNotification({
        recipient_id: callerEmpId,
        sender_id: null,
        type: 'LEAVE_CANCELLED',
        title: 'Leave Request Cancelled',
        message: `Your leave request (#REQ-${id}) has been cancelled successfully. Any deducted balance was restored.`,
        reference_id: id,
        reference_type: 'LEAVE',
        link: `/leave-details/${id}`
      });
    } else {
      // Manager/Admin cancelled employee's leave: notify the employee
      await createNotification({
        recipient_id: leave.employee_id,
        sender_id: callerEmpId,
        type: 'LEAVE_CANCELLED',
        title: 'Leave Request Cancelled by Manager/Admin',
        message: `Your leave request (#REQ-${id}) was cancelled by ${cancellerName}. Reason: ${cancellation_reason}`,
        reference_id: id,
        reference_type: 'LEAVE',
        link: `/leave-details/${id}`
      });
    }

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
        await db.run('UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?', [days, employeeId]);
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id, credited_by) VALUES (?, 'DEBIT', ?, ?, ?, ?)`,
          [employeeId, days, `Comp-Off credit removed due to record deletion (#${id}) by Admin`, id, req.user.employee_id]
        );
      } else {
        // Refund regular days and restricted holiday days accurately
        let regDaysToRefund = days;
        let resDaysToRefund = 0;

        if (leave.regular_days !== undefined && leave.restricted_days !== undefined && (Number(leave.regular_days) > 0 || Number(leave.restricted_days) > 0)) {
          regDaysToRefund = Number(leave.regular_days || 0);
          resDaysToRefund = Number(leave.restricted_days || 0);
        } else if (leave.is_restricted) {
          const breakdown = await calculateLeaveBreakdown(leave.start_date, leave.end_date, leave.duration, true);
          regDaysToRefund = breakdown.regularDays;
          resDaysToRefund = breakdown.restrictedDays;
        }

        if (regDaysToRefund > 0) {
          await refundRegularLeave(
            employeeId,
            id,
            regDaysToRefund,
            Number(leave.comp_off_used || 0),
            req.user.employee_id,
            `Comp-Off refunded after leave record deletion (#${id})`
          );
        }

        if (resDaysToRefund > 0) {
          await db.run('UPDATE leave_balance SET restricted_leave = restricted_leave + ? WHERE employee_id = ?', [resDaysToRefund, employeeId]);
        }
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

// Manager & Admin: get a specific employee's leave records, balance and info
router.get('/employee/:employeeId', auth, isManager, async (req, res) => {
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
      type: leave.type || (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT'),
      fromDate: toLocalYMD(leave.start_date),
      toDate: toLocalYMD(leave.end_date),
      appliedOn: toLocalYMD(leave.created_at),
      totalDays: leave.no_of_days,
      regularDays: leave.regular_days !== undefined ? Number(leave.regular_days) : Number(leave.no_of_days || 0),
      restrictedDays: leave.restricted_days !== undefined ? Number(leave.restricted_days) : 0,
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
      leaves[i].regular_days = leave.regular_days !== undefined ? Number(leave.regular_days) : Number(leave.no_of_days || 0);
      leaves[i].restricted_days = leave.restricted_days !== undefined ? Number(leave.restricted_days) : 0;
      leaves[i].type = leave.type || (leave.leave_type === 'Compensatory Off' || leave.duration === 'Compensatory Off' ? 'CREDIT' : 'DEBIT');
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

    // Past approved leaves cannot be modified once the date has passed
    if (oldStatus === 'Approved') {
      const todayStr = toLocalYMD(new Date());
      const oldStart = toLocalYMD(oldLeave.start_date);
      if (oldStart < todayStr) {
        return res.status(400).json({
          success: "false",
          message: 'Past approved leaves cannot be changed once the leave date has passed.'
        });
      }
    }
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
          const delta = newDays - oldDays;
          if (delta > 0) {
            await db.run(
              `UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?`,
              [delta, employeeId]
            );
            await db.run(
              `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'CREDIT', ?, ?, ?)`,
              [employeeId, delta, `Comp-Off increased by Admin (#${id}): ${admin_modification_reason}`, id]
            );
          } else {
            await db.run(
              `UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?`,
              [Math.abs(delta), employeeId]
            );
            await db.run(
              `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'DEBIT', ?, ?, ?)`,
              [employeeId, Math.abs(delta), `Comp-Off reduced by Admin (#${id}): ${admin_modification_reason}`, id]
            );
          }
        } else {
          await adjustRegularLeaveDeduction(
            employeeId,
            id,
            oldDays,
            newDays,
            Number(oldLeave.comp_off_used || 0),
            req.user.employee_id,
            `Comp-Off allocation adjusted by Admin (#${id}): ${admin_modification_reason}`
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
          `UPDATE leave_balance SET comp_off = GREATEST(0, comp_off - ?) WHERE employee_id = ?`,
          [oldDays, employeeId]
        );
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, reason, leave_request_id) VALUES (?, 'DEBIT', ?, ?, ?)`,
          [employeeId, oldDays, `Comp-Off revoked by Admin (#${id}): ${admin_modification_reason}`, id]
        );
      } else {
        // Refund regular days and restricted holiday days accurately
        let regDaysToRefund = oldDays;
        let resDaysToRefund = 0;

        if (oldLeave.regular_days !== undefined && oldLeave.restricted_days !== undefined && (Number(oldLeave.regular_days) > 0 || Number(oldLeave.restricted_days) > 0)) {
          regDaysToRefund = Number(oldLeave.regular_days || 0);
          resDaysToRefund = Number(oldLeave.restricted_days || 0);
        } else if (oldLeave.is_restricted) {
          const breakdown = await calculateLeaveBreakdown(oldLeave.start_date, oldLeave.end_date, oldLeave.duration, true);
          regDaysToRefund = breakdown.regularDays;
          resDaysToRefund = breakdown.restrictedDays;
        }

        if (regDaysToRefund > 0) {
          await refundRegularLeave(
            employeeId,
            id,
            regDaysToRefund,
            Number(oldLeave.comp_off_used || 0),
            req.user.employee_id,
            `Comp-Off refunded after leave revoked by Admin (#${id}): ${admin_modification_reason}`
          );
        }

        if (resDaysToRefund > 0) {
          await db.run('UPDATE leave_balance SET restricted_leave = restricted_leave + ? WHERE employee_id = ?', [resDaysToRefund, employeeId]);
        }
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
          `UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?`,
          [newDays, employeeId]
        );
        await db.run(
          `INSERT INTO comp_off_history (employee_id, type, days, work_date, reason, leave_request_id, credited_by) VALUES (?, 'CREDIT', ?, ?, ?, ?, ?)`,
          [employeeId, newDays, oldLeave.start_date, `Comp-Off force-approved by Admin (#${id}): ${admin_modification_reason}`, id, req.user.employee_id]
        );
      } else {
        // Calculate breakdown for newly approved dates
        const breakdown = await calculateLeaveBreakdown(newStartDate, newEndDate, oldLeave.duration, oldLeave.is_restricted);
        const regDaysToDeduct = breakdown.regularDays;
        const resDaysToDeduct = breakdown.restrictedDays;

        await db.run(
          `UPDATE leave_requests SET regular_days = ?, restricted_days = ? WHERE id = ?`,
          [regDaysToDeduct, resDaysToDeduct, id]
        );

        if (regDaysToDeduct > 0) {
          await deductRegularLeave(
            employeeId,
            id,
            regDaysToDeduct,
            req.user.employee_id,
            `Comp-Off used for leave approved by Admin (#${id}): ${admin_modification_reason}`
          );
        }

        if (resDaysToDeduct > 0) {
          await db.run(
            `UPDATE leave_balance SET restricted_leave = GREATEST(0, restricted_leave - ?) WHERE employee_id = ?`,
            [resDaysToDeduct, employeeId]
          );
        }
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

    // Send notification to employee about admin override/modification
    await createNotification({
      recipient_id: employeeId,
      sender_id: req.user.employee_id,
      type: 'LEAVE_ADMIN_MODIFIED',
      title: 'Leave Request Updated by Admin',
      message: `Your leave request (#REQ-${id}) was updated to status "${effectiveStatus}" by Admin. Reason: ${admin_modification_reason}`,
      reference_id: id,
      reference_type: 'LEAVE',
      link: `/leave-details/${id}`
    });

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

