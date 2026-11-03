import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import {
  FiClock,
  FiPlus,
  FiCalendar,
  FiSearch,
  FiUser,
  FiRefreshCw,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiCheckCircle,
  FiAlertCircle,
  FiFileText,
  FiLayers
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const CompOffManagement = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const isManagerOrAdmin =
    user?.role === 'manager' ||
    ['super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3'].includes(user?.role);

  const [activeTab, setActiveTab] = useState(isManagerOrAdmin ? 'history' : 'my_history');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [balances, setBalances] = useState([]);
  const [mySummary, setMySummary] = useState({ balance: 0, totalCredited: 0, totalUsed: 0, history: [] });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Credit Modal State
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [creditDays, setCreditDays] = useState(1);
  const [creditReason, setCreditReason] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchMySummary = async () => {
    try {
      const res = await axios.get('/api/comp-off/my-summary', { headers: getAuthHeaders() });
      setMySummary(res.data.data || { balance: 0, totalCredited: 0, totalUsed: 0, history: [] });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/comp-off/history', {
        headers: getAuthHeaders(),
        params: { search }
      });
      setHistory(res.data.data?.history || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch Comp-Off history');
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await axios.get('/api/comp-off/balances', {
        headers: getAuthHeaders(),
        params: { search }
      });
      setBalances(res.data.data?.balances || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployeesForCredit = async () => {
    try {
      const res = await axios.get('/api/employees', { headers: getAuthHeaders() });
      setEmployeesList(res.data.data?.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([
      fetchMySummary(),
      isManagerOrAdmin ? fetchHistory() : Promise.resolve(),
      isManagerOrAdmin ? fetchBalances() : Promise.resolve()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (isManagerOrAdmin) {
      fetchEmployeesForCredit();
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    if (!isManagerOrAdmin) return;
    const timer = setTimeout(() => {
      if (activeTab === 'history') fetchHistory();
      if (activeTab === 'balances') fetchBalances();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeTab]);

  const openCreditModalWithEmployee = (empId = '') => {
    setSelectedEmpId(empId ? String(empId) : '');
    setWorkDate('');
    setCreditDays(1);
    setCreditReason('');
    setShowCreditModal(true);
  };

  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      alert('Please select an employee.');
      return;
    }
    if (!workDate) {
      alert('Please provide the date worked (weekend/holiday).');
      return;
    }
    if (!creditReason.trim()) {
      alert('Please provide a reason for crediting Comp-Off.');
      return;
    }

    setSubmittingCredit(true);
    try {
      await axios.post(
        '/api/comp-off/credit',
        {
          employee_id: selectedEmpId,
          days: Number(creditDays),
          work_date: workDate,
          reason: creditReason
        },
        { headers: getAuthHeaders() }
      );

      setMessage(`Comp-Off successfully credited (${creditDays} day(s)) to employee #${selectedEmpId}.`);
      setShowCreditModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to credit Comp-Off');
    } finally {
      setSubmittingCredit(false);
    }
  };

  const stats = useMemo(() => {
    const totalCredited = history
      .filter((h) => h.type === 'CREDIT')
      .reduce((sum, h) => sum + h.days, 0);

    const totalUsed = history
      .filter((h) => h.type === 'DEBIT')
      .reduce((sum, h) => sum + h.days, 0);

    const activePool = balances.reduce(
      (sum, b) => sum + Number(b.comp_off_balance || 0),
      0
    );

    const employeesWithBalance = balances.filter(
      (b) => Number(b.comp_off_balance) > 0
    ).length;

    return { totalCredited, totalUsed, activePool, employeesWithBalance };
  }, [history, balances]);

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Leave Management</span> / <span className="active">Comp-Off Ledger</span>
          </div>
          <h1 className="elh-page-title">
            <FiClock style={{ marginRight: '10px', color: '#0dcaf0' }} />
            Compensatory Off (Comp-Off) Management
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
            Credit days for weekend or holiday work, monitor balances, and track complete usage history.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={loadData} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
            Refresh
          </Button>
          {isManagerOrAdmin && (
            <Button
              variant="primary"
              onClick={() => openCreditModalWithEmployee('')}
              style={{ backgroundColor: '#0dcaf0', borderColor: '#0dcaf0', color: '#000' }}
              className="fw-semibold"
            >
              <FiPlus style={{ marginRight: '6px' }} /> Credit Comp-Off
            </Button>
          )}
          <Button
            variant="outline-primary"
            onClick={() => navigate('/apply-leave')}
          >
            <FiFileText style={{ marginRight: '6px' }} /> Apply Comp-Off
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)}>
          <FiCheckCircle style={{ marginRight: '8px' }} /> {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <FiAlertCircle style={{ marginRight: '8px' }} /> {error}
        </Alert>
      )}

      {/* KPI Stats Row */}
      <div className="row g-3 mb-4">
        {/* Personal Balance Card for Everyone */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #0dcaf0' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">My Comp-Off Balance</span>
                <h3 className="mb-0 mt-1 fw-bold text-info">{mySummary.balance}</h3>
                <small className="text-muted">{mySummary.totalUsed} days used so far</small>
              </div>
              <div className="p-3 rounded-circle bg-info-subtle">
                <FiClock size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>

        {isManagerOrAdmin && (
          <>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #198754' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small text-uppercase fw-bold">Total Days Credited</span>
                    <h3 className="mb-0 mt-1 fw-bold text-success">{stats.totalCredited}</h3>
                    <small className="text-muted">Company-wide grants</small>
                  </div>
                  <div className="p-3 rounded-circle bg-success-subtle">
                    <FiArrowUpRight size={24} className="text-success" />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #dc3545' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small text-uppercase fw-bold">Total Days Consumed</span>
                    <h3 className="mb-0 mt-1 fw-bold text-danger">{stats.totalUsed}</h3>
                    <small className="text-muted">Approved leave debits</small>
                  </div>
                  <div className="p-3 rounded-circle bg-danger-subtle">
                    <FiArrowDownLeft size={24} className="text-danger" />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #6f42c1' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small text-uppercase fw-bold">Active Pool Balance</span>
                    <h3 className="mb-0 mt-1 fw-bold" style={{ color: '#6f42c1' }}>{stats.activePool}</h3>
                    <small className="text-muted">{stats.employeesWithBalance} employee(s) eligible</small>
                  </div>
                  <div className="p-3 rounded-circle" style={{ backgroundColor: 'rgba(111, 66, 193, 0.1)' }}>
                    <FiLayers size={24} style={{ color: '#6f42c1' }} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Tabs Card */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="btn-group" role="group">
            {isManagerOrAdmin && (
              <>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setActiveTab('history')}
                >
                  All Transactions ({history.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'balances' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setActiveTab('balances')}
                >
                  Employee Balances ({balances.length})
                </button>
              </>
            )}
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'my_history' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('my_history')}
            >
              My Comp-Off History ({mySummary.history.length})
            </button>
          </div>

          {isManagerOrAdmin && activeTab !== 'my_history' && (
            <div style={{ maxWidth: '300px', width: '100%' }}>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <FiSearch />
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search by employee, ID, reason..."
                  className="border-start-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: ALL TRANSACTIONS (Manager & Admin) */}
        {isManagerOrAdmin && activeTab === 'history' && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Type</th>
                  <th>Employee</th>
                  <th>Days</th>
                  <th>Work Date / Leave Ref</th>
                  <th>Reason / Details</th>
                  <th>Authorized By</th>
                  <th>Transaction Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="mt-2 text-muted">Loading transactions...</div>
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No Comp-Off transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
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
                        <div className="fw-bold">{h.employee_name}</div>
                        <small className="text-muted">
                          #{h.employee_id} • {h.employee_designation || 'Staff'}
                        </small>
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
                        {h.work_date ? (
                          <div>
                            <FiCalendar className="me-1 text-muted" size={13} />
                            <strong>{h.work_date}</strong>
                            <small className="d-block text-muted">Weekend/Holiday Work</small>
                          </div>
                        ) : h.leave_request_id ? (
                          <div>
                            <Badge bg="light" text="dark" className="border">
                              Leave Request #{h.leave_request_id}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-dark">{h.reason}</span>
                      </td>
                      <td>
                        <div className="small">
                          <FiUser className="me-1 text-muted" size={13} />
                          <strong>{h.credited_by_name}</strong>
                          {h.credited_by && <span className="text-muted"> (#{h.credited_by})</span>}
                        </div>
                      </td>
                      <td>
                        <span className="text-muted small">{h.created_at}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: EMPLOYEE BALANCES (Manager & Admin) */}
        {isManagerOrAdmin && activeTab === 'balances' && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Available Balance</th>
                  <th>Total Credited</th>
                  <th>Total Consumed</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="mt-2 text-muted">Loading employee balances...</div>
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  balances.map((emp) => (
                    <tr key={emp.employee_id}>
                      <td>
                        <div className="fw-bold">{emp.name}</div>
                        <small className="text-muted">
                          #{emp.employee_id} • {emp.email}
                        </small>
                      </td>
                      <td>
                        <span className="text-secondary">{emp.designation || 'Staff'}</span>
                      </td>
                      <td>
                        <Badge
                          bg={Number(emp.comp_off_balance) > 0 ? 'info' : 'light'}
                          text={Number(emp.comp_off_balance) > 0 ? 'dark' : 'muted'}
                          className="px-3 py-2 fs-6 border"
                        >
                          {emp.comp_off_balance} day(s)
                        </Badge>
                      </td>
                      <td>
                        <span className="text-success fw-semibold">+{emp.total_credited}</span>
                      </td>
                      <td>
                        <span className="text-danger fw-semibold">-{emp.total_used}</span>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openCreditModalWithEmployee(emp.employee_id)}
                        >
                          <FiPlus className="me-1" /> Credit Days
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: MY PERSONAL COMP-OFF HISTORY */}
        {activeTab === 'my_history' && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Date Worked / Leave Ref</th>
                  <th>Reason</th>
                  <th>Credited By</th>
                  <th>Logged Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                    </td>
                  </tr>
                ) : mySummary.history.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      You have no Comp-Off credit or debit records yet.
                    </td>
                  </tr>
                ) : (
                  mySummary.history.map((h) => (
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
                        {h.work_date ? (
                          <div>
                            <FiCalendar className="me-1 text-muted" size={13} />
                            <strong>{h.work_date}</strong>
                          </div>
                        ) : h.leave_request_id ? (
                          <Badge bg="light" text="dark" className="border">
                            Leave #{h.leave_request_id}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span>{h.reason}</span>
                      </td>
                      <td>
                        <span className="small text-muted">{h.credited_by_name}</span>
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
        )}
      </div>

      {/* CREDIT COMP-OFF MODAL (For Admins & Managers) */}
      <Modal show={showCreditModal} onHide={() => setShowCreditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <FiPlus className="me-2 text-info" /> Credit Compensatory Off
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreditSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">1. Select Employee</Form.Label>
              <Form.Select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                required
              >
                <option value="">-- Choose Employee to Credit --</option>
                {employeesList.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.name} (#{emp.employee_id}) — {emp.designation || 'Staff'}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <Form.Group>
                  <Form.Label className="fw-semibold">2. Date Worked <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">Weekend or holiday worked</Form.Text>
                </Form.Group>
              </div>

              <div className="col-sm-6">
                <Form.Group>
                  <Form.Label className="fw-semibold">3. Credited Days <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">e.g. 0.5 (half) or 1.0 (full)</Form.Text>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-2">
              <Form.Label className="fw-semibold">4. Reason / Work Details <span className="text-danger">*</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Explain the work completed on weekend/holiday (e.g. Client emergency deployment, server maintenance)..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreditModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submittingCredit}
              style={{ backgroundColor: '#0dcaf0', borderColor: '#0dcaf0', color: '#000' }}
              className="fw-semibold"
            >
              {submittingCredit ? <Spinner animation="border" size="sm" /> : 'Confirm Credit'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default CompOffManagement;
