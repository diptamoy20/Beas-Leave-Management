import React, { useEffect, useMemo } from 'react';
import { Spinner } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiPlus,
  FiArrowRight,
  FiFileText,
  FiAward,
  FiInfo,
} from 'react-icons/fi';
import { fetchLeaves } from '../store/slices/leaveSlice';
import { fetchHolidays } from '../store/slices/holidaySlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';
import { useNavigate, Link } from 'react-router-dom';
import '../assets/css/Dashboard.css';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { leaves } = useSelector((state) => state.leave);
  const { holidays, loading: holidaysLoading } = useSelector((state) => state.holiday);
  const { data: dashboardData, loading: dashboardLoading } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchLeaves());
    dispatch(fetchHolidays());
    dispatch(fetchDashboardData());
  }, [dispatch]);


  // Recent activities from dashboard API
  const recentActivities = useMemo(() => {
    if (dashboardData && dashboardData.leaveRequests) {
      return dashboardData.leaveRequests.slice(0, 5);
    }
    return [];
  }, [dashboardData]);

  // Upcoming holidays (next 5)
  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (holidays || [])
      .filter((holiday) => new Date(holiday.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  }, [holidays]);

  // Monthly stats for chart
  const monthlyStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyLeaves = (leaves || []).filter((leave) => {
      const leaveDate = new Date(leave.start_date || leave.fromDate);
      return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
    });

    const approved = monthlyLeaves.filter(
      (l) => (l.status || '').toLowerCase() === 'approved'
    ).length;
    const pending = monthlyLeaves.filter(
      (l) => (l.status || '').toLowerCase() === 'pending'
    ).length;
    const rejected = monthlyLeaves.filter(
      (l) => (l.status || '').toLowerCase() === 'rejected'
    ).length;
    const total = approved + pending + rejected;

    return { approved, pending, rejected, total };
  }, [leaves]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getDaysAway = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  // Sleek SVG Donut Chart
  const DonutChart = ({ data }) => {
    const { approved, pending, rejected, total } = data;

    if (total === 0) {
      return (
        <div className="text-center py-4 w-100">
          <p className="text-muted small mb-0">No leave requests recorded for this month</p>
        </div>
      );
    }

    const segments = [
      { label: 'Approved', value: approved, color: '#219a6b' },
      { label: 'Pending', value: pending, color: '#d7a24a' },
      { label: 'Rejected', value: rejected, color: '#cc5a3f' },
    ].filter((s) => s.value > 0);

    let cumulativeAngle = 0;
    const radius = 38;
    const innerRadius = 24;
    const center = 50;

    const polarToCartesian = (cx, cy, r, angleInDeg) => {
      const angleInRad = ((angleInDeg - 90) * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(angleInRad),
        y: cy + r * Math.sin(angleInRad),
      };
    };

    const makeArc = (startDeg, endDeg) => {
      // Avoid degenerate full circle
      const sweepDeg = endDeg - startDeg;
      const adjustedSweep = sweepDeg >= 360 ? 359.99 : sweepDeg;
      const actualEnd = startDeg + adjustedSweep;

      const outerStart = polarToCartesian(center, center, radius, startDeg);
      const outerEnd = polarToCartesian(center, center, radius, actualEnd);
      const innerStart = polarToCartesian(center, center, innerRadius, actualEnd);
      const innerEnd = polarToCartesian(center, center, innerRadius, startDeg);

      const largeArcFlag = adjustedSweep > 180 ? 1 : 0;

      return `M ${outerStart.x} ${outerStart.y}
              A ${radius} ${radius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}
              L ${innerStart.x} ${innerStart.y}
              A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}
              Z`;
    };

    const paths = segments.map((seg) => {
      const angle = (seg.value / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = startAngle + angle;
      cumulativeAngle = endAngle;
      return {
        ...seg,
        path: makeArc(startAngle, endAngle),
        percent: ((seg.value / total) * 100).toFixed(0),
      };
    });

    return (
      <div className="db-chart-container w-100">
        <div className="db-chart-svg-box">
          <svg viewBox="0 0 100 100" width="160" height="160">
            {paths.map((p, i) => (
              <path key={i} d={p.path} fill={p.color} stroke="none" />
            ))}
          </svg>
          <div className="db-chart-center-label">
            <div className="db-chart-center-val">{total}</div>
            <div className="db-chart-center-text">Total</div>
          </div>
        </div>

        <div className="db-chart-legend">
          {paths.map((p, i) => (
            <div key={i} className="db-legend-item">
              <div className="db-legend-left">
                <span className="db-legend-dot" style={{ backgroundColor: p.color }} />
                <span className="db-legend-label">{p.label}</span>
              </div>
              <span className="db-legend-val">
                {p.value} ({p.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="db-wrapper">
      {/* Hero Welcome Banner */}
      <div className="db-hero-banner">
        <div className="db-hero-left">
          <p className="db-hero-subtitle">
            Here is what's happening with your leave balances, recent requests, and holiday schedule.
          </p>
        </div>

        <div className="db-hero-actions">
          <Link to="/apply-leave" className="db-action-btn-primary">
            <FiPlus size={16} />
            <span>Apply Leave</span>
          </Link>
          <Link to="/my-leaves" className="db-action-btn-secondary">
            <span>My Leaves</span>
          </Link>
          {user?.role === 'admin' && (
            <Link to="/leave-records" className="db-action-btn-secondary">
              <span>Leave Records</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="db-kpi-grid">
        <div className="db-kpi-card total">
          <div className="db-kpi-icon-wrapper">
            <FiCalendar />
          </div>
          <div className="db-kpi-info">
            <span className="db-kpi-label">Total Leave</span>
            <span className="db-kpi-value">{dashboardData?.leaveSummary?.totalLeave || '0'}</span>
            <span className="db-kpi-hint">Annual entitlement quota</span>
          </div>
        </div>

        <div className="db-kpi-card balance">
          <div className="db-kpi-icon-wrapper">
            <FiCheckCircle />
          </div>
          <div className="db-kpi-info">
            <span className="db-kpi-label">Leave Balance</span>
            <span className="db-kpi-value">
              {dashboardData?.leaveSummary?.balanceLeave || '0'}
            </span>
            <span className="db-kpi-hint">Available to apply</span>
          </div>
        </div>

        <div className="db-kpi-card early">
          <div className="db-kpi-icon-wrapper">
            <FiClock />
          </div>
          <div className="db-kpi-info">
            <span className="db-kpi-label">Early / Short Leave</span>
            <span className="db-kpi-value">{dashboardData?.leaveSummary?.earlyLeave || '0'}</span>
            <span className="db-kpi-hint">Quarterly quota</span>
          </div>
        </div>

        <div className="db-kpi-card requests">
          <div className="db-kpi-icon-wrapper">
            <FiTrendingUp />
          </div>
          <div className="db-kpi-info">
            <span className="db-kpi-label">Total Applications</span>
            <span className="db-kpi-value">{leaves?.length || 0}</span>
            <span className="db-kpi-hint">Submitted requests</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Two Column Layout */}
      <div className="db-grid-main">
        {/* Left Column (Recent Activity + Analytics) */}
        <div>
          {/* Recent Activity Card */}
          <div className="db-panel-card">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiClock />
                <span>Recent Leave Activity</span>
              </h3>
              <Link to="/my-leaves" className="db-panel-link">
                <span>View All</span>
                <FiArrowRight size={14} />
              </Link>
            </div>

            {dashboardLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" variant="primary" />
                <span className="ms-2 text-muted small">Loading activity...</span>
              </div>
            ) : recentActivities.length > 0 ? (
              <div className="db-activity-list">
                {recentActivities.map((leave) => {
                  const status = (leave.status || 'Pending').toLowerCase();
                  return (
                    <div
                      key={leave.id}
                      className="db-activity-item"
                      onClick={() => navigate(`/leave-details/${leave.id}`)}
                    >
                      <div className="db-activity-left">
                        <div className="db-activity-icon-badge">
                          <FiFileText />
                        </div>
                        <div>
                          <div className="db-activity-type">
                            {leave.leave_type || leave.type || 'Leave'}
                          </div>
                          <div className="db-activity-dates">
                            <FiCalendar size={12} />
                            <span>
                              {formatDate(leave.start_date || leave.fromDate)}
                              {(leave.end_date || leave.toDate) &&
                                (leave.end_date || leave.toDate) !== (leave.start_date || leave.fromDate)
                                ? ` → ${formatDate(leave.end_date || leave.toDate)}`
                                : ''}
                            </span>
                            {leave.applicationType && (
                              <span className="badge bg-light text-dark border ms-1">
                                {leave.applicationType}
                              </span>
                            )}
                          </div>
                          {leave.reason && (
                            <div className="db-activity-reason" title={leave.reason}>
                              "{leave.reason}"
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className={`db-status-badge ${status}`}>
                          <span className="db-status-dot" />
                          <span>{leave.status || 'Pending'}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted small">
                No recent leave activity found.
              </div>
            )}
          </div>

          {/* Monthly Statistics Card */}
          <div className="db-panel-card">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiTrendingUp />
                <span>
                  Monthly Leave Distribution (
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                </span>
              </h3>
            </div>
            <DonutChart data={monthlyStats} />
          </div>
        </div>

        {/* Right Column (Upcoming Holidays + Leave Policy Tips) */}
        <div>
          {/* Upcoming Holidays Card */}
          <div className="db-panel-card">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiCalendar />
                <span>Upcoming Holidays</span>
              </h3>
              <Link to="/holidays" className="db-panel-link">
                <span>All Holidays</span>
                <FiArrowRight size={14} />
              </Link>
            </div>

            {holidaysLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" variant="primary" />
                <span className="ms-2 text-muted small">Loading holidays...</span>
              </div>
            ) : upcomingHolidays.length > 0 ? (
              <div className="db-holiday-list">
                {upcomingHolidays.map((holiday) => {
                  const hDate = new Date(holiday.date);
                  const dayNum = hDate.getDate();
                  const monthShort = hDate.toLocaleDateString('en-US', { month: 'short' });
                  return (
                    <div key={holiday.id} className="db-holiday-item">
                      <div className="db-holiday-date-badge">
                        <span className="db-holiday-date-day">{dayNum}</span>
                        <span className="db-holiday-date-month">{monthShort}</span>
                      </div>
                      <div className="db-holiday-info">
                        <div className="db-holiday-title" title={holiday.purpose}>
                          {holiday.purpose}
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span className="db-holiday-type-pill">{holiday.type || 'General'}</span>
                          <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                            {getDaysAway(holiday.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted small">
                No upcoming holidays scheduled.
              </div>
            )}
          </div>

          {/* Quick Leave Policy / Guidelines Card */}
          <div className="db-panel-card">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiInfo />
                <span>Leave Guidelines</span>
              </h3>
            </div>

            <div className="db-tips-list">
              <div className="db-tip-item">
                <FiCheckCircle />
                <span>Apply for planned leaves at least 2 days prior for manager review.</span>
              </div>
              <div className="db-tip-item">
                <FiCheckCircle />
                <span>Up to 5 earned leaves can be carried forward to the following calendar year.</span>
              </div>
              <div className="db-tip-item">
                <FiCheckCircle />
                <span>Quarterly / early leave balance resets at the beginning of each quarter.</span>
              </div>
              <div className="db-tip-item">
                <FiCheckCircle />
                <span>Check the status of pending requests directly on your My Leaves page.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
