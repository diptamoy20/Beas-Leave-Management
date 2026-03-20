import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState(false);

  useEffect(() => {
    fetchAttendance();

    // Poll so biometric device sync updates reflect automatically.
    const intervalId = setInterval(() => {
      fetchAttendance();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/attendance/my-attendance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(response.data);

      const todayStr = new Date().toISOString().slice(0, 10);
      const today = response.data.find((a) => String(a.date) === todayStr);
      setClockedIn(today && today.clock_in && !today.clock_out);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/attendance/clock-in', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAttendance();
    } catch (error) {
      console.error('Error clocking in:', error);
    }
  };

  const handleClockOut = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/attendance/clock-out', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAttendance();
    } catch (error) {
      console.error('Error clocking out:', error);
    }
  };

  const columns = [
    {
      name: 'Date',
      selector: (row) => new Date(row.date).toLocaleDateString('en-GB').replace(/\//g, '-'),
      sortable: true,
      width: '150px',
    },
    {
      name: 'Clock In',
      selector: (row) => row.clock_in ? new Date(row.clock_in).toLocaleTimeString() : '-',
      sortable: true,
    },
    {
      name: 'Clock Out',
      selector: (row) => row.clock_out ? new Date(row.clock_out).toLocaleTimeString() : '-',
      sortable: true,
    },
    {
      name: 'Total Time',
      selector: (row) => {
        const minutes = row.total_time;
        if (minutes == null) return '-';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
      },
    },
  ];

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Attendance</h4>
      <Card className="dashboard-card">
        <Card.Body>
          <h5 className="mb-3">Attendance History</h5>
          {loading ? (
            <div className="text-center py-5">Loading...</div>
          ) : (
            <DataTable
              columns={columns}
              data={attendance}
              pagination
              paginationPerPage={10}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Attendance;
