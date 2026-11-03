import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Modal, Badge, Alert, Spinner } from 'react-bootstrap';
import { useSelector } from 'react-redux';
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
  FiPlus,
  FiCheck,
  FiX,
  FiUser,
  FiShield,
  FiList
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ISSUE_TYPES = [
  'Missed In-Punch',
  'Missed Out-Punch',
  'Both Punches Missed',
  'Late Arrival Waive-Off',
  'Early Departure Waive-Off',
  'On-Duty / Client Visit',
  'Work From Home Regularization',
  'Other Correction'
];

const Attendance = () => {
  const { user } = useSelector((state) => state.auth);
  const isManagerOrAdmin =
    user?.role === 'manager' ||
    ['super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance', 'my_waiveoffs', 'approvals', 'audit'
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Waive-Off Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDate, setRequestDate] = useState('');
  const [requestType, setRequestType] = useState(ISSUE_TYPES[0]);
  const [proposedIn, setProposedIn] = useState('09:30');
  const [proposedOut, setProposedOut] = useState('18:30');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Review Modal State (Manager/Admin)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedWaiveOff, setSelectedWaiveOff] = useState(null);
  const [reviewAction, setReviewAction] = useState('Approved'); // 'Approved' | 'Rejected'
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Data lists
  const [myWaiveOffs, setMyWaiveOffs] = useState([]);
  const [managerWaiveOffs, setManagerWaiveOffs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    // default range: last 30 days
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 29));
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    setFromDate(startStr);
    setToDate(endStr);
    fetchAttendance(startStr, endStr);
    fetchMyWaiveOffs();

    if (isManagerOrAdmin) {
      fetchManagerWaiveOffs();
      fetchAuditLogs();
    }
  }, [isManagerOrAdmin]);

  const fetchAttendance = async (from = null, to = null) => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get('/api/attendance/my-attendance', {
        headers: getAuthHeaders(),
        params,
      });
      const rows = res.data.data?.rows || res.data.data || [];
      setAttendance(rows);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyWaiveOffs = async () => {
    try {
      const res = await axios.get('/api/attendance/waive-off/my-requests', {
        headers: getAuthHeaders()
      });
      setMyWaiveOffs(res.data.data?.requests || []);
    } catch (err) {
      console.error('Error fetching my waive-offs:', err);
    }
  };

  const fetchManagerWaiveOffs = async () => {
    try {
      const res = await axios.get('/api/attendance/waive-off/all', {
        headers: getAuthHeaders()
      });
      setManagerWaiveOffs(res.data.data?.requests || []);
    } catch (err) {
      console.error('Error fetching manager waive-offs:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/api/attendance/waive-off/audit', {
        headers: getAuthHeaders()
      });
      setAuditLogs(res.data.data?.logs || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
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

  const openRequestModal = (prefillDate = '') => {
    setRequestDate(prefillDate || new Date().toISOString().slice(0, 10));
    setRequestType(ISSUE_TYPES[0]);
    setProposedIn('09:30');
    setProposedOut('18:30');
    setRequestReason('');
    setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!requestDate) {
      alert('Please select a date.');
      return;
    }
    if (!requestReason.trim()) {
      alert('Please enter a reason for attendance correction.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await axios.post(
        '/api/attendance/waive-off/request',
        {
          date: requestDate,
          waive_off_type: requestType,
          proposed_clock_in: proposedIn,
          proposed_clock_out: proposedOut,
          reason: requestReason
        },
        { headers: getAuthHeaders() }
      );
      setMessage(res.data.message || 'Waive-off request submitted successfully!');
      setShowRequestModal(false);
      fetchMyWaiveOffs();
      if (isManagerOrAdmin) {
        fetchManagerWaiveOffs();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit waive-off request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const openReviewModal = (item, action) => {
    setSelectedWaiveOff(item);
    setReviewAction(action);
    setReviewRemarks('');
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWaiveOff) return;

    setSubmittingReview(true);
    try {
      const res = await axios.put(
        `/api/attendance/waive-off/${selectedWaiveOff.id}/review`,
        {
          status: reviewAction,
          review_remarks: reviewRemarks
        },
        { headers: getAuthHeaders() }
      );
      setMessage(res.data.message || 'Waive-off review completed successfully!');
      setShowReviewModal(false);
      fetchManagerWaiveOffs();
      fetchAuditLogs();
      fetchAttendance(fromDate, toDate);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '—';
    if (typeof timeString === 'string' && timeString.length <= 8) return timeString;
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

  const getWaiveOffBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return <Badge bg="success">Approved</Badge>;
    if (s === 'rejected') return <Badge bg="danger">Rejected</Badge>;
    return <Badge bg="warning" text="dark">Pending Approval</Badge>;
  };

  // Columns for main attendance list
  const attendanceColumns = [
    {
      name: 'Date',
      selector: (row) => row.date,
      sortable: true,
      width: '150px',
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
      width: '130px',
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
      width: '130px',
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
      width: '130px',
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
      cell: (row) => (
        <div>
          {getStatusBadge(row.status)}
          {row.is_waived_off && (
            <div className="mt-1">
              <Badge bg="info" text="dark" style={{ fontSize: '0.68rem' }}>
                Waived-Off
              </Badge>
            </div>
          )}
        </div>
      ),
    },
    {
      name: 'Leave Note / Special',
      selector: (row) => row.leave_type,
      sortable: true,
      grow: 1,
      cell: (row) => (
        <span className="text-muted small">
          {row.isLeave ? row.leave_type || 'Leave' : row.holiday_type ? `${row.holiday_type} - ${row.holiday_purpose}` : '—'}
        </span>
      ),
    },
    {
      name: 'Waive-Off Action',
      width: '160px',
      right: true,
      cell: (row) => {
        const isAbsentOrMissing = row.status === 'absent' || !row.clock_in || !row.clock_out;
        if (row.status === 'holiday' || row.isLeave) {
          return <span className="text-muted small">—</span>;
        }
        return (
          <Button
            size="sm"
            variant={isAbsentOrMissing ? 'outline-primary' : 'light'}
            style={{ borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', padding: '4px 10px' }}
            onClick={() => openRequestModal(row.date)}
            title="Request attendance correction/waive-off for this day"
          >
            <FiShield size={12} className="me-1" />
            Waive-Off
          </Button>
        );
      },
    },
  ];

  // Columns for My Waive-Off Requests
  const myWaiveOffColumns = [
    {
      name: 'Date',
      selector: (row) => row.date,
      sortable: true,
      width: '140px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="text-muted" size={13} />
          <strong>{formatDate(row.date)}</strong>
        </div>
      ),
    },
    {
      name: 'Issue Type',
      selector: (row) => row.waive_off_type,
      sortable: true,
      width: '180px',
      cell: (row) => <strong>{row.waive_off_type}</strong>,
    },
    {
      name: 'Proposed Timings',
      width: '180px',
      cell: (row) => (
        <span className="small">
          {row.proposed_clock_in || '09:30'} → {row.proposed_clock_out || '18:30'}
        </span>
      ),
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      grow: 2,
      cell: (row) => (
        <span className="text-truncate d-inline-block" style={{ maxWidth: '280px' }} title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '140px',
      cell: (row) => getWaiveOffBadge(row.status),
    },
    {
      name: 'Reviewer Remarks',
      selector: (row) => row.review_remarks,
      grow: 1,
      cell: (row) => (
        <span className="text-muted small">
          {row.review_remarks || (row.reviewer_name ? `Reviewed by ${row.reviewer_name}` : '—')}
        </span>
      ),
    },
    {
      name: 'Submitted On',
      selector: (row) => row.created_at,
      sortable: true,
      width: '140px',
      cell: (row) => <span className="text-muted small">{formatDate(row.created_at)}</span>,
    },
  ];

  // Columns for Manager Review
  const managerReviewColumns = [
    {
      name: 'Employee',
      selector: (row) => row.employee_name,
      sortable: true,
      width: '200px',
      cell: (row) => (
        <div>
          <div className="fw-bold">{row.employee_name}</div>
          <div className="text-muted small">{row.employee_designation || `ID: ${row.employee_id}`}</div>
        </div>
      ),
    },
    {
      name: 'Date',
      selector: (row) => row.date,
      sortable: true,
      width: '130px',
      cell: (row) => <strong>{formatDate(row.date)}</strong>,
    },
    {
      name: 'Issue Type',
      selector: (row) => row.waive_off_type,
      sortable: true,
      width: '180px',
      cell: (row) => <Badge bg="secondary">{row.waive_off_type}</Badge>,
    },
    {
      name: 'Proposed Punch',
      width: '160px',
      cell: (row) => (
        <span className="small">
          {row.proposed_clock_in || '09:30'} to {row.proposed_clock_out || '18:30'}
        </span>
      ),
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      grow: 2,
      cell: (row) => (
        <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '240px' }} title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '130px',
      cell: (row) => getWaiveOffBadge(row.status),
    },
    {
      name: 'Actions',
      width: '180px',
      right: true,
      cell: (row) =>
        row.status === 'Pending' ? (
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="success"
              style={{ borderRadius: '8px', fontSize: '0.78rem', padding: '4px 8px', fontWeight: '600' }}
              onClick={() => openReviewModal(row, 'Approved')}
            >
              <FiCheck size={12} className="me-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              style={{ borderRadius: '8px', fontSize: '0.78rem', padding: '4px 8px', fontWeight: '600' }}
              onClick={() => openReviewModal(row, 'Rejected')}
            >
              <FiX size={12} className="me-1" />
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted small">Reviewed</span>
        ),
    },
  ];

  // Columns for Audit Log
  const auditColumns = [
    {
      name: 'Request ID',
      selector: (row) => row.id,
      sortable: true,
      width: '110px',
      cell: (row) => <strong>#{row.id}</strong>,
    },
    {
      name: 'Employee',
      selector: (row) => row.employee_name,
      sortable: true,
      width: '180px',
      cell: (row) => (
        <div>
          <div>{row.employee_name}</div>
          <small className="text-muted">ID: {row.employee_id}</small>
        </div>
      ),
    },
    {
      name: 'Date',
      selector: (row) => row.date,
      sortable: true,
      width: '130px',
      cell: (row) => formatDate(row.date),
    },
    {
      name: 'Type',
      selector: (row) => row.waive_off_type,
      sortable: true,
      width: '160px',
      cell: (row) => <span className="small fw-semibold">{row.waive_off_type}</span>,
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      grow: 2,
      cell: (row) => <span className="small text-truncate d-inline-block" style={{ maxWidth: '200px' }} title={row.reason}>{row.reason}</span>,
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '120px',
      cell: (row) => getWaiveOffBadge(row.status),
    },
    {
      name: 'Reviewed By',
      selector: (row) => row.reviewer_name,
      sortable: true,
      width: '160px',
      cell: (row) => (
        <span className="small">
          {row.reviewer_name || 'Pending Review'}
        </span>
      ),
    },
    {
      name: 'Remarks',
      selector: (row) => row.review_remarks,
      grow: 1,
      cell: (row) => <span className="small text-muted">{row.review_remarks || '—'}</span>,
    },
    {
      name: 'Reviewed At',
      selector: (row) => row.reviewed_at,
      sortable: true,
      width: '140px',
      cell: (row) => <span className="small text-muted">{formatDate(row.reviewed_at)}</span>,
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
            <span className="active">Attendance & Waive-Off</span>
          </div>
          <h2 className="elh-page-title">Attendance & Waive-Off Management</h2>
          <p className="elh-page-subtitle">
            Track daily logs, request attendance corrections for missed punches or duty visits, and manage approvals.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => openRequestModal()}
          style={{
            borderRadius: '12px',
            padding: '10px 18px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FiPlus size={16} />
          <span>Request Waive-Off</span>
        </Button>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)} className="mb-4">
          <FiCheckCircle className="me-2" />
          {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
          <FiAlertCircle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 border-bottom mb-4 pb-2">
        <Button
          variant={activeTab === 'attendance' ? 'primary' : 'outline-secondary'}
          size="sm"
          style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
          onClick={() => setActiveTab('attendance')}
        >
          <FiClock className="me-1" />
          My Attendance Logs
        </Button>

        <Button
          variant={activeTab === 'my_waiveoffs' ? 'primary' : 'outline-secondary'}
          size="sm"
          style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
          onClick={() => setActiveTab('my_waiveoffs')}
        >
          <FiFileText className="me-1" />
          My Waive-Off Requests ({myWaiveOffs.length})
        </Button>

        {isManagerOrAdmin && (
          <>
            <Button
              variant={activeTab === 'approvals' ? 'primary' : 'outline-secondary'}
              size="sm"
              style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
              onClick={() => setActiveTab('approvals')}
            >
              <FiShield className="me-1" />
              Waive-Off Approvals (
              {managerWaiveOffs.filter((r) => r.status === 'Pending').length})
            </Button>

            <Button
              variant={activeTab === 'audit' ? 'primary' : 'outline-secondary'}
              size="sm"
              style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
              onClick={() => setActiveTab('audit')}
            >
              <FiList className="me-1" />
              Audit Log ({auditLogs.length})
            </Button>
          </>
        )}
      </div>

      {/* TAB 1: Main Attendance Logs */}
      {activeTab === 'attendance' && (
        <>
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
                    <span>Reset</span>
                  </Button>
                  <div className="ms-auto elh-count-pill">
                    <FiFileText size={14} />
                    <span>{attendance?.length || 0} Days</span>
                  </div>
                </Col>
              </Row>
            </Form>
          </div>

          {/* Table Container */}
          <div className="elh-table-card">
            <DataTable
              columns={attendanceColumns}
              data={attendance || []}
              progressPending={loading}
              pagination
              paginationPerPage={20}
              paginationRowsPerPageOptions={[10, 20, 30, 50]}
            />
          </div>
        </>
      )}

      {/* TAB 2: My Waive-Off Requests */}
      {activeTab === 'my_waiveoffs' && (
        <div className="elh-table-card">
          <DataTable
            columns={myWaiveOffColumns}
            data={myWaiveOffs || []}
            pagination
            paginationPerPage={15}
            noDataComponent={<div className="p-4 text-muted">No waive-off requests submitted yet.</div>}
          />
        </div>
      )}

      {/* TAB 3: Manager Waive-Off Approvals */}
      {activeTab === 'approvals' && (
        <div className="elh-table-card">
          <DataTable
            columns={managerReviewColumns}
            data={managerWaiveOffs || []}
            pagination
            paginationPerPage={15}
            noDataComponent={<div className="p-4 text-muted">No pending waive-off requests to review.</div>}
          />
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="elh-table-card">
          <DataTable
            columns={auditColumns}
            data={auditLogs || []}
            pagination
            paginationPerPage={20}
            noDataComponent={<div className="p-4 text-muted">No audit logs recorded yet.</div>}
          />
        </div>
      )}

      {/* MODAL: Submit Attendance Waive-Off Request */}
      <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} centered>
        <Form onSubmit={handleRequestSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
              <FiShield className="me-2 text-primary" />
              Request Attendance Waive-Off
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Date of Issue</Form.Label>
              <Form.Control
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
              <Form.Text className="text-muted">
                Select the day you missed punching or arrived late.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Issue / Correction Type</Form.Label>
              <Form.Select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row className="g-2 mb-3">
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Proposed Clock In</Form.Label>
                  <Form.Control
                    type="time"
                    value={proposedIn}
                    onChange={(e) => setProposedIn(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Proposed Clock Out</Form.Label>
                  <Form.Control
                    type="time"
                    value={proposedOut}
                    onChange={(e) => setProposedOut(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Reason / Justification</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                required
                placeholder="Explain why you could not punch (e.g. Biometric device malfunction, client meeting outside office, medical emergency)..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
            </Form.Group>

            <Alert variant="info" className="small py-2 mb-0">
              <FiAlertCircle className="me-1" />
              Note: Attendance records and daily hours will update only after approval by your Manager or Admin.
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRequestModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingRequest}>
              {submittingRequest ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL: Review Waive-Off Request (Manager/Admin) */}
      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered>
        <Form onSubmit={handleReviewSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
              {reviewAction === 'Approved' ? (
                <span className="text-success">
                  <FiCheck className="me-2" />
                  Approve Attendance Waive-Off
                </span>
              ) : (
                <span className="text-danger">
                  <FiX className="me-2" />
                  Reject Attendance Waive-Off
                </span>
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedWaiveOff && (
              <div className="bg-light p-3 rounded mb-3">
                <div className="fw-bold">{selectedWaiveOff.employee_name}</div>
                <div className="text-muted small">
                  Date: <strong>{formatDate(selectedWaiveOff.date)}</strong> | Type: <strong>{selectedWaiveOff.waive_off_type}</strong>
                </div>
                <div className="text-muted small">
                  Proposed Times: <strong>{selectedWaiveOff.proposed_clock_in || '09:30'}</strong> to <strong>{selectedWaiveOff.proposed_clock_out || '18:30'}</strong>
                </div>
                <div className="mt-2 small text-dark">
                  <em>"{selectedWaiveOff.reason}"</em>
                </div>
              </div>
            )}

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Review Remarks / Comments (Optional)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Enter review notes or reasons..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
              />
            </Form.Group>

            {reviewAction === 'Approved' ? (
              <Alert variant="success" className="small py-2 mb-0">
                <FiCheckCircle className="me-1" />
                Approving this request will immediately mark the employee Present/Regularized and update attendance hours for this date in the audit ledger.
              </Alert>
            ) : (
              <Alert variant="warning" className="small py-2 mb-0">
                <FiAlertCircle className="me-1" />
                Rejecting will keep the attendance record unchanged.
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'Approved' ? 'success' : 'danger'}
              type="submit"
              disabled={submittingReview}
            >
              {submittingReview ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Processing...
                </>
              ) : (
                `Confirm ${reviewAction}`
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Attendance;
