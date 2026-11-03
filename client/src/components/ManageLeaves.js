import React, { useEffect, useState, useMemo } from 'react';
import { Button, Modal, Form, Spinner, Badge, Alert } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';
import LeaveDetails from './LeaveDetails';
import {
  FiSearch,
  FiX,
  FiCheck,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiRotateCcw,
  FiAlertCircle,
  FiCheckCircle,
  FiLayers
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ManageLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState(null);
  const [rejectLeaveDays, setRejectLeaveDays] = useState(0);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel / Revoke Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLeaveId, setCancelLeaveId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Day Edit on Approval Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLeave, setEditLeave] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDuration, setEditDuration] = useState('Full Day');
  const [editDays, setEditDays] = useState(1);
  const [editReason, setEditReason] = useState('');
  const [calculatingDays, setCalculatingDays] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchAllLeaves(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchAllLeaves = async (search = '') => {
    try {
      const params = {};
      if (search) params.search = search;

      const response = await axios.get('/api/leaves/all', {
        headers: getAuthHeaders(),
        params,
      });
      setLeaves(response.data.data.leaves || []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (leaveId, noOfDays, status, rejection_reason = '') => {
    try {
      await axios.put(
        `/api/leaves/${leaveId}/status`,
        { noOfDays, status, rejection_reason },
        { headers: getAuthHeaders() }
      );
      setMessage(`Leave #${leaveId} marked as ${status}.`);
      fetchAllLeaves(searchTerm);
    } catch (err) {
      console.error('Error updating leave:', err);
      alert(err.response?.data?.message || 'Failed to update leave');
    }
  };

  // Open Edit & Approve Modal
  const openEditModal = (leave) => {
    setEditLeave(leave);
    setEditStartDate(leave.start_date || '');
    setEditEndDate(leave.end_date || '');
    setEditDuration(leave.duration || 'Full Day');
    setEditDays(Number(leave.no_of_days || 1));
    setEditReason('');
    setShowEditModal(true);
  };

  // Auto-calculate working days when dates or duration changes
  const handleRecalculateDays = async (start, end, duration) => {
    if (!start || !end) return;
    setCalculatingDays(true);
    try {
      const res = await axios.post(
        '/api/leaves/calculate-days',
        { start_date: start, end_date: end, duration },
        { headers: getAuthHeaders() }
      );
      if (res.data?.data?.days !== undefined) {
        setEditDays(res.data.data.days);
      }
    } catch (err) {
      console.error('Error calculating days:', err);
    } finally {
      setCalculatingDays(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editLeave) return;

    if (!editReason.trim()) {
      alert('Please provide a reason for modifying the leave dates or duration.');
      return;
    }

    setSubmittingEdit(true);
    try {
      await axios.put(
        `/api/leaves/${editLeave.id}/status`,
        {
          status: 'Approved',
          start_date: editStartDate,
          end_date: editEndDate,
          duration: editDuration,
          no_of_days: editDays,
          approval_edit_reason: editReason.trim()
        },
        { headers: getAuthHeaders() }
      );
      setMessage(`Leave #${editLeave.id} approved with updated dates (${editDays} days).`);
      setShowEditModal(false);
      fetchAllLeaves(searchTerm);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve modified leave');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Cancel / Revoke Leave
  const openCancelModal = (leaveId) => {
    setCancelLeaveId(leaveId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelLeaveId) return;

    setSubmittingCancel(true);
    try {
      await axios.post(
        `/api/leaves/${cancelLeaveId}/cancel`,
        { cancellation_reason: cancelReason.trim() || 'Revoked by Manager' },
        { headers: getAuthHeaders() }
      );
      setMessage(`Leave #${cancelLeaveId} has been revoked/cancelled and balances refunded.`);
      setShowCancelModal(false);
      fetchAllLeaves(searchTerm);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel leave');
    } finally {
      setSubmittingCancel(false);
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

  const columns = [
    {
      name: 'Employee',
      selector: (row) => row.employee_name,
      sortable: true,
      width: '220px',
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
            <div className="fw-semibold text-truncate" style={{ maxWidth: '150px' }}>
              {row.employee_name}
            </div>
            <div className="text-muted small text-truncate" style={{ maxWidth: '150px', fontSize: '0.74rem' }}>
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
      width: '150px',
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
                Modified from {row.original_no_of_days}d
              </Badge>
            </div>
          )}
        </div>
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
      name: 'Reason',
      selector: (row) => row.reason,
      sortable: true,
      grow: 1,
      cell: (row) => (
        <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '180px' }} title={row.reason}>
          {row.reason || '—'}
        </span>
      ),
    },
    {
      name: 'Actions',
      width: '270px',
      right: true,
      cell: (row) => (
        <div className="d-flex gap-1 align-items-center">
          {row.status === 'Pending' && (
            <>
              <Button
                size="sm"
                variant="success"
                style={{ borderRadius: '8px', padding: '4px 8px', fontSize: '0.76rem', fontWeight: '600' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate(row.id, row.no_of_days, 'Approved');
                }}
                title="Approve as requested"
              >
                <FiCheck size={12} className="me-1" />
                Approve
              </Button>

              <Button
                size="sm"
                variant="outline-primary"
                style={{ borderRadius: '8px', padding: '4px 8px', fontSize: '0.76rem', fontWeight: '600' }}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(row);
                }}
                title="Edit leave dates or duration before approving"
              >
                <FiEdit3 size={12} className="me-1" />
                Edit & Approve
              </Button>

              <Button
                size="sm"
                variant="danger"
                style={{ borderRadius: '8px', padding: '4px 8px', fontSize: '0.76rem', fontWeight: '600' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectLeaveId(row.id);
                  setRejectLeaveDays(row.no_of_days);
                  setRejectReason('');
                  setShowRejectModal(true);
                }}
                title="Reject request"
              >
                <FiX size={12} className="me-1" />
                Reject
              </Button>
            </>
          )}

          {row.status === 'Approved' && (
            <Button
              size="sm"
              variant="outline-danger"
              style={{ borderRadius: '8px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: '600' }}
              onClick={(e) => {
                e.stopPropagation();
                openCancelModal(row.id);
              }}
              title="Revoke approved leave and refund balance"
            >
              <FiRotateCcw size={12} className="me-1" />
              Revoke
            </Button>
          )}

          {(row.status === 'Rejected' || row.status === 'Cancelled') && (
            <span className="text-muted small">Reviewed</span>
          )}
        </div>
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
            Review team submissions, adjust leave dates upon approval, or revoke approved leaves with automatic balance recalculation.
          </p>
        </div>
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
            placeholder="Search by employee name, leave type, or reason..."
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
          onRowClicked={(row) => setSelectedLeave(row)}
        />
      </div>

      {/* MODAL 1: Day Edit & Approve Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Form onSubmit={handleEditSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
              <FiEdit3 className="me-2 text-primary" />
              Edit Leave Days & Approve
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editLeave && (
              <div className="bg-light p-3 rounded mb-3">
                <div className="fw-bold">{editLeave.employee_name} ({editLeave.leave_type})</div>
                <div className="text-muted small">
                  Original Request: <strong>{formatDate(editLeave.start_date)}</strong> to{' '}
                  <strong>{formatDate(editLeave.end_date)}</strong> (
                  <span className="text-primary fw-semibold">{editLeave.no_of_days} Day(s)</span>)
                </div>
                <div className="text-muted small mt-1">
                  Stated Reason: <em>"{editLeave.reason || 'None'}"</em>
                </div>
              </div>
            )}

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="fw-semibold small">Approved Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setEditStartDate(newStart);
                      handleRecalculateDays(newStart, editEndDate, editDuration);
                    }}
                  />
                </Form.Group>
              </div>

              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="fw-semibold small">Approved End Date</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={editEndDate}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setEditEndDate(newEnd);
                      handleRecalculateDays(editStartDate, newEnd, editDuration);
                    }}
                  />
                </Form.Group>
              </div>

              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="fw-semibold small">Duration Mode</Form.Label>
                  <Form.Select
                    value={editDuration}
                    onChange={(e) => {
                      const newDur = e.target.value;
                      setEditDuration(newDur);
                      handleRecalculateDays(editStartDate, editEndDate, newDur);
                    }}
                  >
                    <option value="Full Day">Full Day</option>
                    <option value="First Half">First Half (0.5 day)</option>
                    <option value="Second Half">Second Half (0.5 day)</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="fw-semibold small">
                    Recalculated Days to Deduct
                    {calculatingDays && <Spinner size="sm" animation="border" className="ms-2" />}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={editDays}
                    onChange={(e) => setEditDays(Number(e.target.value))}
                  />
                  <Form.Text className="text-muted">
                    Auto-excludes weekends and public holidays. Can be manually adjusted if required.
                  </Form.Text>
                </Form.Group>
              </div>

              <div className="col-md-6">
                <div className="p-3 border rounded bg-light h-100 d-flex flex-column justify-content-center">
                  <div className="small fw-semibold text-muted">Summary of Modification:</div>
                  <div className="fw-bold fs-6 text-primary mt-1">
                    {editLeave?.no_of_days} Day(s) → {editDays} Day(s)
                  </div>
                  <small className="text-muted">
                    Original details will be archived for employee transparency.
                  </small>
                </div>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Approver Modification Note (Mandatory)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                required
                placeholder="Explain why dates or days were modified (e.g. Approved 2 days instead of 3 due to project release)..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submittingEdit || !editReason.trim()}
            >
              {submittingEdit ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Saving...
                </>
              ) : (
                'Approve with Modified Days'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL 2: Reject Reason Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
            Reject Leave Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Please provide a rationale or reason for rejecting this leave request. This will be shared with the employee.
          </p>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
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

      {/* MODAL 3: Revoke / Cancel Approved Leave Modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Form onSubmit={handleCancelSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }} className="text-danger">
              <FiRotateCcw className="me-2" />
              Revoke Approved Leave
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Revoking this leave will mark the request as Cancelled and <strong>automatically restore the employee's deducted balance</strong>.
            </p>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Reason for Revocation</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                required
                placeholder="Enter reason for cancelling/revoking this leave..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
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
              disabled={submittingCancel || !cancelReason.trim()}
            >
              {submittingCancel ? 'Revoking...' : 'Confirm Revocation'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default ManageLeaves;
