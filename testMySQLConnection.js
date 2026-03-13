require('dotenv').config();
const { query, pool } = require('./server/config/db');

async function testConnection() {
  try {
    console.log('Testing MySQL connection...');
    
    // Test basic query
    const [result] = await query('SELECT 1 + 1 AS solution');
    console.log('✓ Connection successful!');
    console.log('Test query result:', result);
    
    // Test employees table
    const [employees] = await query('SELECT COUNT(*) as count FROM employees');
    console.log('✓ Employees table accessible');
    console.log('Total employees:', employees[0].count);
    
    // Close pool
    await pool.end();
    console.log('✓ Connection closed successfully');
    
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
