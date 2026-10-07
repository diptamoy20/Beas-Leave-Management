import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';
import {
  FiCalendar,
  FiClock,
  FiFilter,
  FiRotateCcw,
  FiCheckCircle,
  FiAlertCircle,
  FiFileText,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    // default range: last 30 days
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 29));
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    setFromDate(startStr);
    setToDate(endStr);
    fetchAttendance(startStr, endStr);

    // Poll so biometric device sync updates reflect automatically
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
      const res = await axios.get('/api/attendance/my-attendance', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const rows = res.data.data?.rows || res.data.data || [];
      setAttendance(rows);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    fetchAttendance(fromDate, toDate);
  };

  const handleReset = (e) => {
    e?.preventDefault();
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 29));
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    setFromDate(startStr);
    setToDate(endStr);
    fetchAttendance(startStr, endStr);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '—';
    const d = new Date(timeString);
    if (isNaN(d.getTime())) return timeString;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    let badgeClass = 'pending';
    let label = status || 'Present';

    if (s === 'present') {
      badgeClass = 'approved';
      label = 'Present';
    } else if (s === 'absent') {
      badgeClass = 'rejected';
      label = 'Absent';
    } else if (s === 'holiday') {
      badgeClass = 'pending';
      label = 'Holiday';
    } else if (s.includes('leave')) {
      badgeClass = 'pending';
      label = 'On Leave';
    }

    return (
      <span className={`elh-status-badge ${badgeClass}`}>
        <span className="elh-status-dot" />
        <span>{label}</span>
      </span>
    );
  };

  const columns = [
    {
      name: 'Date',
      selector: (row) => row.date,
      sortable: true,
      width: '160px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="text-muted" size={13} />
          <strong>{formatDate(row.date)}</strong>
        </div>
      ),
    },
    {
      name: 'Clock In',
      selector: (row) => row.clock_in,
      sortable: true,
      width: '140px',
      cell: (row) => (
        <span className={row.clock_in ? 'text-dark fw-semibold' : 'text-muted'}>
          {formatTime(row.clock_in)}
        </span>
      ),
    },
    {
      name: 'Clock Out',
      selector: (row) => row.clock_out,
      sortable: true,
      width: '140px',
      cell: (row) => (
        <span className={row.clock_out ? 'text-dark fw-semibold' : 'text-muted'}>
          {formatTime(row.clock_out)}
        </span>
      ),
    },
    {
      name: 'Total Time',
      selector: (row) => row.total_time,
      sortable: true,
      width: '140px',
      cell: (row) => {
        const minutes = row.total_time;
        if (minutes == null) return <span className="text-muted">—</span>;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return (
          <span className="badge bg-light text-primary border fw-semibold">
            <FiClock size={11} className="me-1" />
            {h}h {m}m
          </span>
        );
      },
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '140px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Leave Note',
      selector: (row) => row.leave_type,
      sortable: true,
      grow: 1,
      cell: (row) => (
        <span className="text-muted small">
          {row.isLeave ? row.leave_type || 'Leave' : row.leave_type || '—'}
        </span>
      ),
    },
    {
      name: 'Holiday / Special',
      sortable: true,
      grow: 1,
      cell: (row) => (
        <span className="text-muted small">
          {row.holiday_type
            ? `${row.holiday_type}${row.holiday_purpose ? ` - ${row.holiday_purpose}` : ''}`
            : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span className="active">Attendance</span>
          </div>
          <h2 className="elh-page-title">My Attendance History</h2>
          <p className="elh-page-subtitle">
            Review your daily check-in and check-out logs, total working hours, and leave records.
          </p>
        </div>
      </div>

      {/* Date Range Filter Card */}
      <div className="elh-toolbar-card mb-4">
        <Form onSubmit={handleSearch} className="w-100">
          <Row className="align-items-end g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-muted mb-1">From Date</Form.Label>
                <Form.Control
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-muted mb-1">To Date</Form.Label>
                <Form.Control
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
                />
              </Form.Group>
            </Col>
            <Col md={6} className="d-flex align-items-center gap-2">
              <Button
                variant="primary"
                type="submit"
                style={{
                  borderRadius: '12px',
                  height: '42px',
                  padding: '0 20px',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiFilter size={15} />
                <span>Filter Records</span>
              </Button>
              <Button
                variant="outline-secondary"
                onClick={handleReset}
                style={{
                  borderRadius: '12px',
                  height: '42px',
                  padding: '0 16px',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiRotateCcw size={15} />
                <span>Reset Range</span>
              </Button>
              <div className="ms-auto elh-count-pill">
                <FiFileText size={14} />
                <span>{attendance?.length || 0} Days Logged</span>
              </div>
            </Col>
          </Row>
        </Form>
      </div>

      {/* Table Container */}
      <div className="elh-table-card">
        <DataTable
          columns={columns}
          data={attendance || []}
          progressPending={loading}
          pagination
          paginationPerPage={20}
          paginationRowsPerPageOptions={[10, 20, 30, 50]}
        />
      </div>
    </div>
  );
};

export default Attendance;
