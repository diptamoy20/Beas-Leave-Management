import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchAttendance();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/attendance/my-attendance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendance(response.data);
      
      const today = response.data.find(a => 
        new Date(a.date).toDateString() === new Date().toDateString()
      );
      setTodayAttendance(today);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleClockIn = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/attendance/clock-in', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAttendance();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/attendance/clock-out', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAttendance();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to clock out');
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const calculateWorkHours = (inTime, outTime) => {
    if (!inTime || !outTime) return '--';
    const diff = new Date(outTime) - new Date(inTime);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div>
      <div className="top-bar">
        <h1>Attendance</h1>
        <div className="user-info">
          <span style={{fontSize: '14px', color: '#6b7280'}}>
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="attendance-card">
        <div className="attendance-info">
          <h3>Current Time</h3>
          <div className="attendance-time">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          {todayAttendance && (
            <div className="time-display">
              <div className="time-item">
                <div className="time-label">Clock In</div>
                <div className="time-value">{formatTime(todayAttendance.clock_in)}</div>
              </div>
              {todayAttendance.clock_out && (
                <div className="time-item">
                  <div className="time-label">Clock Out</div>
                  <div className="time-value">{formatTime(todayAttendance.clock_out)}</div>
                </div>
              )}
              {todayAttendance.clock_out && (
                <div className="time-item">
                  <div className="time-label">Work Hours</div>
                  <div className="time-value">
                    {calculateWorkHours(todayAttendance.clock_in, todayAttendance.clock_out)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="attendance-actions">
          {!todayAttendance && (
            <button className="btn btn-clock" onClick={handleClockIn}>
              🕐 Clock In
            </button>
          )}
          {todayAttendance && !todayAttendance.clock_out && (
            <button className="btn btn-clock" onClick={handleClockOut}>
              🕐 Clock Out
            </button>
          )}
          {todayAttendance && todayAttendance.clock_out && (
            <div style={{color: 'white', fontSize: '14px', padding: '12px 24px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px'}}>
              ✅ Attendance marked for today
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Attendance History</h2>
        </div>
        <div className="table-container">
          {attendance.length === 0 ? (
            <div className="empty-state">
              <p>No attendance records found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Work Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{formatTime(record.clock_in)}</td>
                    <td>{formatTime(record.clock_out)}</td>
                    <td>{calculateWorkHours(record.clock_in, record.clock_out)}</td>
                    <td>
                      <span className={`badge ${record.clock_out ? 'badge-present' : 'badge-pending'}`}>
                        {record.clock_out ? 'Complete' : 'In Progress'}
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

export default Attendance;
