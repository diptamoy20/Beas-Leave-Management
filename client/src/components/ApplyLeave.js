import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Form, Button, Alert, Row, Col, ListGroup, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { applyLeave, fetchLeaves } from '../store/slices/leaveSlice';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import axios from 'axios';

const ApplyLeave = () => {
  const dispatch = useDispatch();
  const { loading, leaves } = useSelector((state) => state.leave);
  const { user } = useSelector((state) => state.auth);

  const [metaData, setMetaData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [formData, setFormData] = useState({
    employee_id: user?.employee_id,
    start_date: null,
    end_date: null,
    duration: 'Full Day', // Maps to Type of leave (Half/Full/Quarterly)
    is_restricted: false,
    no_of_days: '', // Mapped to Duration calculated field
    reason: '',
    manager_id: [], // array of selected manager IDs
  });

  const [approverQuery, setApproverQuery] = useState('');
  const [showApproverResults, setShowApproverResults] = useState(false);
  const wrapperRef = useRef(null);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchLeaves());

    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/leaves/apply-meta', { headers: { Authorization: `Bearer ${token}` } });
        setMetaData(res.data.data);
      } catch (err) {
        console.error("Failed to fetch apply meta data", err);
      } finally {
        setMetaLoading(false);
      }
    };
    fetchMeta();
  }, [dispatch]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowApproverResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const holidays = metaData?.holidays || [];

  const approverOptions = useMemo(() => {
    const list = metaData?.authorities || [];
    return list.map((emp) => ({
      id: emp.id,
      value: String(emp.employee_id ?? ''),
      label: String(emp.name ?? ''),
      designation: String(emp.designation ?? 'Employee')
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
    return formData.manager_id.map(id => approverOptions.find(opt => opt.value === id)).filter(Boolean);
  }, [formData.manager_id, approverOptions]);

  const toggleApprover = (id) => {
    setFormData(prev => {
      const isSelected = prev.manager_id.includes(id);
      if (isSelected) {
        return { ...prev, manager_id: prev.manager_id.filter(m => m !== id) };
      } else {
        return { ...prev, manager_id: [...prev.manager_id, id] };
      }
    });
  };

  const removeApprover = (id) => {
    setFormData(prev => ({ ...prev, manager_id: prev.manager_id.filter(m => m !== id) }));
  };

  const toYmd = (d) => {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
  };

  const generalHolidayDates = useMemo(() => {
    return new Set(holidays.filter((h) => !h.restricted).map((h) => String(h.date)));
  }, [holidays]);

  const restrictedHolidayDates = useMemo(() => {
    return new Set(holidays.filter((h) => h.restricted).map((h) => String(h.date)));
  }, [holidays]);

  const blockedLeaveDates = useMemo(() => {
    const set = new Set();
    (leaves || []).filter((l) => l.status === 'Pending' || l.status === 'Approved').forEach((l) => {
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      while (cursor <= endUtc) {
        set.add(toYmd(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    });
    return set;
  }, [leaves]);

  useEffect(() => {
    const { start_date, end_date, duration, is_restricted } = formData;
    if (!start_date || !end_date) {
      setFormData((prev) => ({ ...prev, no_of_days: '' }));
      return;
    }

    if (duration === 'Quarterly Leave') {
      setFormData((prev) => ({ ...prev, no_of_days: 1 }));
      return;
    }

    if (duration === 'Half Day') {
      setFormData((prev) => ({ ...prev, no_of_days: 0.5 }));
      return;
    }

    const restrictedDates = new Set(holidays.filter((h) => h.restricted).map((h) => String(h.date)));
    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    while (current <= end) {
      const day = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      const isWeekend = day === 0 || day === 6;
      const isRestricted = restrictedDates.has(dateStr);

      if (!isWeekend) {
        if (isRestricted) {
          if (is_restricted) count++;
        } else {
          count++;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    setFormData((prev) => ({ ...prev, no_of_days: count }));
  }, [formData.start_date, formData.end_date, formData.duration, formData.is_restricted, holidays]);

  const formatDate = (date) => toYmd(date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.manager_id.length === 0) {
      setError('Please select at least one approval authority');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const finalData = {
      ...formData,
      leave_type: formData.duration,
      start_date: formatDate(formData.start_date),
      end_date: formatDate(formData.end_date),
      manager_id: formData.manager_id.join(',')
    };

    try {
      await dispatch(applyLeave(finalData)).unwrap();
      setSuccess(true);
      setFormData({
        employee_id: user?.employee_id,
        start_date: null,
        end_date: null,
        duration: 'Full Day',
        is_restricted: false,
        no_of_days: '',
        reason: '',
        manager_id: [],
      });
      setApproverQuery('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message || "Something went wrong";
      setError(msg);
      setTimeout(() => setError(''), 3000);
    }
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isSelectableDate = (date) => {
    if (isWeekend(date)) return false;
    const key = toYmd(date);
    if (generalHolidayDates.has(key)) return false;
    if (restrictedHolidayDates.has(key) && !formData.is_restricted) return false;
    if (blockedLeaveDates.has(key)) return false;
    return true;
  };

  const dayClassName = (date) => {
    const key = toYmd(date);
    if (generalHolidayDates.has(key)) return 'datepicker-day--holiday-general';
    if (restrictedHolidayDates.has(key)) return 'datepicker-day--holiday-restricted';
    if (blockedLeaveDates.has(key)) return 'datepicker-day--leave-blocked';
    return undefined;
  };

  const totalLeave = metaData?.totalLeave || 0;
  const balanceLeaveCount = metaData?.['balance Leave'] || 0;
  const restrictedLeaveCount = metaData?.restrictedLieve ?? 1;
  const quarterlyLeaveCount = 4; // Not specified in spec, defaulting to 4

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Apply for Leave</h4>

      {/* Leave Balance Section */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Total Leave</div>
            <div className="stat-value text-primary">{totalLeave}</div>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Balance Leave</div>
            <div className="stat-value text-success">{balanceLeaveCount}</div>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Restricted</div>
            <div className="stat-value text-warning">{restrictedLeaveCount}</div>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Quarterly</div>
            <div className="stat-value text-warning">{quarterlyLeaveCount}</div>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col lg={12}>
          <Card className="home-dashboard-card">
            <Card.Body>
              {success && <Alert variant="success">Leave application submitted successfully!</Alert>}
              {error && <Alert variant="danger">{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3 d-flex justify-content-between align-items-center">
                      <Form.Label>Start Date <span className="text-danger">*</span></Form.Label>
                      <DatePicker
                        selected={formData.start_date}
                        onChange={(date) => setFormData({ ...formData, start_date: date, end_date: date })}
                        filterDate={isSelectableDate}
                        dayClassName={dayClassName}
                        dateFormat="dd-MM-yyyy"
                        className="form-control"
                        placeholderText="Select start date"
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3 d-flex justify-content-between align-items-center">
                      <Form.Label>End Date <span className="text-danger">*</span></Form.Label>
                      <DatePicker
                        selected={formData.end_date}
                        onChange={(date) => setFormData({ ...formData, end_date: date })}
                        filterDate={isSelectableDate}
                        dayClassName={dayClassName}
                        minDate={formData.start_date}
                        dateFormat="dd-MM-yyyy"
                        className="form-control"
                        placeholderText="Select end date"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Type of leave</Form.Label>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          label="Full Day"
                          name="duration"
                          checked={formData.duration === 'Full Day'}
                          onChange={() => setFormData({ ...formData, duration: 'Full Day' })}
                        />
                        <Form.Check
                          type="radio"
                          label="Half Day"
                          name="duration"
                          checked={formData.duration === 'Half Day'}
                          onChange={() => setFormData({ ...formData, duration: 'Half Day' })}
                        />
                        <Form.Check
                          type="radio"
                          label="Quarterly Leave"
                          name="duration"
                          checked={formData.duration === 'Quarterly Leave'}
                          onChange={() => setFormData({ ...formData, duration: 'Quarterly Leave' })}
                        />
                      </div>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Duration</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="0"
                        value={formData.no_of_days}
                        disabled
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Approval Authority</Form.Label>
                  <div style={{ position: 'relative' }} ref={wrapperRef}>
                    <div className="form-control d-flex flex-wrap gap-1 align-items-center" style={{ minHeight: '40px', cursor: 'text' }} onClick={() => setShowApproverResults(true)}>
                      {selectedApproverDetails.map(emp => (
                        <Badge bg="primary" key={emp.value} className="d-flex align-items-center me-1 mb-1 p-2">
                          {emp.label}
                          <i
                            className="bi bi-x-circle ms-2"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeApprover(emp.value);
                            }}
                          ></i>
                        </Badge>
                      ))}
                      <input
                        type="text"
                        style={{ border: 'none', outline: 'none', flex: 1, minWidth: '150px' }}
                        placeholder={metaLoading ? 'Loading...' : (selectedApproverDetails.length === 0 ? 'Search approver...' : '')}
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
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>{o.designation}</div>
                              </div>
                              {formData.manager_id.includes(o.value) && (
                                <i className="bi bi-check-lg text-primary"></i>
                              )}
                            </div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Want to add restricted holiday"
                    checked={formData.is_restricted}
                    onChange={(e) => setFormData({ ...formData, is_restricted: e.target.checked })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Reason</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder="Enter reason for leave"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </Form.Group>

                <Button
                  type="submit"
                  disabled={loading}
                  style={{ background: '#405189', border: 'none' }}
                >
                  {loading ? 'Submitting...' : 'Submit Leave Request'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ApplyLeave;
