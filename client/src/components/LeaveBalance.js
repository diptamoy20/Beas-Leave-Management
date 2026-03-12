import React, { useState, useEffect } from 'react';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import { FiCalendar } from 'react-icons/fi';

const LeaveBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(response.data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const leaveTypes = [
    {
      name: 'Casual Leave',
      available: balance?.casual_leave || 0,
      total: 12,
      color: '#405189',
    },
    {
      name: 'Sick Leave',
      available: balance?.sick_leave || 0,
      total: 10,
      color: '#0ab39c',
    },
    {
      name: 'Paid Leave',
      available: balance?.paid_leave || 0,
      total: 15,
      color: '#f7b84b',
    },
  ];

  if (loading) {
    return <div className="text-center py-5">Loading...</div>;
  }

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Leave Balance</h4>
      
      <Row>
        {leaveTypes.map((leave, index) => (
          <Col key={index} lg={4} md={6} className="mb-4">
            <Card className="dashboard-card">
              <Card.Body>
                <div
                  className="card-icon"
                  style={{ background: `${leave.color}15`, color: leave.color }}
                >
                  <FiCalendar />
                </div>
                <h5 className="mb-3">{leave.name}</h5>
                <div className="d-flex justify-content-between mb-2">
                  <span>Available</span>
                  <strong>{leave.available} / {leave.total}</strong>
                </div>
                <ProgressBar
                  now={(leave.available / leave.total) * 100}
                  style={{ height: '8px', background: `${leave.color}20` }}
                  variant="custom"
                >
                  <div
                    style={{
                      width: `${(leave.available / leave.total) * 100}%`,
                      background: leave.color,
                      height: '100%',
                    }}
                  />
                </ProgressBar>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="dashboard-card">
        <Card.Body>
          <h5 className="mb-3">Leave Policy</h5>
          <ul className="mb-0">
            <li className="mb-2">Casual Leave: 12 days per year</li>
            <li className="mb-2">Sick Leave: 10 days per year</li>
            <li className="mb-2">Paid Leave: 15 days per year</li>
            <li className="mb-2">Leaves can be carried forward to next year (max 5 days)</li>
            <li>Apply for leave at least 2 days in advance</li>
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
};

export default LeaveBalance;
