const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = "SELECT e.id, e.name, e.email, e.designation, e.employee_id, e.role FROM employees e";
    let params = [];

    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      query += " WHERE e.role = ?";
      params.push('manager');
    }

    const [employees] = await db.query(query, params);

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
