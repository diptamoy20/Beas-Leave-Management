const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { PDFParse } = require('pdf-parse');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

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

// Permission check: allow super_admin, admin tiers, HR, or custom permission
const canManageHolidays = (req, res, next) => {
  const role = req.user?.role;
  const allowedRoles = ['super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3', 'hr'];
  if (allowedRoles.includes(role) || req.user?.permissions?.can_manage_holidays) {
    return next();
  }
  return res.status(403).json({ success: "false", message: 'Access denied. Admin, Super Admin, or HR role required.' });
};

// Configure multer for Excel, CSV, and PDF uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/pdf',
      'application/octet-stream'
    ];
    const isAllowedExt =
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls') ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.pdf');

    if (allowedTypes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls), CSV (.csv), and PDF (.pdf) files are allowed'));
    }
  }
});

// Helper: parse date string or Excel serial number to YYYY-MM-DD
function parseToISODate(rawDate, targetYear) {
  if (!rawDate) return null;

  // 1. Excel serial date number
  if (typeof rawDate === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + rawDate * 86400000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  const str = String(rawDate).trim();

  // 2. Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Textual formats like "1. Jan. 2027", "26 Jan 2027", "10 March"
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const textMatch = str.match(/(\d{1,2})\.?\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthKey = textMatch[2].substring(0, 3).toLowerCase();
    const month = monthMap[monthKey];
    const year = textMatch[3] || targetYear || new Date().getFullYear();
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // 5. Standard Date parse fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// Helper: parse holidays from PDF text
async function parseHolidaysFromPdf(buffer, fallbackYear) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const text = result?.text || '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const holidays = [];
  let currentType = 'General';
  let detectedYear = fallbackYear;

  // Check if text mentions a year like "for the year 2027"
  const yearMatch = text.match(/\b(202\d)\b/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[1]);
  }

  const dayRegex = /\b(Monday|Tuesday|Wednesday|Thursday|Thrusday|Friday|Saturday|Sunday)\b/i;

  for (const line of lines) {
    // Check if section header changes to Restricted
    if (/restricted\s*holiday/i.test(line)) {
      currentType = 'Restricted';
      continue;
    }

    const dayMatch = line.match(dayRegex);
    if (!dayMatch) continue;

    let day = dayMatch[1];
    if (day.toLowerCase() === 'thrusday') day = 'Thursday'; // handle common typo in official memos

    const beforeDay = line.substring(0, dayMatch.index).trim().replace(/^\d+\.?\s+/, '');
    const afterDay = line.substring(dayMatch.index + dayMatch[0].length).trim();

    // The days count is usually the trailing number, e.g. "New Year 1"
    const daysMatch = afterDay.match(/\s+(\d+(?:\.\d+)?)$/);
    const numberOfDays = daysMatch ? parseFloat(daysMatch[1]) : 1;
    const purpose = daysMatch ? afterDay.substring(0, daysMatch.index).trim() : afterDay;

    const formattedDate = parseToISODate(beforeDay, detectedYear);

    if (formattedDate && purpose) {
      const year = parseInt(formattedDate.split('-')[0]) || detectedYear;
      holidays.push({
        date: formattedDate,
        day,
        purpose,
        type: currentType,
        number_of_days: numberOfDays,
        year
      });
    }
  }

  return holidays;
}

// GET /api/holidays - List holidays for a specific year
router.get('/', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [holidays] = await db.query(
      'SELECT * FROM holidays WHERE year = ? ORDER BY date ASC',
      [year]
    );

    const employeeId = req.user?.employee_id;
    let balance = null;
    if (employeeId) {
      const [balanceByEmpId] = await db.query(
        'SELECT * FROM leave_balance WHERE employee_id = ?',
        [employeeId]
      );
      if (balanceByEmpId.length > 0) balance = balanceByEmpId[0];
    }
    const totalLeave = (balance?.casual_leave || 12) + (balance?.sick_leave || 10) + (balance?.paid_leave || 15);
    const balanceLeave = balance?.earned_leave || 14; 
    const earlyLeave = balance?.quarterly_leave !== undefined ? balance.quarterly_leave : 3;

    holidays.forEach(h => {
      h.date = toLocalYMD(h.date);
    });

    res.json({
      success: "true",
      message: "Holiday fetch successfully",
      data: {
        holidayPeriod: `Jan ${year} - Dec ${year}`,
        leaveSummary: {
          totalLeave: String(totalLeave),
          balanceLeave: String(balanceLeave),
          earlyLeave: String(earlyLeave)
        },
        holidayData: holidays
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// GET /api/holidays/template - Download sample upload template
router.get('/template', auth, canManageHolidays, (req, res) => {
  const templatePath = path.join(__dirname, '../../HOLIDAY_UPLOAD_TEMPLATE.xlsx');
  if (fs.existsSync(templatePath)) {
    return res.download(templatePath, 'Holiday_Upload_Template.xlsx');
  }

  // Generate on the fly if file not found
  const sampleData = [
    { DATE: '2027-01-01', DAY: 'Friday', PURPOSE: 'New Year', TYPE: 'General', 'NUMBER OF DAYS': 1 },
    { DATE: '2027-01-26', DAY: 'Tuesday', PURPOSE: 'Republic Day', TYPE: 'General', 'NUMBER OF DAYS': 1 },
    { DATE: '2027-03-10', DAY: 'Wednesday', PURPOSE: 'Id-ul-Fitr (Eid)', TYPE: 'Restricted', 'NUMBER OF DAYS': 1 }
  ];
  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Holidays');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="Holiday_Upload_Template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
});

// POST /api/holidays/upload - Upload and import Excel (.xlsx, .xls, .csv) or PDF (.pdf)
router.post('/upload', auth, canManageHolidays, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: "false", message: 'No file uploaded' });
    }

    const defaultYear = parseInt(req.body.year) || new Date().getFullYear();
    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');

    let parsedList = [];
    let errors = [];

    if (isPdf) {
      // Parse PDF
      try {
        parsedList = await parseHolidaysFromPdf(req.file.buffer, defaultYear);
        if (parsedList.length === 0) {
          return res.status(400).json({
            success: "false",
            message: 'Could not extract any holiday rows from the PDF. Please ensure the PDF contains a readable text table or upload an Excel file.'
          });
        }
      } catch (pdfErr) {
        return res.status(400).json({
          success: "false",
          message: 'Failed to parse PDF: ' + pdfErr.message
        });
      }
    } else {
      // Parse Excel / CSV
      try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = xlsx.utils.sheet_to_json(worksheet);

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rawDate = row.DATE || row.Date || row.date || row['Date'] || '';
          const day = row.DAY || row.Day || row.day || row['Day'] || '';
          const purpose = row.PURPOSE || row.Purpose || row.purpose || row['Purpose'] || row.HOLIDAY || row.Holiday || '';
          const type = row.TYPE || row.Type || row.type || row['Type'] || 'General';
          const numberOfDays = row['NUMBER OF DAYS'] || row['Number of Days'] || row.number_of_days || row.days || row.Days || 1;

          if (!rawDate || !purpose) {
            errors.push(`Row ${i + 1}: Missing date or purpose`);
            continue;
          }

          const formattedDate = parseToISODate(rawDate, defaultYear);
          if (!formattedDate) {
            errors.push(`Row ${i + 1}: Invalid date format (${rawDate})`);
            continue;
          }

          const year = parseInt(formattedDate.split('-')[0]) || defaultYear;
          parsedList.push({
            date: formattedDate,
            day: String(day).trim(),
            purpose: String(purpose).trim(),
            type: String(type).trim().toLowerCase().includes('restricted') ? 'Restricted' : 'General',
            number_of_days: Number(numberOfDays) || 1,
            year
          });
        }
      } catch (excelErr) {
        return res.status(400).json({
          success: "false",
          message: 'Failed to read Excel/CSV file: ' + excelErr.message
        });
      }
    }

    let imported = 0;
    for (const h of parsedList) {
      try {
        // Upsert by date: if holiday already exists on this date, update purpose and type
        const [existing] = await db.query('SELECT id FROM holidays WHERE date = ?', [h.date]);
        if (existing.length > 0) {
          await db.run(
            'UPDATE holidays SET day = ?, purpose = ?, type = ?, number_of_days = ?, year = ? WHERE id = ?',
            [h.day, h.purpose, h.type, h.number_of_days, h.year, existing[0].id]
          );
        } else {
          await db.run(
            'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
            [h.date, h.day, h.purpose, h.type, h.number_of_days, h.year]
          );
        }
        imported++;
      } catch (insertErr) {
        errors.push(`${h.date} (${h.purpose}): ${insertErr.message}`);
      }
    }

    res.json({
      success: "true",
      message: `Successfully imported ${imported} holidays from ${req.file.originalname}`,
      data: {
        imported,
        total: parsedList.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// POST /api/holidays - Add single holiday
router.post('/', auth, canManageHolidays, async (req, res) => {
  try {
    const { date, day, purpose, type, number_of_days, year } = req.body;
    const targetYear = year || (date ? parseInt(date.split('-')[0]) : new Date().getFullYear());
    
    const [result] = await db.run(
      'INSERT INTO holidays (date, day, purpose, type, number_of_days, year) VALUES (?, ?, ?, ?, ?, ?)',
      [date, day, purpose, type || 'General', number_of_days || 1, targetYear]
    );

    res.status(201).json({ success: "true", message: 'Holiday added successfully', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// PUT /api/holidays/:id - Edit holiday
router.put('/:id', auth, canManageHolidays, async (req, res) => {
  try {
    const { date, day, purpose, type, number_of_days, year } = req.body;
    const { id } = req.params;
    const targetYear = year || (date ? parseInt(date.split('-')[0]) : undefined);

    if (targetYear) {
      await db.run(
        'UPDATE holidays SET date = ?, day = ?, purpose = ?, type = ?, number_of_days = ?, year = ? WHERE id = ?',
        [date, day, purpose, type, number_of_days, targetYear, id]
      );
    } else {
      await db.run(
        'UPDATE holidays SET date = ?, day = ?, purpose = ?, type = ?, number_of_days = ? WHERE id = ?',
        [date, day, purpose, type, number_of_days, id]
      );
    }

    res.json({ success: "true", message: 'Holiday updated successfully', data: {} });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// DELETE /api/holidays/:id - Delete holiday
router.delete('/:id', auth, canManageHolidays, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM holidays WHERE id = ?', [id]);
    res.json({ success: "true", message: 'Holiday deleted successfully', data: {} });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// DELETE /api/holidays/year/:year - Clear all holidays for a year
router.delete('/year/:year', auth, canManageHolidays, async (req, res) => {
  try {
    const { year } = req.params;
    await db.run('DELETE FROM holidays WHERE year = ?', [year]);
    res.json({ success: "true", message: `All holidays for ${year} deleted successfully`, data: {} });
  } catch (error) {
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
