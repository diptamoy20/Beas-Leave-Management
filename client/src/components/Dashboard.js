import React, { useEffect, useMemo } from 'react';
import { Row, Col, Card, Badge, Spinner } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { FiCalendar, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';
import { balanceLeave, fetchLeaves } from '../store/slices/leaveSlice';
import { fetchHolidays } from '../store/slices/holidaySlice';

const Dashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { leaves, leaveBalance, loading: leavesLoading } = useSelector((state) => state.leave);
  const { holidays, loading: holidaysLoading } = useSelector((state) => state.holiday);

  useEffect(() => {
    dispatch(fetchLeaves());
    dispatch(fetchHolidays());
  }, [dispatch]);

  // const fetchBalance = async () => {
  //   try {
  //     const token = localStorage.getItem('token');
  //     const response = await axios.get('/api/leaves/balance', {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     setBalance(response.data);
  //   } catch (error) {
  //     console.error('Error fetching balance:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  // Calculate stats from actual data
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyLeaves = leaves.filter(leave => {
      const leaveDate = new Date(leave.start_date);
      return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
    });

    const approved = leaves.filter(l => l.status === 'approved').length;
    const pending = leaves.filter(l => l.status === 'pending').length;
    const rejected = leaves.filter(l => l.status === 'rejected').length;

    return {
      total: leaveBalance,
      approved,
      pending,
      rejected,
      monthlyLeaves
    };
  }, [leaves]);

  // Get recent activities (latest 5 leaves)
  const recentActivities = useMemo(() => {
    return [...leaves]
      .sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date))
      .slice(0, 5);
  }, [leaves]);

  // Get upcoming holidays (next 5)
  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return holidays
      .filter(holiday => new Date(holiday.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  }, [holidays]);

  // Calculate monthly pie chart data
  const monthlyStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyLeaves = leaves.filter(leave => {
      const leaveDate = new Date(leave.start_date);
      return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
    });

    const approved = monthlyLeaves.filter(l => l.status === 'approved').length;
    const pending = monthlyLeaves.filter(l => l.status === 'pending').length;
    const rejected = monthlyLeaves.filter(l => l.status === 'rejected').length;
    const total = approved + pending + rejected;

    return { approved, pending, rejected, total };
  }, [leaves]);

  const statsCards = [
    {
      title: 'Total Leaves',
      value: stats.total,
      icon: <FiCalendar />,
      color: '#405189',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: <FiCheckCircle />,
      color: '#0ab39c',
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: <FiClock />,
      color: '#f7b84b',
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      icon: <FiTrendingUp />,
      color: '#f06548',
    },
  ];

  const getStatusBadge = (status) => {
    const variants = {
      approved: 'success',
      pending: 'warning',
      rejected: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Simple SVG Pie Chart Component
  const PieChart = ({ data }) => {
    const { approved, pending, rejected, total } = data;

    if (total === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-muted">No leave data for this month</p>
        </div>
      );
    }

    const approvedPercent = (approved / total) * 100;
    const pendingPercent = (pending / total) * 100;
    const rejectedPercent = (rejected / total) * 100;

    // Calculate pie slices
    let currentAngle = 0;
    const slices = [];
    const colors = ['#0ab39c', '#f7b84b', '#f06548'];
    const values = [approved, pending, rejected];
    const labels = ['Approved', 'Pending', 'Rejected'];

    values.forEach((value, index) => {
      if (value > 0) {
        const percent = (value / total) * 100;
        const angle = (percent / 100) * 360;
        slices.push({
          percent,
          angle,
          startAngle: currentAngle,
          color: colors[index],
          label: labels[index],
          value
        });
        currentAngle += angle;
      }
    });

    const createArc = (startAngle, endAngle) => {
      const start = polarToCartesian(50, 50, 40, endAngle);
      const end = polarToCartesian(50, 50, 40, startAngle);
      const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
      return `M 50 50 L ${start.x} ${start.y} A 40 40 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
    };

    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
      };
    };

    return (
      <div>
        <svg viewBox="0 0 100 100" style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }}>
          {slices.map((slice, index) => (
            <path
              key={index}
              d={createArc(slice.startAngle, slice.startAngle + slice.angle)}
              fill={slice.color}
              stroke="#fff"
              strokeWidth="0.5"
            />
          ))}
        </svg>
        <div className="mt-3">
          {slices.map((slice, index) => (
            <div key={index} className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: slice.color,
                    borderRadius: '2px',
                    marginRight: '8px'
                  }}
                />
                <small>{slice.label}</small>
              </div>
              <small className="fw-bold">{slice.value} ({slice.percent.toFixed(0)}%)</small>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Dashboard</h4>

      <Row>
        {statsCards.map((card, index) => (
          <Col key={index} xl={3} md={6} className="mb-4">
            <Card className="dashboard-card">
              <Card.Body>
                <div
                  className="card-icon"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  {card.icon}
                </div>
                <div className="card-title">{card.title}</div>
                <div className="card-value">{card.value}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="mt-4">
        <Col lg={8}>
          <Card className="dashboard-card">
            <Card.Body>
              <h5 className="mb-3">Recent Activity</h5>
              {leavesLoading ? (
                <div className="text-center py-3">
                  <Spinner animation="border" size="sm" />
                </div>
              ) : recentActivities.length > 0 ? (
                <div className="activity-list">
                  {recentActivities.map((leave) => (
                    <div key={leave.id} className="activity-item d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                      <div>
                        <div className="fw-semibold">{leave.leave_type}</div>
                        <small className="text-muted">
                          {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                        </small>
                        {leave.reason && (
                          <div className="mt-1">
                            <small className="text-muted">{leave.reason}</small>
                          </div>
                        )}
                      </div>
                      <div>
                        {getStatusBadge(leave.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No recent leave activity.</p>
              )}
            </Card.Body>
          </Card>

          <Card className="dashboard-card mt-4">
            <Card.Body>
              <h5 className="mb-3">Monthly Leave Statistics</h5>
              <PieChart data={monthlyStats} />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="dashboard-card">
            <Card.Body>
              <h5 className="mb-3">Upcoming Holidays</h5>
              {holidaysLoading ? (
                <div className="text-center py-3">
                  <Spinner animation="border" size="sm" />
                </div>
              ) : upcomingHolidays.length > 0 ? (
                <div className="holiday-list">
                  {upcomingHolidays.map((holiday) => (
                    <div key={holiday.id} className="holiday-item mb-3 pb-3 border-bottom">
                      <div className="d-flex align-items-start">
                        <div className="holiday-date me-3 text-center" style={{ minWidth: '50px' }}>
                          <div className="fw-bold" style={{ fontSize: '1.5rem', lineHeight: '1.2' }}>
                            {new Date(holiday.date).getDate()}
                          </div>
                          <small className="text-muted">
                            {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}
                          </small>
                        </div>
                        <div>
                          <div className="fw-semibold">{holiday.name}</div>
                          <small className="text-muted">{holiday.type}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No upcoming holidays.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
