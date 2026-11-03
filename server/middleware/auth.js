const jwt = require('jsonwebtoken');
const db = require('../config/db');

const ADMIN_ROLES = ['super_admin', 'admin_1', 'admin_2', 'admin_3', 'admin'];

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: 'false', message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Fetch up-to-date role from database in case role changed
    const [rows] = await db.query(
      'SELECT role FROM employees WHERE id = ?',
      [decoded.id]
    );

    if (rows && rows.length > 0) {
      req.user.role = rows[0].role;
    }

    // If user has an admin role, fetch permissions from admin_permissions table
    if (ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'super_admin') {
        req.user.permissions = {
          can_manage_admins: true,
          can_view_all_leaves: true,
          can_modify_approved_leaves: true,
          can_adjust_balances: true,
          can_manage_holidays: true,
        };
      } else {
        const [permRows] = await db.query(
          'SELECT can_manage_admins, can_view_all_leaves, can_modify_approved_leaves, can_adjust_balances, can_manage_holidays FROM admin_permissions WHERE employee_id = ?',
          [req.user.employee_id]
        );

        if (permRows && permRows.length > 0) {
          req.user.permissions = {
            can_manage_admins: Boolean(permRows[0].can_manage_admins),
            can_view_all_leaves: Boolean(permRows[0].can_view_all_leaves),
            can_modify_approved_leaves: Boolean(permRows[0].can_modify_approved_leaves),
            can_adjust_balances: Boolean(permRows[0].can_adjust_balances),
            can_manage_holidays: Boolean(permRows[0].can_manage_holidays),
          };
        } else {
          // Default fallback permissions based on tier
          req.user.permissions = {
            can_manage_admins: false,
            can_view_all_leaves: true,
            can_modify_approved_leaves: req.user.role === 'admin_1' || req.user.role === 'admin',
            can_adjust_balances: req.user.role === 'admin_1',
            can_manage_holidays: req.user.role === 'admin_1' || req.user.role === 'admin',
          };
        }
      }
    } else {
      req.user.permissions = {};
    }

    next();
  } catch (error) {
    res.status(401).json({ success: 'false', message: 'Token is not valid' });
  }
};

const isManager = (req, res, next) => {
  if (req.user.role !== 'manager' && !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: 'false', message: 'Access denied. Manager role required.' });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: 'false', message: 'Access denied. Admin role required.' });
  }
  next();
};

const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: 'false', message: 'Access denied. Super Admin role required.' });
  }
  next();
};

const hasPermission = (permissionName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: 'false', message: 'Unauthorized' });
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    if (req.user.permissions && req.user.permissions[permissionName]) {
      return next();
    }

    return res.status(403).json({
      success: 'false',
      message: `Access denied. Requires '${permissionName}' permission.`
    });
  };
};

module.exports = {
  auth,
  isManager,
  isAdmin,
  isSuperAdmin,
  hasPermission,
  ADMIN_ROLES
};
