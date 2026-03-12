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
  }, []);

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/attendance/my-attendance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(response.data);
      
      const today = response.data.find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
      );
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
      selector: (row) => new Date(row.date).toLocaleDateString(),
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
      name: 'Duration',
      selector: (row) => {
        if (row.clock_in && row.clock_out) {
          const diff = new Date(row.clock_out) - new Date(row.clock_in);
          const hours = Math.floor(diff / 3600000);
          const minutes = Math.floor((diff % 3600000) / 60000);
          return `${hours}h ${minutes}m`;
        }
        return '-';
      },
    },
  ];

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Attendance</h4>
      
      <Row className="mb-4">
        <Col lg={4}>
          <Card className="dashboard-card text-center">
            <Card.Body>
              <h5 className="mb-3">Today's Attendance</h5>
              <div className="d-flex gap-2 justify-content-center">
                <Button
                  variant="success"
                  onClick={handleClockIn}
                  disabled={clockedIn}
                >
                  Clock In
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClockOut}
                  disabled={!clockedIn}
                >
                  Clock Out
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
