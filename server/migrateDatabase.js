const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/leave_management.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting database migration...');

db.serialize(() => {
  // Check if employee_id column exists
  db.all("PRAGMA table_info(employees)", (err, columns) => {
    if (err) {
      console.error('Error checking table structure:', err);
      return;
    }

    const hasEmployeeId = columns.some(col => col.name === 'employee_id');

    if (!hasEmployeeId) {
      console.log('Adding employee_id column...');
      
      // Add employee_id column
      db.run('ALTER TABLE employees ADD COLUMN employee_id TEXT', (err) => {
        if (err) {
          console.error('Error adding employee_id column:', err);
          return;
        }

        // Generate employee IDs for existing users
        db.all('SELECT id, email FROM employees', (err, rows) => {
          if (err) {
            console.error('Error fetching employees:', err);
            return;
          }

          rows.forEach((row, index) => {
            const empId = `EMP${String(row.id).padStart(4, '0')}`;
            db.run('UPDATE employees SET employee_id = ? WHERE id = ?', [empId, row.id], (err) => {
              if (err) {
                console.error(`Error updating employee ${row.id}:`, err);
              } else {
                console.log(`Updated employee ${row.id} with employee_id: ${empId}`);
              }
            });
          });

          // Make employee_id unique after populating
          setTimeout(() => {
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_id ON employees(employee_id)', (err) => {
              if (err) {
                console.error('Error creating unique index:', err);
              } else {
                console.log('Migration completed successfully!');
              }
              db.close();
            });
          }, 1000);
        });
      });
    } else {
      console.log('employee_id column already exists. No migration needed.');
      db.close();
    }
  });
});
