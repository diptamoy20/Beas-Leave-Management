import React, { useEffect, useState } from 'react';
import { FiChevronLeft, FiCheck, FiClock, FiX } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaves } from '../store/slices/leaveSlice';
import '../assets/css/LeaveDetails.css';

const LeaveDetails = ({ leave: propLeave, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { leaves, loading } = useSelector((state) => state.leave);
  const [localLeave, setLocalLeave] = useState(null);

  useEffect(() => {
    if (propLeave) {
      setLocalLeave(propLeave);
    } else if (id) {
      dispatch(fetchLeaves(id));
    }
  }, [id, propLeave, dispatch]);

  useEffect(() => {
    if (!propLeave && id && leaves && leaves.length > 0) {
      const foundLeave = leaves.find(l => String(l.id) === String(id)) || leaves[0];
      setLocalLeave(foundLeave);
    }
  }, [leaves, id, propLeave]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const leave = propLeave || localLeave;

  if (loading && !leave) return <div className="text-center py-5">Loading...</div>;
  if (!leave) return null;

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const formatShortDate = (dateString) => {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GB', options);
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

  // Mock Request ID if not provided by backend
  const requestId = leave.id;
  const days = leave.no_of_days || 0;
  const daysText = `${days} Day${days !== 1 ? 's' : ''}`;

  return (
    <div className="leave-details-container">
      <div className="leave-details-header" onClick={handleBack}>
        <FiChevronLeft size={24} />
        <span>Leave Detail</span>
      </div>

      <div className="ld-card">
        <div className="ld-title-row">
          <h2 className="ld-leave-type">{leave.leave_type || 'Leave'}</h2>
          <span className={`ld-status-badge ld-status-${getStatusClass(leave.status)}`}>
            {getStatusText(leave.status)}
          </span>
        </div>

        <div className="ld-date-range">
          {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
        </div>

        <div className="ld-total-days-big">
          {daysText}
        </div>
      </div>

      <h3 className="ld-section-title">Leave Information</h3>
      <div className="ld-card">
        <div className="ld-info-row">
          <span className="ld-info-label">Leave Type</span>
          <span className="ld-info-value">{leave.leave_type}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Application</span>
          <span className="ld-info-value">{leave.duration || 'Full Day'}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Status</span>
          <span className={`ld-info-value ${getStatusClass(leave.status) === 'pending' ? 'text-warning' : (getStatusClass(leave.status) === 'approved' ? 'text-success' : 'text-danger')}`}>
            {getStatusText(leave.status)}
          </span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">From Date</span>
          <span className="ld-info-value">{formatDate(leave.start_date)}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">To Date</span>
          <span className="ld-info-value">{formatDate(leave.end_date)}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Applied On</span>
          <span className="ld-info-value">{formatDate(leave.created_at)}</span>
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

      <h3 className="ld-section-title">Approval Flow</h3>
      <div className="ld-card">
        <div className="ld-section-title mb-4">Approval Timeline</div>
        <div className="ld-timeline-container">
          {leave.approvalDetails && leave.approvalDetails.length > 0 ? (
            leave.approvalDetails.map((approval, index) => (
              <div className="ld-timeline-item" key={index}>
                <div className={`ld-timeline-icon ${getStatusClass(approval.status)}`}>
                  {approval.status === 'Approved' && <FiCheck size={18} />}
                  {approval.status === 'Rejected' && <FiX size={18} />}
                  {approval.status !== 'Approved' && approval.status !== 'Rejected' && <FiClock size={18} />}
                </div>
                <div className="ld-timeline-content">
                  <p className="ld-timeline-name">{approval.manager_name}</p>
                  <p className="ld-timeline-role">{approval.designation || 'Manager'}</p>
                  <p className={`ld-timeline-status ${getStatusClass(approval.status)}`}>
                    {approval.status === 'Approved' ? `Approved • ${formatShortDate(leave.updated_at || leave.created_at)}` : 'Pending'}
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
          <span className="ld-info-value">{requestId}</span>
        </div>
        <div className="ld-info-row">
          <span className="ld-info-label">Applied On</span>
          <span className="ld-info-value">{formatShortDate(leave.created_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default LeaveDetails;
