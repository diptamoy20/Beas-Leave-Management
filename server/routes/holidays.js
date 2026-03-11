const express = require('express');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [holidays] = await db.query(
      'SELECT * FROM holidays WHERE year = ? ORDER BY date ASC',
      [year]
    );
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', auth, isManager, async (req, res) => {
  try {
    const { date, day, purpose, type, number_of_days, year } = req.body;
    
    const [result] = await db.run(
      'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
      [date, day, purpose, type || 'General', number_of_days || 1, year || new Date().getFullYear()]
    );

    res.status(201).json({ message: 'Holiday added successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', auth, isManager, async (req, res) => {
  try {
    const { date, day, purpose, type, number_of_days } = req.body;
    const { id } = req.params;

    await db.run(
      'UPDATE holidays SET date = ?, day = ?, purpose = ?, type = ?, number_of_days = ? WHERE id = ?',
      [date, day, purpose, type, number_of_days, id]
    );

    res.json({ message: 'Holiday updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', auth, isManager, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM holidays WHERE id = ?', [id]);
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/bulk', auth, isManager, async (req, res) => {
  try {
    const { holidays } = req.body;
    
    for (const holiday of holidays) {
      await db.run(
        'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
        [holiday.date, holiday.day, holiday.purpose, holiday.type || 'General', holiday.number_of_days || 1, holiday.year]
      );
    }

    res.json({ message: 'Holidays imported successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
