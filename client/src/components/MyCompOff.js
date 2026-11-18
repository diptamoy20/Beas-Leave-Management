import React, { useEffect, useState, useMemo } from 'react';
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
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'CREDIT' | 'DEBIT' | 'PENDING'
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
        res.data.data || { balance: 0, totalCredited: 0, totalUsed: 0, history: [], pendingRequests: [] }
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

  const credits = mySummary.history.filter((h) => h.type === 'CREDIT');
  const debits = mySummary.history.filter((h) => h.type === 'DEBIT');
  const pendings = mySummary.pendingRequests || [];

  const filteredHistory = useMemo(() => {
    let list = mySummary.history;
    if (activeCategory === 'CREDIT') list = credits;
    if (activeCategory === 'DEBIT') list = debits;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((h) => (
      (h.reason || '').toLowerCase().includes(q) ||
      (h.type || '').toLowerCase().includes(q) ||
      (h.work_date || '').includes(q) ||
      (h.leave_start_date || '').includes(q) ||
      (h.credited_by_name || '').toLowerCase().includes(q) ||
      (h.leave_request_id ? String(h.leave_request_id).includes(q) : false)
    ));
  }, [mySummary.history, activeCategory, searchTerm, credits, debits]);

  const filteredPendings = useMemo(() => {
    if (!searchTerm.trim()) return pendings;
    const q = searchTerm.toLowerCase();
    return pendings.filter((p) => (
      (p.reason || '').toLowerCase().includes(q) ||
      (p.start_date || '').includes(q) ||
      (p.end_date || '').includes(q) ||
      (p.approver_info || '').toLowerCase().includes(q)
    ));
  }, [pendings, searchTerm]);

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
        <div className="card-header bg-white border-bottom py-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-2">
            <div>
              <span className="fw-bold text-dark fs-6">
                Comp-Off Transaction Ledger
              </span>
              <p className="text-muted small mb-0">
                Track all credit grants, leave deductions, and pending requests with full audit details.
              </p>
            </div>
            <div style={{ maxWidth: '300px', width: '100%' }}>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <FiSearch />
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search reason, date, approver..."
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

          {/* Category Tabs: All, Category A (Credits), Category B (Debits), Category C (Pending) */}
          <div className="d-flex flex-wrap gap-2 pt-2 border-top">
            <button
              className={`btn btn-sm ${activeCategory === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory('ALL')}
            >
              All Transactions ({mySummary.history.length})
            </button>
            <button
              className={`btn btn-sm ${activeCategory === 'CREDIT' ? 'btn-success text-white' : 'btn-outline-success'}`}
              onClick={() => setActiveCategory('CREDIT')}
            >
              <FiArrowUpRight className="me-1" />
              Credits ({credits.length})
            </button>
            <button
              className={`btn btn-sm ${activeCategory === 'DEBIT' ? 'btn-danger text-white' : 'btn-outline-danger'}`}
              onClick={() => setActiveCategory('DEBIT')}
            >
              <FiArrowDownLeft className="me-1" />
              Debits ({debits.length})
            </button>
            <button
              className={`btn btn-sm ${activeCategory === 'PENDING' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'}`}
              onClick={() => setActiveCategory('PENDING')}
            >
              <FiAlertCircle className="me-1" />
              Pending Applications ({pendings.length})
            </button>
          </div>
        </div>

        {/* Tab View Rendering */}
        <div className="table-responsive">
          {activeCategory === 'PENDING' ? (
            /* CATEGORY C: Pending Applications */
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Status</th>
                  <th>Requested Days</th>
                  <th>Date(s) Worked</th>
                  <th>Reason / Justification</th>
                  <th>Assigned Approver(s)</th>
                  <th className="text-end">Application Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="mt-2 text-muted">Loading pending requests...</div>
                    </td>
                  </tr>
                ) : filteredPendings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      {searchTerm ? 'No pending requests match your search.' : 'You have no pending Comp-Off applications.'}
                    </td>
                  </tr>
                ) : (
                  filteredPendings.map((req) => (
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
                      <td>
                        <span className="text-muted small">{req.approver_info || 'Reporting Authority / CEO'}</span>
                      </td>
                      <td className="text-end text-muted small">
                        {req.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeCategory === 'CREDIT' ? (
            /* CATEGORY A: Credit Transactions */
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Credit Type</th>
                  <th>Days Credited</th>
                  <th>Date Worked</th>
                  <th>Reason / Work Description</th>
                  <th>Source / Reference</th>
                  <th>Approved & Credited By</th>
                  <th className="text-end">Credit Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="mt-2 text-muted">Loading credit history...</div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      {searchTerm ? 'No credit transactions match your search.' : 'No Comp-Off credits logged yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <Badge bg="success" className="p-2">
                          <FiArrowUpRight className="me-1" /> CREDIT
                        </Badge>
                      </td>
                      <td>
                        <span className="fw-bold fs-6 text-success">
                          +{h.days} Day{h.days !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        {h.work_date ? (
                          <div>
                            <FiCalendar className="me-1 text-success" size={13} />
                            <strong>{h.work_date}</strong>
                            <small className="d-block text-muted">Weekend/Holiday</small>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-dark">{h.reason || '—'}</span>
                      </td>
                      <td>
                        {h.leave_request_id ? (
                          <Badge bg="light" text="dark" className="border">
                            Comp-Off #{h.leave_request_id}
                          </Badge>
                        ) : (
                          <Badge bg="light" text="secondary" className="border">
                            Direct Credit
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>{h.credited_by_name || 'System / Admin'}</strong>
                          {h.credited_by_designation && (
                            <small className="d-block text-muted">{h.credited_by_designation}</small>
                          )}
                        </div>
                      </td>
                      <td className="text-end text-muted small">
                        {h.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeCategory === 'DEBIT' ? (
            /* CATEGORY B: Debit Transactions */
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Debit Type</th>
                  <th>Days Deducted</th>
                  <th>Related Leave Period</th>
                  <th>Leave Type / Source</th>
                  <th>Deduction Reason</th>
                  <th>Deducted For / Authority</th>
                  <th className="text-end">Date of Deduction</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="mt-2 text-muted">Loading debit history...</div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      {searchTerm ? 'No debit transactions match your search.' : 'No Comp-Off deductions logged yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <Badge bg="danger" className="p-2">
                          <FiArrowDownLeft className="me-1" /> DEBIT
                        </Badge>
                      </td>
                      <td>
                        <span className="fw-bold fs-6 text-danger">
                          -{h.days} Day{h.days !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        {h.leave_start_date ? (
                          <div>
                            <FiCalendar className="me-1 text-danger" size={13} />
                            <strong>
                              {h.leave_start_date}
                              {h.leave_end_date && h.leave_end_date !== h.leave_start_date
                                ? ` → ${h.leave_end_date}`
                                : ''}
                            </strong>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {h.leave_request_id ? (
                          <div>
                            <Badge bg="light" text="dark" className="border">
                              Leave #{h.leave_request_id}
                            </Badge>
                            <small className="d-block text-muted">{h.leave_type || h.leave_duration || 'Leave'}</small>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-dark">{h.reason || 'Comp-Off consumed for approved leave'}</span>
                      </td>
                      <td>
                        <span className="small text-muted">{h.credited_by_name || 'Leave Approver'}</span>
                      </td>
                      <td className="text-end text-muted small">
                        {h.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* ALL TRANSACTIONS LEDGER */
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Date Worked / Leave Ref</th>
                  <th>Reason / Details</th>
                  <th>Authority / Approver</th>
                  <th className="text-end">Logged Date</th>
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
                          className={`fw-bold fs-6 ${h.type === 'CREDIT' ? 'text-success' : 'text-danger'}`}
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
                        <span className="small text-muted">{h.credited_by_name || 'System / Authority'}</span>
                      </td>
                      <td className="text-end text-muted small">
                        {h.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyCompOff;
