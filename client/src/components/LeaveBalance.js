import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LeaveBalance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalance(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div>
      <div className="top-bar">
        <h1>Leave Balance</h1>
      </div>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '30px'}}>
        <div className="card" style={{background: '#e3f2fd'}}>
          <h3>Casual Leave</h3>
          <p style={{fontSize: '48px', fontWeight: 'bold', margin: '20px 0'}}>{balance?.casual_leave || 0}</p>
          <p>days remaining</p>
        </div>
        
        <div className="card" style={{background: '#f3e5f5'}}>
          <h3>Sick Leave</h3>
          <p style={{fontSize: '48px', fontWeight: 'bold', margin: '20px 0'}}>{balance?.sick_leave || 0}</p>
          <p>days remaining</p>
        </div>
        
        <div className="card" style={{background: '#e8f5e9'}}>
          <h3>Paid Leave</h3>
          <p style={{fontSize: '48px', fontWeight: 'bold', margin: '20px 0'}}>{balance?.paid_leave || 0}</p>
          <p>days remaining</p>
        </div>
      </div>

      <div className="card" style={{marginTop: '30px'}}>
        <h3>Leave Policy</h3>
        <ul style={{marginTop: '15px', lineHeight: '1.8'}}>
          <li>Casual Leave: 12 days per year</li>
          <li>Sick Leave: 10 days per year</li>
          <li>Paid Leave: 15 days per year</li>
          <li>Leave requests must be submitted at least 2 days in advance</li>
          <li>Manager approval required for all leave requests</li>
        </ul>
      </div>
    </div>
  );
}

export default LeaveBalance;
