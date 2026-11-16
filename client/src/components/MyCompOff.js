import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Alert, Badge, Spinner, Form } from 'react-bootstrap';
import {
  FiClock,
  FiPlus,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiCalendar,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const MyCompOff = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [mySummary, setMySummary] = useState({
    balance: 0,
    totalCredited: 0,
    totalUsed: 0,
    pendingDays: 0,
    history: [],
    pendingRequests: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchMySummary = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get('/api/comp-off/my-summary', {
        headers: getAuthHeaders(),
      });
      setMySummary(
        res.data.data || { balance: 0, totalCredited: 0, totalUsed: 0, history: [] }
      );
    } catch (err) {
      console.error(err);
      setFetchError('Failed to load your Comp-Off summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySummary();
  }, []);

  const filteredHistory = mySummary.history.filter((h) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (h.reason || '').toLowerCase().includes(q) ||
      (h.type || '').toLowerCase().includes(q) ||
      (h.work_date || '').includes(q) ||
      (h.credited_by_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Leave Management</span>
            <span>/</span>
            <span className="active">My Comp-Off</span>
          </div>
          <h2 className="elh-page-title">
            <FiClock style={{ marginRight: '10px', color: '#0dcaf0' }} />
            My Comp-Off
          </h2>
          <p className="elh-page-subtitle">
            View your current comp-off balance, days credited, days consumed, and full transaction history.
          </p>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchMySummary} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/apply-comp-off')}
          >
            <FiPlus style={{ marginRight: '6px' }} />
            Apply Comp-Off
          </Button>
        </div>
      </div>

      {fetchError && (
        <Alert variant="danger" dismissible onClose={() => setFetchError(null)}>
          <FiAlertCircle style={{ marginRight: '8px' }} /> {fetchError}
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #0dcaf0' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Available Balance</span>
                <h3 className="mb-0 mt-1 fw-bold text-info">{mySummary.balance} Days</h3>
                <small className="text-muted">Ready for use</small>
              </div>
              <div className="p-3 rounded-circle bg-info-subtle">
                <FiClock size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #ffc107' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Pending Approval</span>
                <h3 className="mb-0 mt-1 fw-bold text-warning">{mySummary.pendingDays || 0} Days</h3>
                <small className="text-muted">Awaiting authority decision</small>
              </div>
              <div className="p-3 rounded-circle bg-warning-subtle">
                <FiAlertCircle size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-4">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #198754' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Total Credited</span>
                <h3 className="mb-0 mt-1 fw-bold text-success">{mySummary.totalCredited} Days</h3>
                <small className="text-muted">Lifetime granted days</small>
              </div>
              <div className="p-3 rounded-circle bg-success-subtle">
                <FiArrowUpRight size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Comp-Off Requests Section */}
      {mySummary.pendingRequests && mySummary.pendingRequests.length > 0 && (
        <div className="card shadow-sm border-0 mb-4" style={{ borderLeft: '4px solid #ffc107' }}>
          <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span className="fw-semibold text-dark">
              ⏳ Comp-Off Requests Awaiting Approval
              <Badge bg="warning" text="dark" className="ms-2">
                {mySummary.pendingRequests.length} Pending
              </Badge>
            </span>
            <small className="text-muted">
              Will be added to your available Comp-Off balance once approved
            </small>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Status</th>
                  <th>Days Requested</th>
                  <th>Date(s) Worked</th>
                  <th>Reason / Justification</th>
                  <th className="text-end">Requested On</th>
                </tr>
              </thead>
              <tbody>
                {mySummary.pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <Badge bg="warning" text="dark" className="p-2">
                        ⏳ Pending Approval
                      </Badge>
                    </td>
                    <td>
                      <span className="fw-bold fs-6 text-primary">
                        +{req.days} Day{Number(req.days) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <FiCalendar className="text-muted" size={13} />
                        <strong>
                          {req.start_date}
                          {req.end_date && req.end_date !== req.start_date ? ` → ${req.end_date}` : ''}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <span className="text-dark">{req.reason || '—'}</span>
                    </td>
                    <td className="text-end text-muted small">
                      {req.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search + History Table */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <span className="fw-semibold text-dark">
            My Comp-Off History
            <Badge bg="secondary" className="ms-2">{mySummary.history.length}</Badge>
          </span>
          <div style={{ maxWidth: '300px', width: '100%' }}>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <FiSearch />
              </span>
              <Form.Control
                type="text"
                placeholder="Search reason, type, date..."
                className="border-start-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="btn btn-outline-secondary border-start-0"
                  type="button"
                  onClick={() => setSearchTerm('')}
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Days</th>
                <th>Date Worked / Leave Ref</th>
                <th>Reason</th>
                <th>Credited / Debited By</th>
                <th>Logged Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading your comp-off history...</div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    {searchTerm
                      ? 'No records match your search.'
                      : 'You have no Comp-Off credit or debit records yet.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.type === 'CREDIT' ? (
                        <Badge bg="success" className="p-2">
                          <FiArrowUpRight className="me-1" /> CREDIT
                        </Badge>
                      ) : (
                        <Badge bg="danger" className="p-2">
                          <FiArrowDownLeft className="me-1" /> DEBIT
                        </Badge>
                      )}
                    </td>
                    <td>
                      <span
                        className={`fw-bold fs-6 ${
                          h.type === 'CREDIT' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {h.type === 'CREDIT' ? `+${h.days}` : `-${h.days}`}
                      </span>
                    </td>
                    <td>
                      {h.type === 'CREDIT' ? (
                        h.work_date ? (
                          <div>
                            <FiCalendar className="me-1 text-success" size={13} />
                            <strong>{h.work_date}</strong>
                            <small className="d-block text-muted">Weekend/Holiday Work</small>
                          </div>
                        ) : (
                          <div>
                            <FiCalendar className="me-1 text-muted" size={13} />
                            <span>{h.created_at}</span>
                          </div>
                        )
                      ) : (
                        h.leave_start_date ? (
                          <div>
                            <FiCalendar className="me-1 text-danger" size={13} />
                            <strong>
                              {h.leave_start_date}
                              {h.leave_end_date && h.leave_end_date !== h.leave_start_date
                                ? ` → ${h.leave_end_date}`
                                : ''}
                            </strong>
                            <small className="d-block text-muted">
                              Leave Taken {h.leave_request_id ? `(#${h.leave_request_id})` : ''}
                            </small>
                          </div>
                        ) : h.leave_request_id ? (
                          <Badge bg="light" text="dark" className="border">
                            Leave #{h.leave_request_id}
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )
                      )}
                    </td>
                    <td>
                      <span className="text-dark">{h.reason || '—'}</span>
                    </td>
                    <td>
                      <span className="small text-muted">{h.credited_by_name || 'System'}</span>
                    </td>
                    <td>
                      <small className="text-muted">{h.created_at}</small>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyCompOff;
