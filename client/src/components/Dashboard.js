import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard({ user }) {
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [balance, setBalance] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [leavesRes, balanceRes] = await Promise.all([
        axios.get('/api/leaves/my-leaves', config),
        axios.get('/api/leaves/balance', config)
      ]);

      const leaves = leavesRes.data;
      setStats({
        pending: leaves.filter(l => l.status === 'Pending').length,
        approved: leaves.filter(l => l.status === 'Approved').length,
        rejected: leaves.filter(l => l.status === 'Rejected').length
      });
      
      setRecentLeaves(leaves.slice(0, 5));
      setBalance(balanceRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getBadgeClass = (status) => {
    switch(status) {
      case 'Pending': return 'badge-pending';
      case 'Approved': return 'badge-approved';
      case 'Rejected': return 'badge-rejected';
      default: return '';
    }
  };

  return (
    <div>
      <div className="top-bar">
        <div>
          <h1>Dashboard</h1>
          <p style={{color: '#6b7280', marginTop: '4px'}}>Welcome back, {user.name}!</p>
        </div>
        <div className="user-info">
          <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{fontWeight: '600', fontSize: '14px'}}>{user.name}</div>
            <div style={{fontSize: '12px', color: '#6b7280'}}>{user.department}</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-label">Total Available Leaves</div>
          <div className="stat-value">{balance ? balance.casual_leave + balance.sick_leave + balance.paid_leave : 0}</div>
          <div className="stat-sublabel">Across all categories</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Total Sick Leaves</div>
          <div className="stat-value">{balance?.sick_leave || 0}</div>
          <div className="stat-sublabel">Days remaining</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Total Casual Leaves</div>
          <div className="stat-value">{balance?.casual_leave || 0}</div>
          <div className="stat-sublabel">Days remaining</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Total Paid Leaves</div>
          <div className="stat-value">{balance?.paid_leave || 0}</div>
          <div className="stat-sublabel">Days remaining</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Recent Leave Requests</h2>
          <button className="btn btn-primary" onClick={() => window.location.href = '/apply-leave'}>
            + Apply Leave
          </button>
        </div>
        <div className="table-container">
          {recentLeaves.length === 0 ? (
            <div className="empty-state">
              <p>No leave requests yet</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLeaves.map(leave => (
                  <tr key={leave.id}>
                    <td>{leave.leave_type}</td>
                    <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                    <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                    <td>{leave.reason}</td>
                    <td>
                      <span className={`badge ${getBadgeClass(leave.status)}`}>
                        {leave.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
