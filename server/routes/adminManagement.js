const express = require('express');
const db = require('../config/db');
const { auth, isSuperAdmin, ADMIN_ROLES } = require('../middleware/auth');

const router = express.Router();

// All routes in this file require Super Admin role
router.use(auth, isSuperAdmin);

// 1. GET /api/admin/admins - List all Admins and their permissions
router.get('/admins', async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id, 
        e.employee_id, 
        e.name, 
        e.email, 
        e.designation, 
        e.role, 
        e.created_at,
        p.can_manage_admins,
        p.can_view_all_leaves,
        p.can_modify_approved_leaves,
        p.can_adjust_balances,
        p.can_manage_holidays
      FROM employees e
      LEFT JOIN admin_permissions p ON e.employee_id = p.employee_id
      WHERE e.role IN ('super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3')
      ORDER BY 
        CASE e.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin_1' THEN 2
          WHEN 'admin_2' THEN 3
          WHEN 'admin_3' THEN 4
          WHEN 'admin' THEN 5
          ELSE 6
        END, e.name ASC
    `;

    const [admins] = await db.query(query);

    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      employee_id: admin.employee_id,
      name: admin.name,
      email: admin.email,
      designation: admin.designation,
      role: admin.role,
      created_at: admin.created_at,
      permissions: {
        can_manage_admins: admin.role === 'super_admin' ? true : Boolean(admin.can_manage_admins),
        can_view_all_leaves: admin.role === 'super_admin' ? true : (admin.can_view_all_leaves !== null ? Boolean(admin.can_view_all_leaves) : true),
        can_modify_approved_leaves: admin.role === 'super_admin' ? true : Boolean(admin.can_modify_approved_leaves),
        can_adjust_balances: admin.role === 'super_admin' ? true : Boolean(admin.can_adjust_balances),
        can_manage_holidays: admin.role === 'super_admin' ? true : Boolean(admin.can_manage_holidays),
      }
    }));

    res.json({
      success: "true",
      message: "Admin list fetched successfully",
      data: { admins: formattedAdmins }
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 2. GET /api/admin/eligible-employees - Search employees who are not yet admins
router.get('/eligible-employees', async (req, res) => {
  try {
    const search = req.query.search || '';
    let query = `
      SELECT id, employee_id, name, email, designation, role 
      FROM employees 
      WHERE role NOT IN ('super_admin', 'admin_1', 'admin_2', 'admin_3')
    `;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR employee_id LIKE ? OR email LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ` ORDER BY name ASC LIMIT 50`;

    const [employees] = await db.query(query, params);

    res.json({
      success: "true",
      message: "Eligible employees fetched",
      data: { employees }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 3. POST /api/admin/admins - Assign an employee to an admin role (with default or customized permissions)
router.post('/admins', async (req, res) => {
  try {
    const { employee_id, role = 'admin_3', permissions = {} } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: "false", message: 'employee_id is required' });
    }

    if (!['super_admin', 'admin_1', 'admin_2', 'admin_3', 'admin'].includes(role)) {
      return res.status(400).json({ success: "false", message: 'Invalid admin role' });
    }

    // Verify employee exists
    const [empRows] = await db.query('SELECT id, name, role FROM employees WHERE employee_id = ?', [employee_id]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Employee not found' });
    }

    // Update employee role
    await db.run('UPDATE employees SET role = ? WHERE employee_id = ?', [role, employee_id]);

    // Setup default permissions based on role tier if not explicitly passed
    const defaultCanModify = (role === 'super_admin' || role === 'admin_1');
    const defaultCanAdjust = (role === 'super_admin' || role === 'admin_1');
    const defaultCanManageHolidays = (role === 'super_admin' || role === 'admin_1');

    const canManageAdmins = role === 'super_admin' ? true : Boolean(permissions.can_manage_admins);
    const canViewAllLeaves = permissions.can_view_all_leaves !== undefined ? Boolean(permissions.can_view_all_leaves) : true;
    const canModifyApprovedLeaves = permissions.can_modify_approved_leaves !== undefined ? Boolean(permissions.can_modify_approved_leaves) : defaultCanModify;
    const canAdjustBalances = permissions.can_adjust_balances !== undefined ? Boolean(permissions.can_adjust_balances) : defaultCanAdjust;
    const canManageHolidays = permissions.can_manage_holidays !== undefined ? Boolean(permissions.can_manage_holidays) : defaultCanManageHolidays;

    // Insert or update admin_permissions
    await db.run(`
      INSERT INTO admin_permissions (
        employee_id, 
        can_manage_admins, 
        can_view_all_leaves, 
        can_modify_approved_leaves, 
        can_adjust_balances, 
        can_manage_holidays
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        can_manage_admins = VALUES(can_manage_admins),
        can_view_all_leaves = VALUES(can_view_all_leaves),
        can_modify_approved_leaves = VALUES(can_modify_approved_leaves),
        can_adjust_balances = VALUES(can_adjust_balances),
        can_manage_holidays = VALUES(can_manage_holidays)
    `, [employee_id, canManageAdmins, canViewAllLeaves, canModifyApprovedLeaves, canAdjustBalances, canManageHolidays]);

    res.json({
      success: "true",
      message: `Employee assigned as ${role} successfully`,
      data: {
        employee_id,
        role,
        permissions: {
          can_manage_admins: canManageAdmins,
          can_view_all_leaves: canViewAllLeaves,
          can_modify_approved_leaves: canModifyApprovedLeaves,
          can_adjust_balances: canAdjustBalances,
          can_manage_holidays: canManageHolidays
        }
      }
    });
  } catch (error) {
    console.error('Error assigning admin:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 4. PUT /api/admin/admins/:employeeId/role - Promote/Demote an Admin's tier
router.put('/admins/:employeeId/role', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { role } = req.body;

    if (!['super_admin', 'admin_1', 'admin_2', 'admin_3', 'admin'].includes(role)) {
      return res.status(400).json({ success: "false", message: 'Invalid admin role' });
    }

    // Protect against demoting the current Super Admin if they are the only one
    if (String(req.user.employee_id) === String(employeeId) && role !== 'super_admin') {
      const [superAdmins] = await db.query("SELECT id FROM employees WHERE role = 'super_admin'");
      if (superAdmins.length <= 1) {
        return res.status(400).json({ success: "false", message: 'Cannot demote the only Super Admin.' });
      }
    }

    await db.run('UPDATE employees SET role = ? WHERE employee_id = ?', [role, employeeId]);

    res.json({
      success: "true",
      message: `Admin role updated to ${role}`,
      data: { employee_id: employeeId, role }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 5. PUT /api/admin/admins/:employeeId/permissions - Update specific permissions
router.put('/admins/:employeeId/permissions', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { permissions } = req.body;

    if (!permissions) {
      return res.status(400).json({ success: "false", message: 'permissions object is required' });
    }

    const [empRows] = await db.query('SELECT role FROM employees WHERE employee_id = ?', [employeeId]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Admin not found' });
    }

    const isAdminTarget = ADMIN_ROLES.includes(empRows[0].role);
    if (!isAdminTarget) {
      return res.status(400).json({ success: "false", message: 'Employee is not an admin' });
    }

    const canManageAdmins = Boolean(permissions.can_manage_admins);
    const canViewAllLeaves = permissions.can_view_all_leaves !== undefined ? Boolean(permissions.can_view_all_leaves) : true;
    const canModifyApprovedLeaves = Boolean(permissions.can_modify_approved_leaves);
    const canAdjustBalances = Boolean(permissions.can_adjust_balances);
    const canManageHolidays = Boolean(permissions.can_manage_holidays);

    await db.run(`
      INSERT INTO admin_permissions (
        employee_id, 
        can_manage_admins, 
        can_view_all_leaves, 
        can_modify_approved_leaves, 
        can_adjust_balances, 
        can_manage_holidays
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        can_manage_admins = VALUES(can_manage_admins),
        can_view_all_leaves = VALUES(can_view_all_leaves),
        can_modify_approved_leaves = VALUES(can_modify_approved_leaves),
        can_adjust_balances = VALUES(can_adjust_balances),
        can_manage_holidays = VALUES(can_manage_holidays)
    `, [employeeId, canManageAdmins, canViewAllLeaves, canModifyApprovedLeaves, canAdjustBalances, canManageHolidays]);

    res.json({
      success: "true",
      message: 'Admin permissions updated successfully',
      data: {
        employee_id: employeeId,
        permissions: {
          can_manage_admins: canManageAdmins,
          can_view_all_leaves: canViewAllLeaves,
          can_modify_approved_leaves: canModifyApprovedLeaves,
          can_adjust_balances: canAdjustBalances,
          can_manage_holidays: canManageHolidays
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 6. DELETE /api/admin/admins/:employeeId - Demote an Admin to regular employee
router.delete('/admins/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (String(req.user.employee_id) === String(employeeId)) {
      return res.status(400).json({ success: "false", message: 'You cannot remove your own admin status' });
    }

    // Demote employee back to regular 'employee'
    await db.run("UPDATE employees SET role = 'employee' WHERE employee_id = ?", [employeeId]);

    // Delete permissions record
    await db.run("DELETE FROM admin_permissions WHERE employee_id = ?", [employeeId]);

    res.json({
      success: "true",
      message: 'Admin status removed; employee returned to regular role',
      data: { employee_id: employeeId }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
