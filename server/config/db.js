const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database/leave_management.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

// Promisified query helper (returns rows)
const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve([rows]);
    });
  });

// Promisified run helper (INSERT/UPDATE/DELETE)
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
    });
  });

module.exports = { query, run, db };


// const mysql = require('mysql2/promise');

// // Create MySQL connection pool
// const pool = mysql.createPool({
//   host: process.env.DB_HOST || 'localhost',
//   port: process.env.DB_PORT || 3306,
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || 'root',
//   database: process.env.DB_NAME || 'leave_management',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// // Initialize database tables
// async function initializeDatabase() {
//   try {
//     const connection = await pool.getConnection();
//     console.log('Connected to MySQL database');

//     // Create employees table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS employees (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         employee_id VARCHAR(255) UNIQUE NOT NULL,
//         name VARCHAR(255) NOT NULL,
//         email VARCHAR(255) UNIQUE NOT NULL,
//         password VARCHAR(255) NOT NULL,
//         department VARCHAR(255),
//         role VARCHAR(50) DEFAULT 'employee',
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Create leave_requests table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS leave_requests (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         employee_id INT NOT NULL,
//         leave_type VARCHAR(100) NOT NULL,
//         start_date DATE NOT NULL,
//         end_date DATE NOT NULL,
//         reason TEXT,
//         status VARCHAR(50) DEFAULT 'Pending',
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
//       )
//     `);

//     // Create leave_balance table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS leave_balance (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         employee_id INT NOT NULL,
//         casual_leave INT DEFAULT 12,
//         sick_leave INT DEFAULT 10,
//         paid_leave INT DEFAULT 15,
//         FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
//       )
//     `);

//     // Create attendance table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS attendance (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         employee_id INT NOT NULL,
//         date DATE NOT NULL,
//         clock_in DATETIME,
//         clock_out DATETIME,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
//       )
//     `);

//     // Create holidays table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS holidays (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         date DATE NOT NULL,
//         day VARCHAR(50) NOT NULL,
//         purpose TEXT NOT NULL,
//         type VARCHAR(50) DEFAULT 'General',
//         number_of_days INT DEFAULT 1,
//         year INT NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     connection.release();
//     console.log('Database tables initialized successfully');
//   } catch (error) {
//     console.error('Database initialization error:', error);
//     throw error;
//   }
// }

// // Query method - returns rows (compatible with existing code)
// const query = async (sql, params = []) => {
//   try {
//     const [rows] = await pool.execute(sql, params);
//     return [rows];
//   } catch (error) {
//     console.error('Query error:', error);
//     throw error;
//   }
// };

// // Run method - for INSERT, UPDATE, DELETE (compatible with existing code)
// const run = async (sql, params = []) => {
//   try {
//     const [result] = await pool.execute(sql, params);
//     return [{
//       insertId: result.insertId,
//       affectedRows: result.affectedRows
//     }];
//   } catch (error) {
//     console.error('Run error:', error);
//     throw error;
//   }
// };

// // Initialize database on module load
// initializeDatabase().catch(err => {
//   console.error('Failed to initialize database:', err);
// });

// module.exports = { query, run, pool };
