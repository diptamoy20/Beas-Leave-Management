import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Form } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState(false);

  useEffect(() => {
    // default range: last 30 days
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 29));
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
    fetchAttendance(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));

    // Poll so biometric device sync updates reflect automatically.
    const intervalId = setInterval(() => {
      fetchAttendance();
    }, 100000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchAttendance = async (from = null, to = null) => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get('/api/attendance/my-attendance', { headers: { Authorization: `Bearer ${token}` }, params });
      const rows = res.data.rows || res.data || [];
      setAttendance(rows);

      const todayStr = new Date().toISOString().slice(0, 10);
      const today = rows.find((a) => String(a.date) === todayStr && a.status === 'present');
      setClockedIn(today && today.clock_in && !today.clock_out);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const handleSearch = (e) => {
    e?.preventDefault();
    fetchAttendance(fromDate, toDate);
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
    {
      name: 'Leave',
      selector: (row) => row.isLeave ? row.leave_type || 'Leave' : (row.leave_type || '-'),
      sortable: true,
      width: '200px',
    },
    {
      name: 'Holiday',
      cell: (row) => row.holiday_type ? `${row.holiday_type}${row.holiday_purpose ? ` - ${row.holiday_purpose}` : ''}` : '-',
      sortable: true,
      width: '220px',
    },
  ];

  const conditionalRowStyles = [
    { when: (row) => row.status === 'holiday', style: { backgroundColor: '#e6ffed' } },
    { when: (row) => row.status === 'restricted_leave', style: { backgroundColor: '#ffe6e6' } },
    { when: (row) => row.status === 'taken_leave', style: { backgroundColor: '#e6f0ff' } },
    { when: (row) => row.status === 'absent', style: { backgroundColor: '#f8f9fa' } },
    { when: (row) => row.status === 'present', style: { backgroundColor: '#ffffff' } },
  ];

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Attendance</h4>
      <Card className="dashboard-card">
        <Card.Body>
          <h5 className="mb-3">Attendance History</h5>
          <Form onSubmit={handleSearch} className="mb-3">
            <Row className="align-items-end">
              <Col md={3}>
                <Form.Group>
                  <Form.Label>From</Form.Label>
                  <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>To</Form.Label>
                  <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6} className="d-flex gap-2">
                <Button variant="primary" type="submit">Search</Button>
                <Button variant="outline-secondary" onClick={(e) => { e.preventDefault(); const end = new Date(); const start = new Date(new Date().setDate(end.getDate() - 29)); setFromDate(start.toISOString().slice(0,10)); setToDate(end.toISOString().slice(0,10)); fetchAttendance(start.toISOString().slice(0,10), end.toISOString().slice(0,10)); }}>Reset</Button>
              </Col>
            </Row>
          </Form>
          {loading ? (
            <div className="text-center py-5">Loading...</div>
          ) : (
            <DataTable
              columns={columns}
              data={attendance}
              pagination
              paginationPerPage={10}
              conditionalRowStyles={conditionalRowStyles}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Attendance;
