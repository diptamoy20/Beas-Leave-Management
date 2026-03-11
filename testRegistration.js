const axios = require('axios');

async function testRegistration() {
  try {
    console.log('Testing registration...');
    
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test User New',
      email: 'testnew@test.com',
      password: 'password123',
      department: 'HR',
      role: 'employee'
    });
    
    console.log('✅ Registration successful:', response.data);
  } catch (error) {
    console.error('❌ Registration failed:', error.response?.data || error.message);
  }
}

testRegistration();
