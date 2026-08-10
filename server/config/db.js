const mysql = require('mysql2/promise');

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leave_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database');

    // Create employees table (include both department and designation for compatibility)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        designation VARCHAR(255),
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leave_requests table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        leave_type VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // Create leave_approvals table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leave_id INT NOT NULL,
        manager_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (leave_id) REFERENCES leave_requests(id) ON DELETE CASCADE
      )
    `);

    // Create leave_balance table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_balance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        casual_leave INT DEFAULT 12,
        sick_leave INT DEFAULT 10,
        paid_leave INT DEFAULT 15,
        restricted_leave INT DEFAULT 3,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // Create attendance table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        date DATE NOT NULL,
        clock_in DATETIME,
        clock_out DATETIME,
        total_time INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
      )
    `);

    // Ensure total_time column exists for existing installs
    // (create table won't add new columns once the table already exists)
    const [attendanceColumns] = await connection.query(
      "SHOW COLUMNS FROM attendance LIKE 'total_time'"
    );
    if (!attendanceColumns || attendanceColumns.length === 0) {
      await connection.query('ALTER TABLE attendance ADD COLUMN total_time INT DEFAULT NULL');
      console.log('✅ Added attendance.total_time column');
    }

    // Ensure designation column exists for existing installs and migrate data
    const [designationColumns] = await connection.query("SHOW COLUMNS FROM employees LIKE 'designation'");
    if (!designationColumns || designationColumns.length === 0) {
      await connection.query('ALTER TABLE employees ADD COLUMN designation VARCHAR(255)');
      console.log('✅ Added employees.designation column');
    }

    // If department values exist and designation is empty, copy department -> designation
    try {
      const [deptColumns] = await connection.query("SHOW COLUMNS FROM employees LIKE 'department'");
      if (deptColumns && deptColumns.length > 0) {
        await connection.query(
          "UPDATE employees SET designation = department WHERE (designation IS NULL OR designation = '') AND (department IS NOT NULL AND department <> '')"
        );
        console.log('✅ Migrated department -> designation for existing employees where applicable');
      }
    } catch (e) {
      // Non-fatal; log and continue
      console.warn('Could not migrate department -> designation automatically:', e.message || e);
    }

    // Create holidays table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        day VARCHAR(50) NOT NULL,
        purpose TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'General',
        number_of_days INT DEFAULT 1,
        year INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create roles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leave_master table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leave_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed leave_master
    await connection.query(`
      INSERT IGNORE INTO leave_master (leave_name, description) VALUES
      ('Earned leave', 'Standard earned leave balance'),
      ('Quarterly leave', 'Early leave once per quarter')
    `);

    // Ensure earned_leave, quarterly_leave and restricted_leave columns exist in leave_balance for existing installs
    const [balanceColumns] = await connection.query("SHOW COLUMNS FROM leave_balance");
    const balanceColNames = balanceColumns.map(col => col.Field);
    
    if (!balanceColNames.includes('earned_leave')) {
      await connection.query('ALTER TABLE leave_balance ADD COLUMN earned_leave INT DEFAULT 0');
      console.log('✅ Added leave_balance.earned_leave column');
    }
    
    if (!balanceColNames.includes('quarterly_leave')) {
      await connection.query('ALTER TABLE leave_balance ADD COLUMN quarterly_leave INT DEFAULT 1');
      console.log('✅ Added leave_balance.quarterly_leave column');
    }

    if (!balanceColNames.includes('restricted_leave')) {
      await connection.query('ALTER TABLE leave_balance ADD COLUMN restricted_leave INT DEFAULT 3');
      console.log('✅ Added leave_balance.restricted_leave column');
    }

    // Ensure duration and is_restricted columns exist in leave_requests
    const [requestColumns] = await connection.query("SHOW COLUMNS FROM leave_requests");
    const requestColNames = requestColumns.map(col => col.Field);
    
    if (!requestColNames.includes('duration')) {
      await connection.query("ALTER TABLE leave_requests ADD COLUMN duration VARCHAR(50) DEFAULT 'Full Day'");
      console.log('✅ Added leave_requests.duration column');
    }
    
    if (!requestColNames.includes('is_restricted')) {
      await connection.query('ALTER TABLE leave_requests ADD COLUMN is_restricted BOOLEAN DEFAULT FALSE');
      console.log('✅ Added leave_requests.is_restricted column');
    }

    if (!requestColNames.includes('rejection_reason')) {
      await connection.query('ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT');
      console.log('✅ Added leave_requests.rejection_reason column');
    }

    // Change manager_id to VARCHAR to support multiple IDs
    try {
      const managerCol = requestColumns.find(c => c.Field === 'manager_id');
      if (managerCol && managerCol.Type.toLowerCase().includes('int')) {
        try {
          await connection.query('ALTER TABLE leave_requests DROP FOREIGN KEY fk_manager');
          console.log('✅ Dropped fk_manager');
        } catch(e) {
           // Ignore if it doesn't exist
        }
        await connection.query('ALTER TABLE leave_requests MODIFY manager_id VARCHAR(255)');
        console.log('✅ Modified leave_requests.manager_id to VARCHAR(255)');
      }
    } catch (e) {
      console.warn('Could not modify manager_id:', e.message || e);
    }

    // Change leave_balance columns to DECIMAL to support half days
    try {
      const earnedCol = balanceColumns.find(c => c.Field === 'earned_leave');
      if (earnedCol && earnedCol.Type.toLowerCase().includes('int')) {
        await connection.query('ALTER TABLE leave_balance MODIFY earned_leave DECIMAL(5,1) DEFAULT 0');
        await connection.query('ALTER TABLE leave_balance MODIFY casual_leave DECIMAL(5,1) DEFAULT 12');
        await connection.query('ALTER TABLE leave_balance MODIFY sick_leave DECIMAL(5,1) DEFAULT 10');
        await connection.query('ALTER TABLE leave_balance MODIFY paid_leave DECIMAL(5,1) DEFAULT 15');
        console.log('✅ Modified leave balances to DECIMAL');
      }
    } catch (e) {
      console.warn('Could not modify leave balance types:', e.message || e);
    }


    // Seed roles
    await connection.query(`
      INSERT IGNORE INTO roles (name, description) VALUES
      ('employee', 'Regular Employee'),
      ('manager', 'Manager'),
      ('admin', 'Administrator'),
      ('hr', 'Human Resources'),
      ('ceo', 'Chief Executive Officer')
    `);


    connection.release();
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Query method - returns rows (compatible with existing code)
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return [rows];
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Run method - for INSERT, UPDATE, DELETE (compatible with existing code)
const run = async (sql, params = []) => {
  try {
    const [result] = await pool.execute(sql, params);
    return [{
      insertId: result.insertId,
      affectedRows: result.affectedRows
    }];
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
};

// Initialize database on module load
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

module.exports = { query, run, pool };