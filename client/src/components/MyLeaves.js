import React, { useEffect, useState } from 'react';
import { Form, Modal, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaves } from '../store/slices/leaveSlice';
import DataTable from './common/DataTable';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  FiCalendar,
  FiSearch,
  FiX,
  FiPlus,
  FiEye,
  FiCheckCircle,
  FiAlertCircle,
  FiRotateCcw
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const MyLeaves = () => {
  const dispatch = useDispatch();
  const { leaves, loading } = useSelector((state) => state.leave);
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      dispatch(fetchLeaves(searchTerm));
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [dispatch, searchTerm]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
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

  const openCancelModal = (leave) => {
    setSelectedLeave(leave);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    if (!cancellationReason.trim()) {
      alert('Please provide a reason for cancelling this leave.');
      return;
    }

    setSubmittingCancel(true);
    try {
      const res = await axios.post(
        `/api/leaves/${selectedLeave.id}/cancel`,
        { cancellation_reason: cancellationReason.trim() },
        { headers: getAuthHeaders() }
      );
      setMessage(res.data.message || 'Leave cancelled successfully. Balance refunded if applicable.');
      setShowCancelModal(false);
      dispatch(fetchLeaves(searchTerm));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel leave');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const columns = [
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '170px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="text-muted" size={14} />
          <strong>{row.leave_type || 'Leave'}</strong>
        </div>
      ),
    },
    {
      name: 'Date Period',
      sortable: true,
      width: '230px',
      selector: (row) => row.start_date,
      cell: (row) => (
        <div>
          <span>
            {formatDate(row.start_date)}
            {row.end_date && row.end_date !== row.start_date ? ` → ${formatDate(row.end_date)}` : ''}
          </span>
          {row.is_modified_on_approval && (
            <div className="text-warning small" style={{ fontSize: '0.72rem' }}>
              Originally: {formatDate(row.original_start_date)} → {formatDate(row.original_end_date)}
            </div>
          )}
        </div>
      ),
    },
    {
      name: 'Duration',
      selector: (row) => row.no_of_days,
      sortable: true,
      width: '130px',
      cell: (row) => (
        <div>
          <span className="fw-semibold text-primary">
            {row.no_of_days} Day{Number(row.no_of_days) !== 1 ? 's' : ''}
          </span>
          {row.is_modified_on_approval && (
            <div>
              <Badge bg="warning" text="dark" style={{ fontSize: '0.68rem' }} title={row.approval_edit_reason}>
                Modified by Approver
              </Badge>
            </div>
          )}
        </div>
      ),
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
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '140px',
      cell: (row) => (
        <div>
          {getStatusBadge(row.status)}
          {row.cancellation_reason && (
            <div className="text-muted small" style={{ fontSize: '0.7rem' }} title={row.cancellation_reason}>
              Note: {row.cancellation_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      name: 'Applied On',
      selector: (row) => row.created_at,
      sortable: true,
      width: '130px',
      cell: (row) => <span className="text-muted small">{formatDate(row.created_at)}</span>,
    },
    {
      name: 'Actions',
      width: '180px',
      right: true,
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="elh-table-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/leave-details/${row.id}`);
            }}
            title="View leave application details"
          >
            <FiEye size={13} />
            <span>Details</span>
          </button>

          {(row.status === 'Pending' || row.status === 'Approved') && (
            <Button
              size="sm"
              variant="outline-danger"
              style={{ borderRadius: '8px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '600' }}
              onClick={(e) => {
                e.stopPropagation();
                openCancelModal(row);
              }}
              title="Cancel this leave request"
            >
              <FiX size={12} className="me-1" />
              Cancel
            </Button>
          )}
        </div>
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
            <span className="active">My Leaves</span>
          </div>
          <h2 className="elh-page-title">My Leave Requests</h2>
          <p className="elh-page-subtitle">
            Track applied leaves, review approvals or day adjustments, and cancel requests when schedules change.
          </p>
        </div>

        <Link
          to="/apply-leave"
          className="elh-back-btn"
          style={{
            background: 'var(--secondary-color)',
            color: '#ffffff',
            borderColor: 'var(--secondary-color)',
            textDecoration: 'none',
          }}
        >
          <FiPlus size={16} />
          <span>Apply for Leave</span>
        </Link>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)} className="mb-4">
          <FiCheckCircle className="me-2" />
          {message}
        </Alert>
      )}

      {/* Toolbar / Search */}
      <div className="elh-toolbar-card mb-4">
        <div className="elh-search-input-wrap">
          <FiSearch className="elh-search-icon" size={17} />
          <Form.Control
            type="text"
            className="elh-search-input"
            placeholder="Search by leave type, reason, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="elh-search-clear-btn" onClick={() => setSearchTerm('')}>
              <FiX size={14} />
            </button>
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
          paginationPerPage={15}
          paginationRowsPerPageOptions={[10, 15, 25, 50]}
          onRowClicked={(row) => navigate(`/leave-details/${row.id}`)}
        />
      </div>

      {/* MODAL: Cancel Leave Modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Form onSubmit={handleCancelSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }} className="text-danger">
              <FiRotateCcw className="me-2" />
              Cancel Leave Request
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedLeave && (
              <div className="bg-light p-3 rounded mb-3">
                <div className="fw-bold">{selectedLeave.leave_type} (#{selectedLeave.id})</div>
                <div className="text-muted small">
                  Dates: <strong>{formatDate(selectedLeave.start_date)}</strong> to{' '}
                  <strong>{formatDate(selectedLeave.end_date)}</strong> ({selectedLeave.no_of_days} Day(s))
                </div>
                <div className="text-muted small mt-1">
                  Current Status: <strong>{selectedLeave.status}</strong>
                </div>
              </div>
            )}

            {selectedLeave?.status === 'Approved' ? (
              <Alert variant="warning" className="small py-2 mb-3">
                <FiAlertCircle className="me-1" />
                This leave was already Approved. Cancelling will <strong>automatically refund {selectedLeave.no_of_days} day(s)</strong> back to your balance quota.
              </Alert>
            ) : (
              <p className="text-muted small mb-3">
                Are you sure you want to cancel this pending leave request?
              </p>
            )}

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Reason for Cancellation</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                required
                placeholder="State why you are cancelling this leave (e.g. Plans postponed, working on project deliverables)..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={submittingCancel || !cancellationReason.trim()}
            >
              {submittingCancel ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default MyLeaves;
