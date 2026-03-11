const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, isManager, async (req, res) => {
  try {
    const [employees] = await db.query(
      'SELECT e.id, e.name, e.email, e.department, e.role, lb.casual_leave, lb.sick_leave, lb.paid_leave FROM employees e LEFT JOIN leave_balance lb ON e.id = lb.employee_id'
    );
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
