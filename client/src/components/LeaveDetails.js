import React, { useEffect } from 'react';
import { FiChevronLeft, FiCheck, FiClock, FiX } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaveDetail, clearLeaveDetail } from '../store/slices/leaveSlice';
import '../assets/css/LeaveDetails.css';

const LeaveDetails = ({ leave: propLeave, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { leaveDetail, detailLoading } = useSelector((state) => state.leave);

  useEffect(() => {
    if (!propLeave && id) {
      dispatch(fetchLeaveDetail(id));
    }
    return () => {
      dispatch(clearLeaveDetail());
    };
  }, [id, propLeave, dispatch]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // Normalise a propLeave (from list view, old snake_case shape) to the new camelCase shape
  const normalisePropLeave = (l) => {
    if (!l) return null;
    if (l.leaveType !== undefined) return l; // already new shape
    return {
      id: l.id,
      leaveType: l.leave_type,
      applicationType: l.duration || 'Full Day',
      status: l.status,
      fromDate: l.start_date ? new Date(l.start_date).toISOString().split('T')[0] : null,
      toDate: l.end_date ? new Date(l.end_date).toISOString().split('T')[0] : null,
      appliedOn: l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : null,
      totalDays: l.no_of_days,
      reason: l.reason,
      rejectionReason: l.rejection_reason || null,
      approvals: (l.approvalDetails || []).map((a, idx) => ({
        id: idx + 1,
        name: a.manager_name,
        designation: a.designation || 'Manager',
        status: a.status,
        date: a.date
          ? new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '',
      })),
    };
  };

  const leave = propLeave ? normalisePropLeave(propLeave) : leaveDetail;
  const loading = detailLoading;

  if (loading && !leave) return <div className="text-center py-5">Loading...</div>;
  if (!leave) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Approved': return 'approved';
      case 'Rejected': return 'rejected';
      default: return 'pending';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Approved': return 'Approved';
      case 'Rejected': return 'Rejected';
      default: return 'Pending';
    }
  };

  const days = leave.totalDays || 0;
  const daysText = `${days} Day${days !== 1 ? 's' : ''}`;

  return (
    <div className="leave-details-container">
      <div className="leave-details-header" onClick={handleBack}>
        <FiChevronLeft size={24} />
        <span>Leave Detail</span>
      </div>

      <div className="ld-card">
        <div className="ld-title-row">
          <h2 className="ld-leave-type">{leave.leaveType || 'Leave'}</h2>
          <span className={`ld-status-badge ld-status-${getStatusClass(leave.status)}`}>
            {getStatusText(leave.status)}
          </span>
        </div>

        <div className="ld-date-range">
          {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
        </div>

        <div className="ld-total-days-big">
          {daysText}
        </div>
      </div>

      <h3 className="ld-section-title">Leave Information</h3>
      <div className="ld-card">
        <div className="ld-info-row">
          <span className="ld-info-label">Leave Type</span>
          <span className="ld-info-value">{leave.leaveType}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Application</span>
          <span className="ld-info-value">{leave.applicationType || 'Full Day'}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Status</span>
          <span className={`ld-info-value ${getStatusClass(leave.status) === 'pending' ? 'text-warning' : (getStatusClass(leave.status) === 'approved' ? 'text-success' : 'text-danger')}`}>
            {getStatusText(leave.status)}
          </span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">From Date</span>
          <span className="ld-info-value">{formatDate(leave.fromDate)}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">To Date</span>
          <span className="ld-info-value">{formatDate(leave.toDate)}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Applied On</span>
          <span className="ld-info-value">{formatDate(leave.appliedOn)}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Total Days</span>
          <span className="ld-info-value blue-text">{daysText}</span>
        </div>
      </div>

      <h3 className="ld-section-title">Reason</h3>
      <div className="ld-card">
        <p className="ld-reason-text">{leave.reason}</p>
      </div>

      {leave.rejectionReason && (
        <>
          <h3 className="ld-section-title">Rejection Reason</h3>
          <div className="ld-card">
            <p className="ld-reason-text">{leave.rejectionReason}</p>
          </div>
        </>
      )}

      <h3 className="ld-section-title">Approval Flow</h3>
      <div className="ld-card">
        <div className="ld-section-title mb-4">Approval Timeline</div>
        <div className="ld-timeline-container">
          {leave.approvals && leave.approvals.length > 0 ? (
            leave.approvals.map((approval) => (
              <div className="ld-timeline-item" key={approval.id}>
                <div className={`ld-timeline-icon ${getStatusClass(approval.status)}`}>
                  {approval.status === 'Approved' && <FiCheck size={18} />}
                  {approval.status === 'Rejected' && <FiX size={18} />}
                  {approval.status !== 'Approved' && approval.status !== 'Rejected' && <FiClock size={18} />}
                </div>
                <div className="ld-timeline-content">
                  <p className="ld-timeline-name">{approval.name}</p>
                  <p className="ld-timeline-role">{approval.designation || 'Manager'}</p>
                  <p className={`ld-timeline-status ${getStatusClass(approval.status)}`}>
                    {approval.status === 'Approved'
                      ? `Approved - ${approval.date}`
                      : approval.status === 'Rejected'
                      ? `Rejected - ${approval.date}`
                      : 'Pending'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted">No approval flow assigned.</div>
          )}
        </div>
      </div>

      <h3 className="ld-section-title">Request Information</h3>
      <div className="ld-card">
        <div className="ld-info-row">
          <span className="ld-info-label">Request ID</span>
          <span className="ld-info-value">{leave.id}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Applied On</span>
          <span className="ld-info-value">{leave.appliedOn}</span>
        </div>
      </div>
    </div>
  );
};

export default LeaveDetails;
