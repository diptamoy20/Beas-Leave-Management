import React, { useEffect } from 'react';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiFileText,
  FiCheck,
  FiX,
  FiInfo,
  FiLayers,
} from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaveDetail, clearLeaveDetail } from '../store/slices/leaveSlice';
import { Spinner } from 'react-bootstrap';
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

  // Normalise propLeave if passed from embedded views (e.g. ManageLeaves)
  const normalisePropLeave = (l) => {
    if (!l) return null;
    if (l.leaveType !== undefined) return l;
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
        date: a.date ? new Date(a.date).toLocaleDateString('en-GB') : '',
      })),
    };
  };

  const leave = propLeave ? normalisePropLeave(propLeave) : leaveDetail;
  const loading = detailLoading;

  if (loading && !leave) {
    return (
      <div className="ld-wrapper text-center py-5">
        <Spinner animation="border" variant="primary" style={{ width: '2.5rem', height: '2.5rem' }} />
        <div className="mt-3 text-muted">Loading leave details...</div>
      </div>
    );
  }

  if (!leave) {
    return (
      <div className="ld-wrapper">
        <button type="button" className="ld-back-btn mb-4" onClick={handleBack}>
          <FiArrowLeft size={18} />
          <span>Go Back</span>
        </button>
        <div className="text-center py-5 text-muted">Leave record not found.</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Approved':
        return 'approved';
      case 'Rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  };

  const statusClass = getStatusClass(leave.status);
  const days = leave.totalDays || 0;
  const daysText = `${days} Day${Number(days) !== 1 ? 's' : ''}`;

  return (
    <div className="ld-wrapper">
      {/* Header & Breadcrumb */}
      <div className="ld-page-header">
        <div className="ld-header-title-area">
          <div className="ld-breadcrumb">
            <span style={{ cursor: 'pointer' }} onClick={handleBack}>
              Leave Management
            </span>
            <span>/</span>
            <span>Leave Details</span>
            <span>/</span>
            <span className="active">#REQ-{leave.id}</span>
          </div>
          <h2 className="ld-page-title">Leave Application Details</h2>
        </div>

        <button type="button" className="ld-back-btn" onClick={handleBack}>
          <FiArrowLeft size={18} />
          <span>Back to Records</span>
        </button>
      </div>

      {/* Hero Overview Banner */}
      <div className="ld-hero-card">
        <div className="ld-hero-content">
          <div className="ld-hero-left">
            <h3 className="ld-hero-title">{leave.leaveType || 'Leave Application'}</h3>
            <div className="ld-hero-badges">
              <span className="ld-hero-badge app-type">
                <FiClock size={13} />
                <span>{leave.applicationType || 'Full Day'}</span>
              </span>
              <span className="ld-hero-badge date-badge">
                <FiCalendar size={13} />
                <span>
                  {formatDate(leave.fromDate)}
                  {leave.toDate && leave.toDate !== leave.fromDate ? ` → ${formatDate(leave.toDate)}` : ''}
                </span>
              </span>
            </div>
          </div>

          <div className="ld-hero-right">
            <div className="ld-duration-box">
              <div className="ld-duration-num">{days}</div>
              <div className="ld-duration-label">Day{Number(days) !== 1 ? 's' : ''} Requested</div>
            </div>

            <div className={`ld-status-hero-pill ${statusClass}`}>
              <span className="ld-status-dot" />
              <span>{leave.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Two-Column Layout */}
      <div className="ld-grid-layout">
        {/* Left Column (Main Specifications & Reason) */}
        <div>
          {/* Leave Information Tiles */}
          <div className="ld-card">
            <div className="ld-card-title">
              <FiLayers />
              <span>Leave Specifications</span>
            </div>

            <div className="ld-tiles-grid">
              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiCalendar />
                  <span>Leave Type</span>
                </div>
                <div className="ld-tile-value">{leave.leaveType || 'Leave'}</div>
              </div>

              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiClock />
                  <span>Application Mode</span>
                </div>
                <div className="ld-tile-value">{leave.applicationType || 'Full Day'}</div>
              </div>

              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiCalendar />
                  <span>From Date</span>
                </div>
                <div className="ld-tile-value">{formatDate(leave.fromDate)}</div>
              </div>

              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiCalendar />
                  <span>To Date</span>
                </div>
                <div className="ld-tile-value">{formatDate(leave.toDate)}</div>
              </div>

              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiClock />
                  <span>Duration</span>
                </div>
                <div className="ld-tile-value">{daysText}</div>
              </div>

              <div className="ld-tile">
                <div className="ld-tile-header">
                  <FiCheckCircle />
                  <span>Submission Date</span>
                </div>
                <div className="ld-tile-value">{formatDate(leave.appliedOn)}</div>
              </div>
            </div>
          </div>

          {/* Stated Reason */}
          <div className="ld-card">
            <div className="ld-card-title">
              <FiFileText />
              <span>Reason for Leave</span>
            </div>
            <p className="ld-reason-box">
              {leave.reason || 'No specific reason was provided for this application.'}
            </p>
          </div>

          {/* Rejection Reason (if rejected) */}
          {leave.rejectionReason && (
            <div className="ld-card ld-rejection-card">
              <div className="ld-card-title">
                <FiAlertCircle />
                <span>Rejection Reason</span>
              </div>
              <p className="ld-rejection-box">{leave.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Right Column (Approval Workflow & Metadata) */}
        <div>
          {/* Approval Workflow & Timeline */}
          <div className="ld-card">
            <div className="ld-card-title">
              <FiCheckCircle />
              <span>Approval Workflow</span>
            </div>

            <div className="ld-timeline">
              {leave.approvals && leave.approvals.length > 0 ? (
                leave.approvals.map((approval) => {
                  const nodeStatus = getStatusClass(approval.status);
                  return (
                    <div className="ld-timeline-item" key={approval.id}>
                      <div className={`ld-timeline-node ${nodeStatus}`}>
                        {approval.status === 'Approved' && <FiCheck size={11} />}
                        {approval.status === 'Rejected' && <FiX size={11} />}
                        {approval.status !== 'Approved' && approval.status !== 'Rejected' && (
                          <FiClock size={11} />
                        )}
                      </div>
                      <div className="ld-timeline-content">
                        <div className="ld-timeline-header">
                          <span className="ld-timeline-name">{approval.name}</span>
                          <span className={`badge ${nodeStatus === 'approved' ? 'bg-success' : nodeStatus === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                            {approval.status}
                          </span>
                        </div>
                        <div className="ld-timeline-role">{approval.designation || 'Manager'}</div>
                        {approval.date && (
                          <div className="ld-timeline-date">
                            Updated: {formatDate(approval.date)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted small py-2">
                  No dedicated approvers assigned for this request.
                </div>
              )}
            </div>
          </div>

          {/* Request Metadata Card */}
          <div className="ld-card">
            <div className="ld-card-title">
              <FiInfo />
              <span>Application Metadata</span>
            </div>

            <div className="ld-meta-list">
              <div className="ld-meta-row">
                <span className="ld-meta-label">Request ID</span>
                <span className="ld-meta-val">#REQ-{leave.id}</span>
              </div>
              <div className="ld-meta-row">
                <span className="ld-meta-label">Current Status</span>
                <span className={`ld-meta-val text-${statusClass === 'approved' ? 'success' : statusClass === 'rejected' ? 'danger' : 'warning'}`}>
                  {leave.status}
                </span>
              </div>
              <div className="ld-meta-row">
                <span className="ld-meta-label">Total Leave Units</span>
                <span className="ld-meta-val">{days} Day{Number(days) !== 1 ? 's' : ''}</span>
              </div>
              <div className="ld-meta-row">
                <span className="ld-meta-label">Submitted On</span>
                <span className="ld-meta-val">{formatDate(leave.appliedOn)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveDetails;
