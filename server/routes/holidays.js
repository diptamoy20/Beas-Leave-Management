const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const db = require('../config/db');
const { auth, isManager } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

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

router.post('/upload', auth, isManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const year = req.body.year || new Date().getFullYear();
    
    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    let imported = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Try to parse different column name variations
        const date = row.DATE || row.Date || row.date || row['Date'] || '';
        const day = row.DAY || row.Day || row.day || row['Day'] || '';
        const purpose = row.PURPOSE || row.Purpose || row.purpose || row['Purpose'] || '';
        const type = row.TYPE || row.Type || row.type || row['Type'] || 'General';
        const numberOfDays = row['NUMBER OF DAYS'] || row['Number of Days'] || row.number_of_days || row.days || 1;

        if (!date || !purpose) {
          errors.push(`Row ${i + 1}: Missing date or purpose`);
          continue;
        }

        // Parse date
        let parsedDate;
        if (typeof date === 'number') {
          // Excel serial date
          const excelEpoch = new Date(1899, 11, 30);
          parsedDate = new Date(excelEpoch.getTime() + date * 86400000);
        } else {
          parsedDate = new Date(date);
        }

        if (isNaN(parsedDate.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format`);
          continue;
        }

        const formattedDate = parsedDate.toISOString().split('T')[0];

        await db.run(
          'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
          [formattedDate, day, purpose, type, numberOfDays, year]
        );
        
        imported++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    res.json({ 
      message: `Successfully imported ${imported} holidays`,
      imported,
      errors: errors.length > 0 ? errors : undefined
    });
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

router.delete('/year/:year', auth, isManager, async (req, res) => {
  try {
    const { year } = req.params;
    await db.run('DELETE FROM holidays WHERE year = ?', [year]);
    res.json({ message: `All holidays for ${year} deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
