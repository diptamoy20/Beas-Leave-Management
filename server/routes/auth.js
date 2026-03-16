const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Login route - authenticate with employee_id/email and password
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
    
    // Check if password is hashed or plain text
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      // Password is hashed
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Password is plain text (for existing data)
      isMatch = password === user.password;
    }
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, employee_id: user.employee_id, email: user.email, role: user.role },
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

// Reset password route
router.post('/reset-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get current user
    const [users] = await db.query('SELECT * FROM employees WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    
    // Verify current password
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = currentPassword === user.password;
    }
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.run(
      'UPDATE employees SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Forgot password - verify employee and reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Find user by email or employee_id
    const [users] = await db.query(
      'SELECT * FROM employees WHERE email = ? OR employee_id = ?',
      [identifier, identifier]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const user = users[0];
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.run(
      'UPDATE employees SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ 
      message: 'Password reset successfully',
      employee: {
        name: user.name,
        email: user.email,
        employee_id: user.employee_id
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
