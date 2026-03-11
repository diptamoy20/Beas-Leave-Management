import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ApplyLeave() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    leave_type: 'Casual Leave',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/leaves/apply', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Leave request submitted successfully!');
      setTimeout(() => navigate('/my-leaves'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit leave request');
    }
  };

  return (
    <div>
      <div className="top-bar">
        <h1>Apply for Leave</h1>
      </div>
      <div className="card" style={{maxWidth: '600px'}}>
        <h2 style={{marginBottom: '20px'}}>Leave Application Form</h2>
        {error && <div style={{color: 'red', marginTop: '10px'}}>{error}</div>}
        {success && <div style={{color: 'green', marginTop: '10px'}}>{success}</div>}
        
        <form onSubmit={handleSubmit} style={{marginTop: '20px'}}>
          <div className="form-group">
            <label>Leave Type</label>
            <select
              value={formData.leave_type}
              onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
            >
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Paid Leave">Paid Leave</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({...formData, start_date: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Reason</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              rows="4"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Submit Request</button>
        </form>
      </div>
    </div>
  );
}

export default ApplyLeave;
