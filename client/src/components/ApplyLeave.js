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
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generalHolidayDates = useMemo(() => {
    return new Set(holidays.filter((h) => !h.restricted).map((h) => String(h.date)));
  }, [holidays]);

  const restrictedHolidayDates = useMemo(() => {
    return new Set(holidays.filter((h) => h.restricted).map((h) => String(h.date)));
  }, [holidays]);

  const availableRestrictedHolidays = useMemo(() => {
    return holidays.filter((h) => h.restricted);
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

  const [rhBreakdown, setRhBreakdown] = useState({ regularDays: 0, restrictedDays: 0, rhNames: [] });

  useEffect(() => {
    const { start_date, end_date, duration, is_restricted } = formData;
    if (!start_date || !end_date) {
      setFormData((prev) => ({ ...prev, no_of_days: '' }));
      setRhBreakdown({ regularDays: 0, restrictedDays: 0, rhNames: [] });
      return;
    }

    if (duration === 'Quarterly Leave') {
      setFormData((prev) => ({ ...prev, no_of_days: 1 }));
      setRhBreakdown({ regularDays: 1, restrictedDays: 0, rhNames: [] });
      return;
    }

    if (duration === 'Half Day') {
      setFormData((prev) => ({ ...prev, no_of_days: 0.5 }));
      setRhBreakdown({ regularDays: 0.5, restrictedDays: 0, rhNames: [] });
      return;
    }

    const restrictedMap = new Map(holidays.filter((h) => h.restricted).map((h) => [String(h.date), h.name]));
    const generalSet = new Set(holidays.filter((h) => !h.restricted).map((h) => String(h.date)));

    let regCount = 0;
    let rhCount = 0;
    const rhNames = [];

    const current = new Date(start_date);
    const end = new Date(end_date);

    while (current <= end) {
      const day = current.getDay();
      const dateStr = toYmd(current);
      const isWeekend = day === 0 || day === 6;

      if (!isWeekend && !generalSet.has(dateStr)) {
        if (restrictedMap.has(dateStr)) {
          rhCount++;
          rhNames.push(`${dateStr} (${restrictedMap.get(dateStr)})`);
        } else {
          regCount++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    const totalDays = regCount + rhCount;
    setFormData((prev) => ({
      ...prev,
      no_of_days: totalDays,
      is_restricted: rhCount > 0 ? true : prev.is_restricted
    }));
    setRhBreakdown({ regularDays: regCount, restrictedDays: rhCount, rhNames });
  }, [formData.start_date, formData.end_date, formData.duration, holidays]);

  const formatDate = (date) => toYmd(date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.duration === 'Quarterly Leave' && Number(quarterlyLeaveCount) <= 0) {
      setError('You have 0 Quarterly Leave balance remaining. You cannot apply for Quarterly Leave.');
      setTimeout(() => setError(''), 4000);
      return;
    }

    if (rhBreakdown.restrictedDays > 0 && Number(restrictedLeaveCount) <= 0) {
      setError('You have 0 Restricted Holiday balance remaining. You cannot apply for a Restricted Holiday.');
      setTimeout(() => setError(''), 4000);
      return;
    }

    if (rhBreakdown.restrictedDays > Number(restrictedLeaveCount)) {
      setError(`Selected range contains ${rhBreakdown.restrictedDays} Restricted Holiday(s), but you only have ${restrictedLeaveCount} remaining.`);
      setTimeout(() => setError(''), 4000);
      return;
    }

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

  const totalLeave = metaData?.leaveBalance?.totalLeave || 0;
  const balanceLeaveCount = metaData?.leaveBalance?.balanceLeave || 0;
  const restrictedLeaveCount = metaData?.leaveBalance?.restrictedLeave ?? 1;
  const quarterlyLeaveCount = metaData?.leaveBalance?.quarterlyLeave || 0;
  const compOffBalance = Number(metaData?.leaveBalance?.compOffLeave || 0);

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Apply for Leave</h4>

      {/* Leave Balance Section */}
      <Row className="mb-4 g-2">
        <Col xs={6} md>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Total Leave</div>
            <div className="stat-value text-primary">{totalLeave}</div>
          </Card>
        </Col>
        <Col xs={6} md>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Balance Leave</div>
            <div className="stat-value text-success">{balanceLeaveCount}</div>
          </Card>
        </Col>
        <Col xs={6} md>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Restricted</div>
            <div className="stat-value text-warning">{restrictedLeaveCount}</div>
          </Card>
        </Col>
        <Col xs={6} md>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Quarterly</div>
            <div className="stat-value text-secondary">{quarterlyLeaveCount}</div>
          </Card>
        </Col>
        <Col xs={6} md>
          <Card className="stat-card text-center py-3">
            <div className="stat-label text-gray-200">Comp-Off</div>
            <div className="stat-value text-info fw-bold">{compOffBalance}</div>
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
                      <div className="d-flex flex-wrap gap-3">
                        <Form.Check
                          type="radio"
                          id="leave_full"
                          label="Full Day"
                          name="duration"
                          checked={formData.duration === 'Full Day'}
                          onChange={() => setFormData({ ...formData, duration: 'Full Day' })}
                        />
                        <Form.Check
                          type="radio"
                          id="leave_half"
                          label="Half Day"
                          name="duration"
                          checked={formData.duration === 'Half Day'}
                          onChange={() => setFormData({ ...formData, duration: 'Half Day' })}
                        />
                        <Form.Check
                          type="radio"
                          id="leave_quarterly"
                          label={`Quarterly Leave${Number(quarterlyLeaveCount) <= 0 ? ' (No balance)' : ''}`}
                          name="duration"
                          disabled={Number(quarterlyLeaveCount) <= 0}
                          checked={formData.duration === 'Quarterly Leave'}
                          onChange={() => {
                            if (Number(quarterlyLeaveCount) > 0) {
                              setFormData({ ...formData, duration: 'Quarterly Leave' });
                            }
                          }}
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
                      {rhBreakdown.restrictedDays > 0 && (
                        <div className="mt-2 p-2 bg-light rounded border small">
                          <div className="text-success fw-semibold">
                            <i className="bi bi-info-circle me-1"></i>
                            Restricted Holiday Detected ({rhBreakdown.restrictedDays} day):
                          </div>
                          <div className="text-muted ms-3">
                            • Regular leave to deduct: <strong>{rhBreakdown.regularDays} day(s)</strong>
                          </div>
                          <div className="text-muted ms-3">
                            • Restricted Holiday to deduct: <strong>{rhBreakdown.restrictedDays} day</strong> ({rhBreakdown.rhNames.join(', ')})
                          </div>
                        </div>
                      )}
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
                    id="want_restricted_holiday"
                    label={`Want to add restricted holiday${Number(restrictedLeaveCount) <= 0 ? ' (No balance)' : ''}`}
                    checked={formData.is_restricted}
                    disabled={Number(restrictedLeaveCount) <= 0}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData({ ...formData, is_restricted: checked });
                    }}
                  />
                  {formData.is_restricted && availableRestrictedHolidays.length > 0 && (
                    <div className="mt-2 p-3 bg-light rounded border">
                      <Form.Label className="fw-semibold text-primary mb-2">
                        <i className="bi bi-calendar-event me-1"></i> Quick Select Restricted Holiday:
                      </Form.Label>
                      <Form.Select
                        className="form-control"
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          if (!selectedVal) return;
                          const rh = availableRestrictedHolidays.find(h => String(h.date) === selectedVal);
                          if (rh) {
                            const [y, m, d] = rh.date.split('-').map(Number);
                            const targetDate = new Date(y, m - 1, d);
                            setFormData((prev) => ({
                              ...prev,
                              start_date: targetDate,
                              end_date: targetDate,
                              duration: 'Full Day',
                              is_restricted: true,
                              reason: prev.reason || `Restricted Holiday: ${rh.name}`
                            }));
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">-- Choose an upcoming Restricted Holiday to auto-fill date --</option>
                        {availableRestrictedHolidays.map((rh) => (
                          <option key={rh.date} value={rh.date}>
                            {rh.date} - {rh.name}
                          </option>
                        ))}
                      </Form.Select>
                      <div className="form-text text-muted mt-1 small">
                        Selecting a holiday automatically sets the Start & End Date and designates it as a Restricted Holiday deduction.
                      </div>
                    </div>
                  )}
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
