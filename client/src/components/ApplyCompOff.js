import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Form, Button, Alert, Row, Col, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { applyLeave } from '../store/slices/leaveSlice';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import {
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
  FiSend,
  FiX,
  FiCheck,
  FiInfo,
  FiAward,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ApplyCompOff = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [metaData, setMetaData] = useState(null);
  const [compSummary, setCompSummary] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [formData, setFormData] = useState({
    employee_id: user?.employee_id,
    start_date: null,
    end_date: null,
    no_of_days: '1',
    reason: '',
    manager_id: [],
  });

  const [approverQuery, setApproverQuery] = useState('');
  const [showApproverResults, setShowApproverResults] = useState(false);
  const wrapperRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const loadAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [metaRes, summaryRes] = await Promise.all([
        axios.get('/api/leaves/apply-meta?for_comp_off=true', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/comp-off/my-summary', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      const meta = metaRes.data.data;
      setMetaData(meta);
      setCompSummary(summaryRes.data.data);

      // Auto-assign CEO/Super Admin authority if applicant is Manager, HR, or Admin
      if (meta?.isManagerHrOrAdmin && meta?.authorities?.length > 0) {
        setFormData((prev) => {
          if (prev.manager_id.length === 0) {
            return { ...prev, manager_id: [String(meta.authorities[0].employee_id)] };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to load comp-off application data', err);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Click outside listener for approver dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowApproverResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const approverOptions = useMemo(() => {
    const list = metaData?.authorities || [];
    return list.map((emp) => ({
      id: emp.id,
      value: String(emp.employee_id ?? ''),
      label: String(emp.name ?? ''),
      designation: String(emp.designation ?? 'Manager / Authority'),
    }));
  }, [metaData]);

  const filteredApprovers = useMemo(() => {
    const q = approverQuery.trim().toLowerCase();
    if (!q) return approverOptions.slice(0, 30);
    return approverOptions
      .filter((o) => `${o.label} ${o.designation}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [approverOptions, approverQuery]);

  const selectedApproverDetails = useMemo(() => {
    return formData.manager_id
      .map((id) => approverOptions.find((opt) => opt.value === id))
      .filter(Boolean);
  }, [formData.manager_id, approverOptions]);

  const toggleApprover = (id) => {
    setFormData((prev) => {
      const isSelected = prev.manager_id.includes(id);
      if (isSelected) {
        return { ...prev, manager_id: prev.manager_id.filter((m) => m !== id) };
      } else {
        return { ...prev, manager_id: [...prev.manager_id, id] };
      }
    });
  };

  const removeApprover = (id) => {
    setFormData((prev) => ({
      ...prev,
      manager_id: prev.manager_id.filter((m) => m !== id),
    }));
  };

  const toYmd = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Balances
  const currentBalance = Number(compSummary?.balance ?? metaData?.leaveBalance?.compOffLeave ?? 0);
  const pendingDays = Number(compSummary?.pendingDays ?? metaData?.leaveBalance?.pendingCompOffLeave ?? 0);
  const totalCredited = Number(compSummary?.totalCredited ?? 0);

  // Dynamic day calculation based on worked dates (Full days only)
  useEffect(() => {
    const { start_date, end_date } = formData;
    if (!start_date) {
      setFormData((prev) => ({ ...prev, no_of_days: '' }));
      return;
    }

    const effectiveEnd = end_date || start_date;
    const start = new Date(start_date);
    const end = new Date(effectiveEnd);

    if (start > end) {
      setFormData((prev) => ({ ...prev, no_of_days: '1' }));
      return;
    }

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      count += 1;
      current.setDate(current.getDate() + 1);
    }

    setFormData((prev) => ({ ...prev, no_of_days: String(count) }));
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.start_date) {
      setError('Please select the date worked.');
      return;
    }

    const effectiveEnd = formData.end_date || formData.start_date;

    if (!formData.no_of_days || Number(formData.no_of_days) <= 0) {
      setError('Please enter a valid number of comp-off days to request.');
      return;
    }

    if (formData.manager_id.length === 0) {
      setError('Please select at least one approval authority (Manager / Admin).');
      return;
    }

    if (!formData.reason.trim()) {
      setError('Please provide a reason / justification for the Comp-Off work done.');
      return;
    }

    const payload = {
      employee_id: user?.employee_id,
      leave_type: 'Compensatory Off',
      duration: 'Full Day',
      start_date: toYmd(formData.start_date),
      end_date: toYmd(effectiveEnd),
      no_of_days: Number(formData.no_of_days),
      reason: formData.reason.trim(),
      manager_id: formData.manager_id.join(','),
      is_restricted: false,
    };

    setSubmitting(true);
    try {
      await dispatch(applyLeave(payload)).unwrap();
      setSuccess(true);
      setFormData({
        employee_id: user?.employee_id,
        start_date: null,
        end_date: null,
        no_of_days: '1',
        reason: '',
        manager_id: [],
      });
      setApproverQuery('');
      await loadAllData();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to submit Comp-Off application.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="elh-wrapper">
      {/* Header & Breadcrumb */}
      <div className="elh-page-header">
        <div className="d-flex flex-column gap-1">
          <div className="elh-breadcrumb">
            <Link to="/dashboard">Dashboard</Link>
            <span className="separator">/</span>
            <Link to="/my-comp-off">My Comp-Off</Link>
            <span className="separator">/</span>
            <span className="active">Apply Comp-Off</span>
          </div>
          <h2 className="elh-page-title">
            <FiClock style={{ marginRight: '10px', color: '#0dcaf0' }} />
            Apply for Comp-Off
          </h2>
          <p className="elh-page-subtitle">
            Request compensatory off credit for working on weekends, holidays, or extra days. Once approved by your authority, the days will be credited to your available Comp-Off balance.
          </p>
        </div>

        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/my-comp-off')}
          >
            <FiArrowLeft style={{ marginRight: '6px' }} />
            My Comp-Off History
          </Button>
        </div>
      </div>

      {/* Comp-Off Balance & Status Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={4}>
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #0dcaf0', borderRadius: '12px' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Current Comp-Off Balance</span>
                <h3 className="mb-0 mt-1 fw-bold text-info">
                  {metaLoading ? <Spinner animation="border" size="sm" /> : `${currentBalance} Days`}
                </h3>
                <small className="text-muted">Available in your account</small>
              </div>
              <div className="p-3 rounded-circle bg-info-subtle">
                <FiClock size={24} className="text-info" />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={12} sm={4}>
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #ffc107', borderRadius: '12px' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Pending Approval</span>
                <h3 className="mb-0 mt-1 fw-bold text-warning">
                  {metaLoading ? <Spinner animation="border" size="sm" /> : `${pendingDays} Days`}
                </h3>
                <small className="text-muted">Awaiting manager approval</small>
              </div>
              <div className="p-3 rounded-circle bg-warning-subtle">
                <FiAlertCircle size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={12} sm={4}>
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #198754', borderRadius: '12px' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Total Credited to Date</span>
                <h3 className="mb-0 mt-1 fw-bold text-success">
                  {metaLoading ? <Spinner animation="border" size="sm" /> : `${totalCredited} Days`}
                </h3>
                <small className="text-muted">Lifetime granted days</small>
              </div>
              <div className="p-3 rounded-circle bg-success-subtle">
                <FiAward size={24} className="text-success" />
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* How it works info banner */}
      <div className="p-3 bg-light border rounded-3 mb-4 d-flex align-items-center gap-3">
        <FiInfo size={24} className="text-primary flex-shrink-0" />
        <div className="small text-secondary">
          <strong>Approval Hierarchy & Credit Policy:</strong> Employees' Comp-Off applications route to their respective reporting manager. Applications by Managers, HR, and Admins route to the <strong>CEO / Super Admin</strong> for approval.
          <br />
          <em>Important: Requested days remain <strong>Pending</strong> and will <strong>NOT</strong> increase your available balance until approved by the higher authority.</em>
        </div>
      </div>

      {/* Main Application Card */}
      <Card className="home-dashboard-card shadow-sm border-0" style={{ borderRadius: '14px' }}>
        <Card.Body className="p-4">
          {success && (
            <Alert variant="success" className="d-flex align-items-center justify-content-between p-3 mb-4 rounded-3">
              <div className="d-flex align-items-center gap-2">
                <FiCheckCircle size={22} className="text-success" />
                <div>
                  <strong>Comp-Off Request Submitted!</strong>
                  <div className="small">Your application has been routed to your approval authority. The days will be credited to your balance as soon as it is approved.</div>
                </div>
              </div>
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => navigate('/my-comp-off')}
              >
                View My Comp-Off
              </Button>
            </Alert>
          )}

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-4">
              <FiAlertCircle className="me-2" />
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            {/* Date Pickers */}
            <Row className="mb-3 g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold">
                    Start Date (Worked) <span className="text-danger">*</span>
                  </Form.Label>
                  <DatePicker
                    selected={formData.start_date}
                    onChange={(date) => {
                      setFormData({
                        ...formData,
                        start_date: date,
                        end_date: formData.end_date && formData.end_date < date ? date : (formData.end_date || date),
                      });
                    }}
                    dateFormat="dd-MM-yyyy"
                    className="form-control"
                    wrapperClassName="d-block"
                    placeholderText="Select start date worked"
                    required
                  />
                  <Form.Text className="text-muted">
                    Weekend, public holiday, or extra shift date you worked.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold">
                    End Date (Worked) <span className="text-danger">*</span>
                  </Form.Label>
                  <DatePicker
                    selected={formData.end_date}
                    onChange={(date) => setFormData({ ...formData, end_date: date })}
                    minDate={formData.start_date}
                    dateFormat="dd-MM-yyyy"
                    className="form-control"
                    wrapperClassName="d-block"
                    placeholderText="Select end date worked"
                    required
                  />
                  <Form.Text className="text-muted">
                    Keep same as Start Date for a single day.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Total Days to Claim */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold">Comp-Off Days to Request / Credit</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    min="1"
                    max="30"
                    value={formData.no_of_days}
                    onChange={(e) => setFormData({ ...formData, no_of_days: e.target.value })}
                    className="fw-bold text-primary"
                    required
                  />
                  <Form.Text className="text-muted">
                    Number of full days to be credited to your Comp-Off balance upon approval.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Approval Authority */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">
                Approval Authority (Managers / Admins) <span className="text-danger">*</span>
              </Form.Label>
              <div style={{ position: 'relative' }} ref={wrapperRef}>
                <div
                  className="form-control d-flex flex-wrap gap-1 align-items-center"
                  style={{ minHeight: '42px', cursor: 'text' }}
                  onClick={() => setShowApproverResults(true)}
                >
                  {selectedApproverDetails.map((emp) => (
                    <Badge
                      bg="primary"
                      key={emp.value}
                      className="d-flex align-items-center me-1 mb-1 p-2"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {emp.label}
                      <FiX
                        className="ms-2"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeApprover(emp.value);
                        }}
                      />
                    </Badge>
                  ))}
                  <input
                    type="text"
                    style={{ border: 'none', outline: 'none', flex: 1, minWidth: '160px' }}
                    placeholder={
                      metaLoading
                        ? 'Loading authorities...'
                        : selectedApproverDetails.length === 0
                        ? 'Search and select manager/admin...'
                        : ''
                    }
                    value={approverQuery}
                    onChange={(e) => {
                      setApproverQuery(e.target.value);
                      setShowApproverResults(true);
                    }}
                    onFocus={() => setShowApproverResults(true)}
                    disabled={metaLoading}
                    autoComplete="off"
                  />
                </div>

                {showApproverResults && !metaLoading && filteredApprovers.length > 0 && (
                  <ListGroup
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      maxHeight: 220,
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {filteredApprovers.map((o) => (
                      <ListGroup.Item
                        key={o.id ?? o.value}
                        action
                        active={formData.manager_id.includes(o.value)}
                        onClick={() => {
                          toggleApprover(o.value);
                          setApproverQuery('');
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{o.label}</strong>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                              {o.designation}
                            </div>
                          </div>
                          {formData.manager_id.includes(o.value) && (
                            <FiCheck className="text-primary" size={16} />
                          )}
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
              <Form.Text className="text-muted">
                Selected managers will receive your comp-off request for review and approval.
              </Form.Text>
            </Form.Group>

            {/* Reason */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold">
                Reason / Justification for Comp-Off Work <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Describe the work performed (e.g. client deployment, weekend emergency support, production release)..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </Form.Group>

            {/* Actions */}
            <div className="d-flex gap-2">
              <Button
                variant="primary"
                type="submit"
                disabled={submitting || metaLoading || !formData.start_date || Number(formData.no_of_days) <= 0}
                className="px-4 py-2 fw-semibold d-flex align-items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <FiSend size={16} />
                    <span>Submit Comp-Off Request</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => navigate('/my-comp-off')}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ApplyCompOff;
