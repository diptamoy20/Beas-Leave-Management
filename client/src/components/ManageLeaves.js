import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ManageLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/leaves/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaves(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (leaveId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/leaves/${leaveId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error updating status:', error);
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

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div>
      <div className="top-bar">
        <h1>Manage Leave Requests</h1>
      </div>
      
      <div className="card">
        {leaves.length === 0 ? (
          <p>No leave requests found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(leave => (
                <tr key={leave.id}>
                  <td>{leave.employee_name}</td>
                  <td>{leave.department}</td>
                  <td>{leave.leave_type}</td>
                  <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                  <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                  <td>{leave.reason}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td>
                    {leave.status === 'Pending' ? (
                      <div className="action-icons">
                        <button
                          className="btn btn-success"
                          onClick={() => handleStatusUpdate(leave.id, 'Approved')}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleStatusUpdate(leave.id, 'Rejected')}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ManageLeaves;
