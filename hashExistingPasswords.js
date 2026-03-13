require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, run, pool } = require('./server/config/db');

async function hashPasswords() {
  try {
    console.log('\n=== Hashing Existing Passwords ===\n');
    
    // Get all employees with plain text passwords
    const [employees] = await query('SELECT id, employee_id, name, password FROM employees');
    
    console.log(`Found ${employees.length} employees`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const emp of employees) {
      // Check if password is already hashed
      if (emp.password.startsWith('$2a$') || emp.password.startsWith('$2b$')) {
        console.log(`✓ Skipped ${emp.name} (${emp.employee_id}) - already hashed`);
        skipped++;
        continue;
      }
      
      // Hash the plain text password
      const hashedPassword = await bcrypt.hash(emp.password, 10);
      
      // Update in database
      await run('UPDATE employees SET password = ? WHERE id = ?', [hashedPassword, emp.id]);
      
      console.log(`✓ Updated ${emp.name} (${emp.employee_id})`);
      updated++;
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total employees: ${employees.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already hashed): ${skipped}`);
    
    await pool.end();
    console.log('\n✓ Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

hashPasswords();
