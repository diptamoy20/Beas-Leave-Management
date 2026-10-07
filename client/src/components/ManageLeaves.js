import React, { useEffect, useState, useMemo } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';
import LeaveDetails from './LeaveDetails';
import {
  FiSearch,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiFileText,
  FiCalendar,
  FiClock,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ManageLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState(null);
  const [rejectLeaveDays, setRejectLeaveDays] = useState(0);
  const [rejectReason, setRejectReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchAllLeaves(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchAllLeaves = async (search = '') => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (search) params.search = search;

      const response = await axios.get('/api/leaves/all', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setLeaves(response.data.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (leaveId, noOfDays, status, rejection_reason = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/leaves/${leaveId}/status`,
        { noOfDays, status, rejection_reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAllLeaves(searchTerm);
    } catch (error) {
      console.error('Error updating leave:', error);
      alert(error.response?.data?.message || 'Failed to update leave');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusClass = (status || 'pending').toLowerCase();
    return (
      <span className={`elh-status-badge ${statusClass}`}>
        <span className="elh-status-dot" />
        <span>{status || 'Pending'}</span>
      </span>
    );
  };

  const getAvatarGradient = (name) => {
    const gradients = [
      'linear-gradient(135deg, #1f4e5f, #2f7f8f)',
      'linear-gradient(135deg, #219a6b, #157347)',
      'linear-gradient(135deg, #d7a24a, #b07d2b)',
      'linear-gradient(135deg, #cc5a3f, #a73e27)',
      'linear-gradient(135deg, #7c5cbf, #5a3e99)',
    ];
    const charCode = name ? name.charCodeAt(0) : 0;
    return gradients[charCode % gradients.length];
  };

  const pendingCount = useMemo(() => {
    return (leaves || []).filter((l) => (l.status || '').toLowerCase() === 'pending').length;
  }, [leaves]);

  const columns = [
    {
      name: 'Employee',
      selector: (row) => row.employee_name,
      sortable: true,
      width: '230px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <div
            className="elh-table-avatar"
            style={{
              width: '34px',
              height: '34px',
              fontSize: '0.85rem',
              background: getAvatarGradient(row.employee_name),
            }}
          >
            {row.employee_name ? row.employee_name.trim().charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <div className="fw-semibold text-truncate" style={{ maxWidth: '160px' }}>
              {row.employee_name}
            </div>
            <div className="text-muted small text-truncate" style={{ maxWidth: '160px', fontSize: '0.74rem' }}>
              {row.designation || 'Employee'}
            </div>
          </div>
        </div>
      ),
    },
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '160px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="text-muted" size={13} />
          <strong>{row.leave_type || 'Leave'}</strong>
        </div>
      ),
    },
    {
      name: 'Date Period',
      sortable: true,
      width: '240px',
      selector: (row) => row.start_date,
      cell: (row) => (
        <span>
          {formatDate(row.start_date)}
          {row.end_date && row.end_date !== row.start_date ? ` → ${formatDate(row.end_date)}` : ''}
        </span>
      ),
    },
    {
      name: 'Duration',
      selector: (row) => row.no_of_days,
      sortable: true,
      width: '110px',
      cell: (row) => (
        <span className="fw-semibold text-primary">
          {row.no_of_days} Day{Number(row.no_of_days) !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '140px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      sortable: true,
      grow: 2,
      cell: (row) => (
        <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '240px' }} title={row.reason}>
          {row.reason || '—'}
        </span>
      ),
    },
    {
      name: 'Actions',
      width: '220px',
      right: true,
      cell: (row) =>
        row.status === 'Pending' ? (
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="success"
              style={{ borderRadius: '10px', padding: '5px 5px', fontSize: '0.8rem', fontWeight: '600' }}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(row.id, row.no_of_days, 'Approved');
              }}
            >
              <FiCheck size={14} className="me-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              style={{ borderRadius: '10px', padding: '5px 5px', fontSize: '0.8rem', fontWeight: '600' }}
              onClick={(e) => {
                e.stopPropagation();
                setRejectLeaveId(row.id);
                setRejectLeaveDays(row.no_of_days);
                setRejectReason('');
                setShowRejectModal(true);
              }}
            >
              <FiX size={14} className="me-1" />
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted small">Reviewed</span>
        ),
    },
  ];

  if (selectedLeave) {
    return <LeaveDetails leave={selectedLeave} onBack={() => setSelectedLeave(null)} />;
  }

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Manager Workspace</span>
            <span>/</span>
            <span className="active">Manage Leaves</span>
          </div>
          <h2 className="elh-page-title">Manage Leave Requests</h2>
          <p className="elh-page-subtitle">
            Review submitted leave requests from team members, approve or reject applications, and provide reasons.
          </p>
        </div>
      </div>

      {/* Toolbar: Search & Counters */}
      <div className="elh-toolbar-card">
        <div className="elh-search-box">
          <FiSearch className="elh-search-icon-left" />
          <Form.Control
            type="text"
            placeholder="Search by employee name, leave type, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="elh-search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        <div className="elh-toolbar-actions">
          <div className="elh-count-pill">
            <FiFileText size={15} />
            <span>{leaves?.length || 0} Total Requests</span>
          </div>
          {pendingCount > 0 && (
            <div
              className="elh-count-pill"
              style={{ background: 'rgba(215, 162, 74, 0.15)', color: '#b78120' }}
            >
              <FiClock size={15} />
              <span>{pendingCount} Pending Review</span>
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="elh-table-card">
        <DataTable
          columns={columns}
          data={leaves || []}
          progressPending={loading}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 30]}
          onRowClicked={(row) => setSelectedLeave(row)}
          pointerOnHover
          highlightOnHover
        />
      </div>

      {/* Reject Reason Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '1px solid var(--light-border)' }}>
          <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
            Reject Leave Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Please provide a rationale or reason for rejecting this leave request. This will be shared with the employee.
          </p>
          <Form>
            <Form.Group>
              <Form.Label className="fw-semibold small">Reason for Rejection</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid var(--light-border)' }}>
          <Button
            variant="secondary"
            style={{ borderRadius: '12px' }}
            onClick={() => setShowRejectModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            style={{ borderRadius: '12px' }}
            onClick={() => {
              handleStatusUpdate(rejectLeaveId, rejectLeaveDays, 'Rejected', rejectReason);
              setShowRejectModal(false);
            }}
            disabled={!rejectReason.trim()}
          >
            Confirm Rejection
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ManageLeaves;
