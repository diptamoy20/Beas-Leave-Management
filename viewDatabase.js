const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database/leave_management.db');
const db = new sqlite3.Database(dbPath);

console.log('\n=== LEAVE MANAGEMENT DATABASE ===\n');

// View Employees
db.all('SELECT * FROM employees', [], (err, rows) => {
  if (err) {
    console.error('Error fetching employees:', err);
    return;
  }
  console.log('📊 EMPLOYEES:');
  console.table(rows);
});

// View Leave Requests
db.all('SELECT * FROM leave_requests', [], (err, rows) => {
  if (err) {
    console.error('Error fetching leave requests:', err);
    return;
  }
  console.log('\n📋 LEAVE REQUESTS:');
  console.table(rows);
});

// View Leave Balance
db.all('SELECT * FROM leave_balance', [], (err, rows) => {
  if (err) {
    console.error('Error fetching leave balance:', err);
    return;
  }
  console.log('\n💰 LEAVE BALANCE:');
  console.table(rows);
});

// View Attendance
db.all('SELECT * FROM attendance', [], (err, rows) => {
  if (err) {
    console.error('Error fetching attendance:', err);
    return;
  }
  console.log('\n⏰ ATTENDANCE:');
  console.table(rows);
});

// View Holidays
db.all('SELECT * FROM holidays ORDER BY date', [], (err, rows) => {
  if (err) {
    console.error('Error fetching holidays:', err);
    return;
  }
  console.log('\n📅 HOLIDAYS:');
  console.table(rows);
  
  // Close database after last query
  db.close();
});
