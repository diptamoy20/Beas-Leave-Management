import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { applyLeave, fetchLeaves } from '../store/slices/leaveSlice';
import { fetchEmployees } from '../store/slices/empSlice';
import { fetchHolidays } from '../store/slices/holidaySlice';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ApplyLeave = () => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.leave);
  const { user } = useSelector((state) => state.auth);
  const { employees, loading: employeesLoading } = useSelector((state) => state.employees);  
  const { holidays } = useSelector((state) => state.holiday);
  const { leaves } = useSelector((state) => state.leave);

  const [formData, setFormData] = useState({
    employee_id: user?.employee_id,
    leave_type: 'Earned Leave',
    start_date: null,
    end_date: null,
    no_of_days: '',
    reason: '',
    manager_id: '',
  });
  const [includeRestricted, setIncludeRestricted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchEmployees());
    dispatch(fetchHolidays());
    dispatch(fetchLeaves());
  }, [dispatch]);

  const toYmd = (d) => {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
  };

  const generalHolidayDates = useMemo(() => {
    return new Set(
      (holidays || [])
        .filter((h) => h.type === 'General')
        .map((h) => String(h.date).split('T')[0])
    );
  }, [holidays]);

  const restrictedHolidayDates = useMemo(() => {
    return new Set(
      (holidays || [])
        .filter((h) => h.type === 'Restricted')
        .map((h) => String(h.date).split('T')[0])
    );
  }, [holidays]);

  const blockedLeaveDates = useMemo(() => {
    const set = new Set();
    (leaves || [])
      .filter((l) => l.status === 'Pending' || l.status === 'Approved')
      .forEach((l) => {
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

  // Calculate no_of_days whenever dates or includeRestricted changes
  useEffect(() => {    
    const { start_date, end_date } = formData;
    if (!start_date || !end_date) {
      setFormData((prev) => ({ ...prev, no_of_days: '' }));
      return;
    }

    const restrictedDates = new Set(
      holidays
        .filter((h) => h.type === 'Restricted')
        .map((h) => h.date.split('T')[0])
    );

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
          if (includeRestricted) count++;
          // else skip
        } else {
          count++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    setFormData((prev) => ({ ...prev, no_of_days: count }));
  }, [formData.start_date, formData.end_date, includeRestricted, holidays]);

  const formatDate = (date) => toYmd(date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(applyLeave({
        ...formData,
        start_date: formatDate(formData.start_date),
        end_date: formatDate(formData.end_date),
      })).unwrap();
      setSuccess(true);
      setFormData({
        employee_id: user?.employee_id,
        leave_type: 'Earned Leave',
        start_date: '',
        end_date: '',
        no_of_days: '',
        reason: '',
        manager_id: '',
      });
      setIncludeRestricted(false);
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
    if (restrictedHolidayDates.has(key) && !includeRestricted) return false;
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
      <Row>
        <Col lg={8}>
          <Card className="dashboard-card">
            <Card.Body>
              {success && <Alert variant="success">Leave application submitted successfully!</Alert>}
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Leave Type</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Leave Type"
                    value={formData.leave_type}
                    // onChange={(e) => setFormData({ ...formData, leave_type: 'Earned Leave' })}
                    disabled
                  />
                </Form.Group>

                <Row>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>Start Date</Form.Label>
                      <DatePicker
                        selected={formData.start_date ? new Date(formData.start_date) : null}
                        onChange={(date) =>
                          setFormData({ ...formData, start_date: date })
                        }
                        filterDate={isSelectableDate}
                        dayClassName={dayClassName}
                        dateFormat="dd-MM-yyyy"
                        className="form-control"
                        placeholderText="Select start date"
                      />
                    </Form.Group>
                  </Col>

                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>End Date</Form.Label>
                      <DatePicker
                        selected={formData.end_date ? new Date(formData.end_date) : null}
                        onChange={(date) =>
                          setFormData({ ...formData, end_date: date })
                        }
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
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>No of Days</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="No of Days"
                        value={formData.no_of_days}
                        // onChange={(e) => setFormData({ ...formData, leave_type: 'Earned Leave' })}
                        disabled
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>Include Restricted Holiday</Form.Label>
                      <Form.Select
                        value={includeRestricted ? 'yes' : 'no'}
                        onChange={(e) => setIncludeRestricted(e.target.value === 'yes')}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Leave Approver</Form.Label>
                  <Form.Select
                    value={formData.manager_id}
                    onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    required
                  >
                    <option value="">Select approver</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.name}
                      </option>
                    ))}
                  </Form.Select>
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
