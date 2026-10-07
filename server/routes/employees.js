const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = "SELECT e.id, e.name, e.email, e.designation, e.employee_id, e.role FROM employees e";
    let params = [];
    const conditions = [];

    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      conditions.push("e.role = ?");
      params.push('manager');
    }

    if (req.query.search) {
      conditions.push("(e.name LIKE ? OR e.employee_id LIKE ?)");
      const searchPattern = `%${req.query.search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY e.name ASC";

    const [employees] = await db.query(query, params);

    res.json({ success: "true", message: "Employees fetched successfully", data: { employees } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error' });
  }
});

module.exports = router;
