const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

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

// 1. POST /api/comp-off/credit - Managers and Admins credit Comp-Off to an employee
router.post('/credit', auth, isManager, async (req, res) => {
  try {
    const { employee_id, days, work_date, reason } = req.body;
    const creditedBy = req.user.employee_id;

    // Validations
    if (!employee_id) {
      return res.status(400).json({ success: "false", message: 'Employee ID is required.' });
    }

    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 0) {
      return res.status(400).json({ success: "false", message: 'Credited days must be a positive number (e.g. 0.5, 1, 2).' });
    }

    if (!work_date) {
      return res.status(400).json({ success: "false", message: 'Date worked (weekend/holiday) is required.' });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: "false", message: 'A valid reason for granting Comp-Off is required.' });
    }

    // Verify employee exists
    const [empRows] = await db.query('SELECT employee_id, name, email FROM employees WHERE employee_id = ?', [employee_id]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Employee not found.' });
    }

    const employee = empRows[0];

    // Atomically increment comp_off in leave_balance
    const [existingBalance] = await db.query('SELECT id FROM leave_balance WHERE employee_id = ?', [employee_id]);
    if (existingBalance && existingBalance.length > 0) {
      await db.run('UPDATE leave_balance SET comp_off = comp_off + ? WHERE employee_id = ?', [numDays, employee_id]);
    } else {
      await db.run(`
        INSERT INTO leave_balance (employee_id, earned_leave, quarterly_leave, restricted_leave, comp_off)
        VALUES (?, 0, 1, 3, ?)
      `, [employee_id, numDays]);
    }

    // Insert record into comp_off_history
    const [result] = await db.run(`
      INSERT INTO comp_off_history (employee_id, type, days, work_date, reason, credited_by)
      VALUES (?, 'CREDIT', ?, ?, ?, ?)
    `, [employee_id, numDays, work_date, reason.trim(), creditedBy]);

    // Fetch updated balance
    const [balanceRows] = await db.query('SELECT comp_off FROM leave_balance WHERE employee_id = ?', [employee_id]);
    const updatedBalance = balanceRows[0]?.comp_off || 0;

    res.status(201).json({
      success: "true",
      message: `Successfully credited ${numDays} Comp-Off day(s) to ${employee.name}.`,
      data: {
        id: result.insertId,
        employee_id,
        employee_name: employee.name,
        credited_days: numDays,
        current_comp_off_balance: updatedBalance,
        work_date,
        reason: reason.trim()
      }
    });
  } catch (error) {
    console.error('Error crediting comp-off:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 2. GET /api/comp-off/my-summary - Current user's Comp-Off balance & history
router.get('/my-summary', auth, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;

    const [balanceRows] = await db.query('SELECT comp_off FROM leave_balance WHERE employee_id = ?', [employeeId]);
    const balance = Number(balanceRows[0]?.comp_off || 0);

    const [historyRows] = await db.query(`
      SELECT 
        h.*,
        m.name as credited_by_name,
        lr.start_date as leave_start_date,
        lr.end_date as leave_end_date,
        lr.leave_type as leave_type,
        lr.duration as leave_duration
      FROM comp_off_history h
      LEFT JOIN employees m ON h.credited_by = m.employee_id
      LEFT JOIN leave_requests lr ON h.leave_request_id = lr.id
      WHERE h.employee_id = ?
      ORDER BY h.created_at DESC
    `, [employeeId]);

    const formattedHistory = historyRows.map(h => ({
      id: h.id,
      type: h.type,
      days: Number(h.days),
      work_date: toLocalYMD(h.work_date),
      reason: h.reason,
      credited_by: h.credited_by,
      credited_by_name: h.credited_by_name || 'System / Admin',
      created_at: toLocalYMD(h.created_at),
      leave_request_id: h.leave_request_id,
      leave_start_date: toLocalYMD(h.leave_start_date),
      leave_end_date: toLocalYMD(h.leave_end_date),
      leave_type: h.leave_type,
      leave_duration: h.leave_duration
    }));

    const totalCredited = formattedHistory
      .filter(h => h.type === 'CREDIT')
      .reduce((sum, h) => sum + h.days, 0);

    const totalUsed = formattedHistory
      .filter(h => h.type === 'DEBIT')
      .reduce((sum, h) => sum + h.days, 0);

    const [pendingRows] = await db.query(
      `SELECT id, start_date, end_date, no_of_days, reason, status, duration, created_at
       FROM leave_requests
       WHERE employee_id = ? AND (leave_type = 'Compensatory Off' OR duration = 'Compensatory Off') AND status = 'Pending'
       ORDER BY created_at DESC`,
      [employeeId]
    );
    const pendingDays = pendingRows.reduce((sum, r) => sum + Number(r.no_of_days || 0), 0);

    res.json({
      success: "true",
      message: "Comp-off summary fetched",
      data: {
        balance,
        totalCredited,
        totalUsed,
        pendingDays,
        history: formattedHistory,
        pendingRequests: pendingRows.map(r => ({
          id: r.id,
          start_date: toLocalYMD(r.start_date),
          end_date: toLocalYMD(r.end_date),
          days: Number(r.no_of_days || 0),
          reason: r.reason,
          status: r.status,
          duration: r.duration,
          created_at: toLocalYMD(r.created_at)
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 2b. GET /api/comp-off/employee/:employeeId - Specific employee's Comp-Off balance & ledger (Managers & Admins)
router.get('/employee/:employeeId', auth, isManager, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const [empRows] = await db.query('SELECT id, employee_id, name, email, designation, role FROM employees WHERE employee_id = ?', [employeeId]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Employee not found.' });
    }
    const employee = empRows[0];

    const [balanceRows] = await db.query('SELECT comp_off FROM leave_balance WHERE employee_id = ?', [employeeId]);
    const balance = Number(balanceRows[0]?.comp_off || 0);

    const [historyRows] = await db.query(`
      SELECT 
        h.*,
        m.name as credited_by_name,
        lr.start_date as leave_start_date,
        lr.end_date as leave_end_date,
        lr.leave_type as leave_type,
        lr.duration as leave_duration
      FROM comp_off_history h
      LEFT JOIN employees m ON h.credited_by = m.employee_id
      LEFT JOIN leave_requests lr ON h.leave_request_id = lr.id
      WHERE h.employee_id = ?
      ORDER BY h.created_at DESC
    `, [employeeId]);

    const formattedHistory = historyRows.map(h => ({
      id: h.id,
      type: h.type,
      days: Number(h.days),
      work_date: toLocalYMD(h.work_date),
      reason: h.reason,
      credited_by: h.credited_by,
      credited_by_name: h.credited_by_name || (h.type === 'DEBIT' ? 'Leave Approval' : 'System'),
      created_at: toLocalYMD(h.created_at),
      leave_request_id: h.leave_request_id,
      leave_start_date: toLocalYMD(h.leave_start_date),
      leave_end_date: toLocalYMD(h.leave_end_date),
      leave_type: h.leave_type,
      leave_duration: h.leave_duration
    }));

    const totalCredited = formattedHistory
      .filter(h => h.type === 'CREDIT')
      .reduce((sum, h) => sum + h.days, 0);

    const totalUsed = formattedHistory
      .filter(h => h.type === 'DEBIT')
      .reduce((sum, h) => sum + h.days, 0);

    res.json({
      success: "true",
      message: "Employee comp-off summary fetched",
      data: {
        employee,
        balance,
        totalCredited,
        totalUsed,
        history: formattedHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 3. GET /api/comp-off/balances - All employees with Comp-Off balances (Managers & Admins)
router.get('/balances', auth, isManager, async (req, res) => {
  try {
    const search = req.query.search || '';

    let queryStr = `
      SELECT 
        e.employee_id,
        e.name,
        e.email,
        e.designation,
        e.role,
        COALESCE(b.comp_off, 0) as comp_off_balance,
        COALESCE((SELECT SUM(days) FROM comp_off_history WHERE employee_id = e.employee_id AND type = 'CREDIT'), 0) as total_credited,
        COALESCE((SELECT SUM(days) FROM comp_off_history WHERE employee_id = e.employee_id AND type = 'DEBIT'), 0) as total_used
      FROM employees e
      LEFT JOIN leave_balance b ON e.employee_id = b.employee_id
    `;

    const params = [];
    if (search) {
      queryStr += ` WHERE (e.name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    queryStr += ` ORDER BY b.comp_off DESC, e.name ASC`;

    const [rows] = await db.query(queryStr, params);

    res.json({
      success: "true",
      message: "Comp-off balances fetched successfully",
      data: { balances: rows }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 4. GET /api/comp-off/history - Global or employee-specific credit/debit audit history
router.get('/history', auth, async (req, res) => {
  try {
    const isMgrOrAdmin = req.user.role === 'manager' || ['super_admin', 'admin'].includes(req.user.role);
    const filterEmployeeId = req.query.employee_id;
    const search = req.query.search || '';

    let queryStr = `
      SELECT 
        h.*,
        e.name as employee_name,
        e.designation as employee_designation,
        m.name as credited_by_name,
        lr.start_date as leave_start_date,
        lr.end_date as leave_end_date,
        lr.leave_type as leave_type,
        lr.duration as leave_duration
      FROM comp_off_history h
      JOIN employees e ON h.employee_id = e.employee_id
      LEFT JOIN employees m ON h.credited_by = m.employee_id
      LEFT JOIN leave_requests lr ON h.leave_request_id = lr.id
    `;

    const conditions = [];
    const params = [];

    // If not manager or admin, restrict to self
    if (!isMgrOrAdmin) {
      conditions.push('h.employee_id = ?');
      params.push(req.user.employee_id);
    } else if (filterEmployeeId) {
      conditions.push('h.employee_id = ?');
      params.push(filterEmployeeId);
    }

    if (search) {
      conditions.push('(e.name LIKE ? OR e.employee_id LIKE ? OR h.reason LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY h.created_at DESC LIMIT 200';

    const [rows] = await db.query(queryStr, params);

    const formattedHistory = rows.map(h => ({
      id: h.id,
      employee_id: h.employee_id,
      employee_name: h.employee_name,
      employee_designation: h.employee_designation,
      type: h.type,
      days: Number(h.days),
      work_date: toLocalYMD(h.work_date),
      reason: h.reason,
      credited_by: h.credited_by,
      credited_by_name: h.credited_by_name || (h.type === 'DEBIT' ? 'Leave Approval' : 'System'),
      leave_request_id: h.leave_request_id,
      leave_start_date: toLocalYMD(h.leave_start_date),
      leave_end_date: toLocalYMD(h.leave_end_date),
      leave_type: h.leave_type,
      leave_duration: h.leave_duration,
      created_at: toLocalYMD(h.created_at)
    }));

    res.json({
      success: "true",
      message: "Comp-off history fetched successfully",
      data: { history: formattedHistory }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
