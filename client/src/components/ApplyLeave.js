import React, { useState } from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { applyLeave } from '../store/slices/leaveSlice';

const ApplyLeave = () => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.leave);
  
  const [formData, setFormData] = useState({
    leave_type: 'Casual Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(applyLeave(formData)).unwrap();
      setSuccess(true);
      setFormData({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err);
      setTimeout(() => setError(''), 3000);
    }
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
                  <Form.Select
                    value={formData.leave_type}
                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                    required
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Paid Leave">Paid Leave</option>
                  </Form.Select>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>End Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

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
