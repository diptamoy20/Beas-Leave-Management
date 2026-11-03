import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { Modal, Button, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import {
  FiCheckCircle,
  FiSearch,
  FiEdit3,
  FiCalendar,
  FiAlertCircle,
  FiRefreshCw,
  FiInfo
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const STATUS_TABS = ['All', 'Approved', 'Pending', 'Rejected'];

const ApprovedLeavesReview = () => {
  const { user } = useSelector((state) => state.auth);

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Approved');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Modification Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [formStatus, setFormStatus] = useState('Approved');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDays, setFormDays] = useState(1);
  const [adminReason, setAdminReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const canModify = isSuperAdmin || Boolean(user?.permissions?.can_modify_approved_leaves);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/leaves/manager-approved', {
        headers: getAuthHeaders(),
        params: {
          status: activeTab,
          search: search
        }
      });
      setLeaves(res.data.data?.leaves || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch leaves for oversight');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeaves();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  const openModifyModal = (leave) => {
    setSelectedLeave(leave);
    setFormStatus(leave.status || 'Approved');
    setFormStartDate(leave.start_date || '');
    setFormEndDate(leave.end_date || '');
    setFormDays(Number(leave.no_of_days || 1));
    setAdminReason(leave.admin_modification_reason || '');
    setShowModal(true);
  };

  const calculateDaysDiff = () => {
    if (!selectedLeave) return 0;
    const oldDays = Number(selectedLeave.no_of_days || 0);
    const newDays = Number(formDays || 0);
    return oldDays - newDays;
  };

  const handleSubmitModification = async (e) => {
    e.preventDefault();
    if (!adminReason.trim()) {
      alert('Please enter a modification reason for audit tracking.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(
        `/api/leaves/${selectedLeave.id}/admin-modify`,
        {
          status: formStatus,
          start_date: formStartDate,
          end_date: formEndDate,
          no_of_days: Number(formDays),
          admin_modification_reason: adminReason
        },
        { headers: getAuthHeaders() }
      );

      setMessage(`Leave #${selectedLeave.id} successfully updated with audit record.`);
      setShowModal(false);
      setSelectedLeave(null);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to modify leave');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (st) => {
    switch (st) {
      case 'Approved':
        return 'success';
      case 'Rejected':
      case 'Revoked':
        return 'danger';
      case 'Pending':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Administration</span> / <span className="active">Leave Oversight</span>
          </div>
          <h1 className="elh-page-title">
            <FiCheckCircle style={{ marginRight: '10px', color: '#198754' }} />
            Post-Approval Leave Oversight & Modifications
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
            Review leaves processed by managers, adjust approved dates or days, and override decisions with full audit tracking.
          </p>
        </div>
        <div>
          <Button variant="outline-secondary" onClick={fetchLeaves} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
            Refresh
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)}>
          <FiCheckCircle style={{ marginRight: '8px' }} /> {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <FiAlertCircle style={{ marginRight: '8px' }} /> {error}
        </Alert>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-3">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-6">
              <div className="btn-group" role="group">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`btn btn-sm ${
                      activeTab === tab ? 'btn-primary' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <FiSearch />
                </span>
                <Form.Control
                  type="text"
                  placeholder="Filter by employee name, ID, or leave type..."
                  className="border-start-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaves Oversight Table */}
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Leave Details</th>
                <th>Date Range</th>
                <th>Days</th>
                <th>Manager Approvals</th>
                <th>Status & Admin Audits</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading leave records...</div>
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    No leaves found for status: <strong>{activeTab}</strong>.
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => {
                  const hasAdminOverride = Boolean(leave.admin_override_status);
                  return (
                    <tr key={leave.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div
                            className="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center me-2"
                            style={{ width: '38px', height: '38px', fontSize: '0.9rem' }}
                          >
                            {leave.employee_name ? leave.employee_name.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div className="fw-bold">{leave.employee_name}</div>
                            <small className="text-muted">
                              ID: #{leave.employee_id} • {leave.designation || 'Staff'}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="fw-semibold text-dark d-block">{leave.leave_type}</span>
                        <small className="text-muted">{leave.duration || 'Full Day'}</small>
                      </td>

                      <td>
                        <div>
                          <FiCalendar className="me-1 text-muted" size={13} />
                          <strong>{leave.start_date}</strong> to <strong>{leave.end_date}</strong>
                        </div>
                        <small className="text-muted">Applied: {leave.created_at}</small>
                      </td>

                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1 fs-6">
                          {leave.no_of_days} {leave.no_of_days === 1 ? 'day' : 'days'}
                        </span>
                      </td>

                      <td>
                        {leave.approvalDetails && leave.approvalDetails.length > 0 ? (
                          leave.approvalDetails.map((mgr) => (
                            <div key={mgr.manager_id} className="small mb-1">
                              <span className="text-muted">{mgr.manager_name}: </span>
                              <Badge bg={getStatusBadgeVariant(mgr.status)} className="p-1">
                                {mgr.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted small">No manager assigned</span>
                        )}
                      </td>

                      <td>
                        <Badge bg={getStatusBadgeVariant(leave.status)} className="p-2 mb-1">
                          {leave.status}
                        </Badge>
                        {hasAdminOverride && (
                          <div className="mt-1">
                            <span className="badge bg-warning-subtle text-warning-emphasis border p-1 d-block text-start">
                              Admin: {leave.admin_override_status}
                              {leave.admin_modifier_name && ` by ${leave.admin_modifier_name}`}
                            </span>
                            {leave.admin_modification_reason && (
                              <small className="text-muted d-block mt-1" style={{ maxWidth: '200px' }}>
                                "{leave.admin_modification_reason}"
                              </small>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="text-end">
                        {canModify ? (
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => openModifyModal(leave)}
                          >
                            <FiEdit3 className="me-1" /> Review / Modify
                          </Button>
                        ) : (
                          <span className="text-muted small">View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMIN MODIFY / OVERRIDE MODAL */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <FiEdit3 className="me-2 text-primary" />
            Admin Leave Review & Modification
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitModification}>
          <Modal.Body>
            {selectedLeave && (
              <>
                <div className="p-3 bg-light rounded border mb-3">
                  <div className="row">
                    <div className="col-sm-6">
                      <small className="text-muted text-uppercase fw-bold d-block">Employee</small>
                      <span className="fw-bold">{selectedLeave.employee_name}</span> (ID: #{selectedLeave.employee_id})
                    </div>
                    <div className="col-sm-6">
                      <small className="text-muted text-uppercase fw-bold d-block">Leave Type</small>
                      <span>{selectedLeave.leave_type} ({selectedLeave.duration || 'Full Day'})</span>
                    </div>
                  </div>
                  {selectedLeave.reason && (
                    <div className="mt-2 pt-2 border-top">
                      <small className="text-muted fw-bold">Original Reason: </small>
                      <span>"{selectedLeave.reason}"</span>
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Admin Status Decision</Form.Label>
                      <Form.Select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        required
                      >
                        <option value="Approved">Approved (Final Confirmation)</option>
                        <option value="Revoked">Revoked / Rejected (Cancel Leave)</option>
                        <option value="Modified">Modified (Adjust Days/Dates)</option>
                        <option value="Pending">Revert to Pending</option>
                      </Form.Select>
                    </Form.Group>
                  </div>

                  <div className="col-md-6">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Adjust Number of Days</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="365"
                        value={formDays}
                        onChange={(e) => setFormDays(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-6">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-6">
                    <Form.Group>
                      <Form.Label className="fw-semibold">End Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>
                </div>

                {/* Balance Impact Alert */}
                {selectedLeave.status === 'Approved' && (
                  <Alert variant="info" className="d-flex align-items-center mb-3">
                    <FiInfo size={22} className="me-2 flex-shrink-0" />
                    <div>
                      {formStatus === 'Revoked' || formStatus === 'Rejected' ? (
                        <span>
                          <strong>Balance Impact:</strong> Marking this leave as <em>Revoked/Rejected</em> will automatically{' '}
                          <strong>refund {selectedLeave.no_of_days} days</strong> back to the employee's leave balance.
                        </span>
                      ) : calculateDaysDiff() !== 0 ? (
                        <span>
                          <strong>Balance Impact:</strong> Changing days from {selectedLeave.no_of_days} to {formDays} will{' '}
                          {calculateDaysDiff() > 0 ? (
                            <span>
                              <strong>refund {calculateDaysDiff()} day(s)</strong> back to employee balance.
                            </span>
                          ) : (
                            <span>
                              <strong>deduct {Math.abs(calculateDaysDiff())} additional day(s)</strong> from employee balance.
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>No change to total days. Balance will remain unaffected.</span>
                      )}
                    </div>
                  </Alert>
                )}

                <Form.Group className="mb-2">
                  <Form.Label className="fw-semibold">
                    Admin Modification Reason / Remarks <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Enter reason for modifying or overriding this leave (e.g. Employee requested date shift, HR audit adjustment)..."
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">
                    This remark will be permanently logged in the audit trail.
                  </Form.Text>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner animation="border" size="sm" /> : 'Confirm & Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovedLeavesReview;
