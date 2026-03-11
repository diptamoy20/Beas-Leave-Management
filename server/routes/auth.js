const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { employee_id, name, email, password, department, role } = req.body;
    
    const [existingEmail] = await db.query('SELECT * FROM employees WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const [existingEmpId] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [employee_id]);
    if (existingEmpId.length > 0) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.run(
      'INSERT INTO employees (employee_id, name, email, password, department, role) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_id, name, email, hashedPassword, department, role || 'employee']
    );

    await db.run(
      'INSERT INTO leave_balance (employee_id, casual_leave, sick_leave, paid_leave) VALUES (?, 12, 10, 15)',
      [result.insertId]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // Check if identifier is email or employee_id
    const [users] = await db.query(
      'SELECT * FROM employees WHERE email = ? OR employee_id = ?',
      [identifier, identifier]
    );
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, employee_id, name, email, department, role FROM employees WHERE id = ?', [req.user.id]);
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
