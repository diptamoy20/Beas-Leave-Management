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

  const [detectedRhList, setDetectedRhList] = useState([]);
  const [rhBreakdown, setRhBreakdown] = useState({ regularDays: 0, restrictedDays: 0, rhNames: [] });

  useEffect(() => {
    const { start_date, end_date, duration, is_restricted } = formData;
    if (!start_date || !end_date) {
      setFormData((prev) => ({ ...prev, no_of_days: '' }));
      setDetectedRhList([]);
      setRhBreakdown({ regularDays: 0, restrictedDays: 0, rhNames: [] });
      return;
    }

    if (duration === 'Quarterly Leave') {
      setFormData((prev) => ({ ...prev, no_of_days: 1 }));
      setDetectedRhList([]);
      setRhBreakdown({ regularDays: 1, restrictedDays: 0, rhNames: [] });
      return;
    }

    if (duration === 'Half Day') {
      setFormData((prev) => ({ ...prev, no_of_days: 0.5 }));
      setDetectedRhList([]);
      setRhBreakdown({ regularDays: 0.5, restrictedDays: 0, rhNames: [] });
      return;
    }

    const restrictedMap = new Map(holidays.filter((h) => h.restricted).map((h) => [String(h.date), h.name]));
    const generalSet = new Set(holidays.filter((h) => !h.restricted).map((h) => String(h.date)));

    let regCount = 0;
    const detectedRhs = [];

    const current = new Date(start_date);
    const end = new Date(end_date);

    while (current <= end) {
      const day = current.getDay();
      const dateStr = toYmd(current);
      const isWeekend = day === 0 || day === 6;

      if (!isWeekend && !generalSet.has(dateStr)) {
        if (restrictedMap.has(dateStr)) {
          detectedRhs.push({ date: dateStr, name: restrictedMap.get(dateStr) });
        } else {
          regCount++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    setDetectedRhList(detectedRhs);

    // If RH is selected by employee, count as additional leave day; if unselected, exclude from leave deduction
    const activeRhCount = is_restricted ? detectedRhs.length : 0;
    const totalDays = regCount + activeRhCount;

    setFormData((prev) => ({
      ...prev,
      no_of_days: totalDays,
    }));

    setRhBreakdown({
      regularDays: regCount,
      restrictedDays: activeRhCount,
      rhNames: detectedRhs.map(r => `${r.date} (${r.name})`)
    });
  }, [formData.start_date, formData.end_date, formData.duration, formData.is_restricted, holidays]);

  const formatDate = (date) => toYmd(date);

  const totalLeave = Number(metaData?.leaveBalance?.totalLeave || 0);
  const balanceLeaveCount = Number(metaData?.leaveBalance?.balanceLeave || 0);
  const restrictedLeaveCount = Number(metaData?.leaveBalance?.restrictedLeave ?? 1);
  const quarterlyLeaveCount = Number(metaData?.leaveBalance?.quarterlyLeave || 0);
  const compOffBalance = Number(metaData?.leaveBalance?.compOffLeave || 0);

  // Live deduction priority calculation
  // 1. Regular days: Comp-Off first, then Regular Leave
  // 2. Selected RH days: Regular Leave first, then Comp-Off
  const requestedTotalDays = Number(formData.no_of_days || 0);
  const regDaysToDeduct = rhBreakdown.regularDays;
  const rhDaysToDeduct = rhBreakdown.restrictedDays;

  const regCompUsed = Math.min(compOffBalance, regDaysToDeduct);
  const regEarnedUsed = Math.max(0, regDaysToDeduct - regCompUsed);

  const remCompAfterReg = compOffBalance - regCompUsed;
  const remEarnedAfterReg = balanceLeaveCount - regEarnedUsed;

  const rhEarnedUsed = Math.min(Math.max(0, remEarnedAfterReg), rhDaysToDeduct);
  const rhCompUsed = Math.max(0, rhDaysToDeduct - rhEarnedUsed);

  const projectedCompOffUsed = Number((regCompUsed + rhCompUsed).toFixed(1));
  const projectedRegularLeaveUsed = Number((regEarnedUsed + rhEarnedUsed).toFixed(1));

  const totalAvailableDays = compOffBalance + balanceLeaveCount;
  const isBalanceInsufficient = formData.duration !== 'Quarterly Leave' && requestedTotalDays > totalAvailableDays;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.duration === 'Quarterly Leave' && Number(quarterlyLeaveCount) <= 0) {
      setError('You have 0 Quarterly Leave balance remaining. You cannot apply for Quarterly Leave.');
      setTimeout(() => setError(''), 4000);
      return;
    }

    if (isBalanceInsufficient) {
      setError(`Insufficient leave balance. You requested ${requestedTotalDays} day(s), but only have ${totalAvailableDays} day(s) available.`);
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
      setDetectedRhList([]);
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
                        value={formData.no_of_days !== '' ? `${formData.no_of_days} Day(s)` : ''}
                        disabled
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Restricted Holiday Detection & Selection (Phase 6 Requirement) */}
                {detectedRhList.length > 0 && (
                  <Alert variant="warning" className="p-3 mb-3 border-warning rounded-3">
                    <div className="d-flex align-items-start gap-2">
                      <i className="bi bi-calendar-event fs-5 text-warning flex-shrink-0 mt-1"></i>
                      <div className="w-100">
                        <div className="fw-bold text-dark">
                          Restricted Holiday detected in your selected leave period:
                        </div>
                        <ul className="mb-2 mt-1 ps-3 text-secondary small">
                          {detectedRhList.map((rh, idx) => (
                            <li key={idx}>
                              <strong>{rh.date}</strong>: {rh.name}
                            </li>
                          ))}
                        </ul>
                        <Form.Check
                          type="checkbox"
                          id="rh_selection_toggle"
                          className="fw-semibold text-primary"
                          label="Include Restricted Holiday in your leave calculation"
                          checked={formData.is_restricted}
                          onChange={(e) => setFormData({ ...formData, is_restricted: e.target.checked })}
                        />
                        <div className="text-muted small mt-1">
                          {formData.is_restricted ? (
                            <span className="text-success">
                              ✓ Included: Counts as +{detectedRhList.length} leave day (deducted from Regular Leave first; if insufficient, from Comp-Off).
                            </span>
                          ) : (
                            <span className="text-secondary">
                              ✗ Excluded: This holiday is excluded from your leave deduction calculation.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Alert>
                )}

                {/* Live Comp-Off Priority Deduction Breakdown Preview (Phase 5 Requirement) */}
                {formData.start_date && formData.no_of_days !== '' && Number(formData.no_of_days) > 0 && (
                  <Card className="mb-3 border bg-light shadow-none">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold small text-dark">
                          <i className="bi bi-calculator me-1 text-primary"></i>
                          Automatic Leave Deduction Breakdown Preview
                        </span>
                        <Badge bg={isBalanceInsufficient ? 'danger' : 'success'}>
                          {isBalanceInsufficient ? 'Insufficient Balance' : 'Sufficient Balance'}
                        </Badge>
                      </div>

                      <Row className="g-2 small">
                        <Col sm={6} md={3}>
                          <div className="p-2 bg-white rounded border">
                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Total Requested</span>
                            <strong className="text-dark fs-6">{formData.no_of_days} Day(s)</strong>
                          </div>
                        </Col>
                        <Col sm={6} md={3}>
                          <div className="p-2 bg-white rounded border">
                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Comp-Off (Priority 1)</span>
                            <strong className="text-info fs-6">-{projectedCompOffUsed} Day(s)</strong>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Bal: {compOffBalance} → {Math.max(0, (compOffBalance - projectedCompOffUsed).toFixed(1))}</div>
                          </div>
                        </Col>
                        <Col sm={6} md={3}>
                          <div className="p-2 bg-white rounded border">
                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Regular Leave (Priority 2)</span>
                            <strong className="text-success fs-6">-{projectedRegularLeaveUsed} Day(s)</strong>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Bal: {balanceLeaveCount} → {Math.max(0, (balanceLeaveCount - projectedRegularLeaveUsed).toFixed(1))}</div>
                          </div>
                        </Col>
                        <Col sm={6} md={3}>
                          <div className="p-2 bg-white rounded border">
                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Total Available</span>
                            <strong className="text-primary fs-6">{totalAvailableDays} Day(s)</strong>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Remaining: {Math.max(0, (totalAvailableDays - requestedTotalDays).toFixed(1))}</div>
                          </div>
                        </Col>
                      </Row>

                      {isBalanceInsufficient && (
                        <div className="text-danger small mt-2 fw-semibold">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          You do not have enough total leave balance for this request. Please adjust your dates.
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                )}

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
                  disabled={loading || isBalanceInsufficient}
                  style={{ background: isBalanceInsufficient ? '#6c757d' : '#405189', border: 'none' }}
                >
                  {loading ? 'Submitting...' : isBalanceInsufficient ? 'Insufficient Balance' : 'Submit Leave Request'}
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
