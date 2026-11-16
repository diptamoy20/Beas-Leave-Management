import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Modal, Button, Form, Spinner, Alert, Table } from 'react-bootstrap';
import {
  FiClock,
  FiPlus,
  FiCalendar,
  FiSearch,
  FiUser,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiArrowLeft,
  FiArrowRight,
  FiMail,
  FiInbox,
  FiGrid,
  FiList,
  FiAward,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const TRANSACTION_TABS = ['All', 'Credit', 'Debit'];

const EmployeeCompOff = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isManagerOrAdmin =
    user?.role === 'manager' ||
    ['super_admin', 'admin'].includes(user?.role);

  // URL-driven employee selection (matching LeaveRecords pattern exactly)
  const selectedEmpId = searchParams.get('empId');
  const view = selectedEmpId ? 'history' : 'list';

  // Directory state
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Selected employee detail state
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeBalance, setEmployeeBalance] = useState(0);
  const [employeeHistory, setEmployeeHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('All');

  // Credit Modal State
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [creditTargetEmpId, setCreditTargetEmpId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [creditDays, setCreditDays] = useState(1);
  const [creditReason, setCreditReason] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const getInitial = (name) => {
    return name ? name.trim().charAt(0).toUpperCase() : '?';
  };

  const getAvatarGradient = (name) => {
    const gradients = [
      'linear-gradient(135deg, #1f4e5f, #2f7f8f)',
      'linear-gradient(135deg, #219a6b, #157347)',
      'linear-gradient(135deg, #d7a24a, #b07d2b)',
      'linear-gradient(135deg, #cc5a3f, #a73e27)',
      'linear-gradient(135deg, #7c5cbf, #5a3e99)',
      'linear-gradient(135deg, #4c90a6, #2d6b7e)',
    ];
    const charCode = name ? name.charCodeAt(0) : 0;
    return gradients[charCode % gradients.length];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Fetch balances list for directory
  const fetchBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/comp-off/balances', {
        headers: getAuthHeaders(),
        params: { search },
      });
      setBalances(res.data.data?.balances || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch Comp-Off balances');
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees for modal
  const fetchEmployeesForCredit = async () => {
    try {
      const res = await axios.get('/api/employees', { headers: getAuthHeaders() });
      setEmployeesList(res.data.data?.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load selected employee's Comp-Off details & history
  const fetchEmployeeCompOffDetails = async (empId) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`/api/comp-off/employee/${empId}`, {
        headers: getAuthHeaders(),
      });
      const data = res.data.data;
      setSelectedEmployee(data.employee);
      setEmployeeBalance(Number(data.balance || 0));
      setEmployeeHistory(data.history || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load employee comp-off details');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!isManagerOrAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchEmployeesForCredit();
  }, [isManagerOrAdmin, navigate]);

  useEffect(() => {
    if (!isManagerOrAdmin) return;
    const timer = setTimeout(() => {
      fetchBalances();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedEmpId) {
      fetchEmployeeCompOffDetails(selectedEmpId);
    } else {
      setSelectedEmployee(null);
      setEmployeeHistory([]);
      setEmployeeBalance(0);
    }
  }, [selectedEmpId]);

  const handleEmployeeClick = (empId) => {
    setActiveTab('All');
    setSearchParams({ empId });
  };

  const handleBackToEmployees = () => {
    setActiveTab('All');
    setSearchParams({});
    fetchBalances();
  };

  const openCreditModalWithEmployee = (empId) => {
    setCreditTargetEmpId(empId || selectedEmpId || '');
    setWorkDate('');
    setCreditDays(1);
    setCreditReason('');
    setShowCreditModal(true);
  };

  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    if (!creditTargetEmpId) {
      alert('Please select an employee');
      return;
    }
    setSubmittingCredit(true);
    try {
      const res = await axios.post(
        '/api/comp-off/credit',
        {
          employee_id: creditTargetEmpId,
          days: creditDays,
          work_date: workDate,
          reason: creditReason,
        },
        { headers: getAuthHeaders() }
      );
      setMessage(res.data.message || 'Comp-off credited successfully');
      setShowCreditModal(false);

      fetchBalances();
      if (selectedEmpId && String(selectedEmpId) === String(creditTargetEmpId)) {
        fetchEmployeeCompOffDetails(selectedEmpId);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to credit Comp-Off');
    } finally {
      setSubmittingCredit(false);
    }
  };

  const tabCounts = useMemo(() => {
    const counts = { All: employeeHistory.length, Credit: 0, Debit: 0 };
    employeeHistory.forEach((h) => {
      if (h.type === 'CREDIT') counts.Credit++;
      if (h.type === 'DEBIT') counts.Debit++;
    });
    return counts;
  }, [employeeHistory]);

  const filteredHistory = useMemo(() => {
    if (activeTab === 'Credit') {
      return employeeHistory.filter((h) => h.type === 'CREDIT');
    }
    if (activeTab === 'Debit') {
      return employeeHistory.filter((h) => h.type === 'DEBIT');
    }
    return employeeHistory;
  }, [employeeHistory, activeTab]);

  const totalCredited = useMemo(() => {
    return employeeHistory
      .filter((h) => h.type === 'CREDIT')
      .reduce((sum, h) => sum + Number(h.days || 0), 0);
  }, [employeeHistory]);

  const totalUsed = useMemo(() => {
    return employeeHistory
      .filter((h) => h.type === 'DEBIT')
      .reduce((sum, h) => sum + Number(h.days || 0), 0);
  }, [employeeHistory]);

  if (!isManagerOrAdmin) return null;

  // =========================================================================
  // VIEW 1: EMPLOYEE DIRECTORY LIST VIEW (PAGE 1) - IDENTICAL DESIGN TO LEAVERECORDS
  // =========================================================================
  if (view === 'list') {
    return (
      <div className="elh-wrapper">
        {/* Page Header */}
        <div className="elh-page-header">
          <div className="elh-header-title-area">
            <div className="elh-breadcrumb">
              <span>Admin Workspace</span>
              <span>/</span>
              <span className="active">Employee Comp-Off</span>
            </div>
            <h2 className="elh-page-title">Employee Comp-Off</h2>
            <p className="elh-page-subtitle">
              Browse employees to inspect compensatory off balances, view detailed ledgers, and grant comp-off credits.
            </p>
          </div>

          <button
            type="button"
            className="elh-back-btn"
            onClick={() => openCreditModalWithEmployee('')}
            style={{ borderColor: 'var(--secondary-color)', color: 'var(--secondary-color)' }}
          >
            <FiPlus size={18} />
            <span>Credit Comp-Off</span>
          </button>
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

        {/* Toolbar: Search & View Controls */}
        <div className="elh-toolbar-card">
          <div className="elh-search-box">
            <FiSearch className="elh-search-icon-left" />
            <Form.Control
              type="text"
              placeholder="Search by employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="elh-search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <div className="elh-toolbar-actions">
            <div className="elh-count-pill">
              <FiUser size={15} />
              <span>{balances?.length || 0} Employees</span>
            </div>

            <div className="elh-view-toggle">
              <button
                type="button"
                className={`elh-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
              >
                <FiGrid size={15} />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`elh-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <FiList size={15} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" style={{ width: '2.5rem', height: '2.5rem' }} />
            <div className="mt-3 text-muted">Loading employees...</div>
          </div>
        ) : !balances || balances.length === 0 ? (
          <div className="elh-empty-state">
            <FiInbox className="elh-empty-icon" />
            <div className="elh-empty-title">No Employees Found</div>
            <p className="elh-empty-text">
              {search
                ? `No employees matched the query "${search}". Try searching by another name or ID.`
                : 'There are currently no employee records available.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Responsive Card Grid (Identical CSS Classes to LeaveRecords) */
          <div className="elh-grid">
            {balances.map((emp) => (
              <div
                key={emp.employee_id}
                className="elh-grid-card"
                onClick={() => handleEmployeeClick(emp.employee_id)}
              >
                <div>
                  <div className="elh-card-header">
                    <div
                      className="elh-avatar"
                      style={{ background: getAvatarGradient(emp.name) }}
                    >
                      {getInitial(emp.name)}
                    </div>
                    <div className="elh-card-header-info">
                      <div className="elh-card-emp-name" title={emp.name}>
                        {emp.name}
                      </div>
                      <span className="elh-card-emp-id">
                        ID: {emp.employee_id}
                      </span>
                    </div>
                  </div>

                  <div className="elh-card-body">
                    <div className="elh-card-meta-row">
                      <FiAward />
                      <span className="elh-card-meta-value" title={emp.designation || 'Employee'}>
                        {emp.designation || 'Employee'}
                      </span>
                    </div>
                    {emp.email && (
                      <div className="elh-card-meta-row">
                        <FiMail />
                        <span className="elh-card-meta-value" title={emp.email}>
                          {emp.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="elh-card-footer">
                  <div className="elh-card-action-btn">
                    <span>View Comp-Off History</span>
                    <FiArrowRight size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Enterprise Web Table View (Identical to LeaveRecords) */
          <div className="elh-table-card">
            <Table responsive hover className="elh-web-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Designation</th>
                  <th>Email</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((emp) => (
                  <tr key={emp.employee_id} onClick={() => handleEmployeeClick(emp.employee_id)}>
                    <td>
                      <div className="elh-table-emp-cell">
                        <div
                          className="elh-table-avatar"
                          style={{ background: getAvatarGradient(emp.name) }}
                        >
                          {getInitial(emp.name)}
                        </div>
                        <div className="elh-table-emp-name">{emp.name}</div>
                      </div>
                    </td>
                    <td>
                      <span className="elh-card-emp-id">#{emp.employee_id}</span>
                    </td>
                    <td>{emp.designation || 'Employee'}</td>
                    <td>{emp.email || '—'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="elh-table-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmployeeClick(emp.employee_id);
                        }}
                      >
                        <span>View Records</span>
                        <FiArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* CREDIT COMP-OFF MODAL */}
        <Modal show={showCreditModal} onHide={() => setShowCreditModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold">
              <FiPlus className="me-2 text-primary" /> Credit Comp-Off to Employee
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleCreditSubmit}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">1. Select Employee</Form.Label>
                <Form.Select
                  value={creditTargetEmpId}
                  onChange={(e) => setCreditTargetEmpId(e.target.value)}
                  required
                >
                  <option value="">-- Choose an Employee --</option>
                  {employeesList.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} (#{emp.employee_id}) — {emp.designation || 'Staff'}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">2. Date Worked (Weekend / Holiday)</Form.Label>
                <Form.Control
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">3. Days to Credit</Form.Label>
                <Form.Select
                  value={creditDays}
                  onChange={(e) => setCreditDays(parseFloat(e.target.value))}
                >
                  <option value="0.5">0.5 Day (Half Day)</option>
                  <option value="1">1.0 Day (Full Day)</option>
                  <option value="1.5">1.5 Days</option>
                  <option value="2">2.0 Days</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label className="fw-semibold">4. Reason / Justification</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="e.g. Production release support on Saturday, Client server migration"
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
                style={{ backgroundColor: 'var(--secondary-color)', borderColor: 'var(--secondary-color)', color: '#fff' }}
                className="fw-semibold"
              >
                {submittingCredit ? <Spinner animation="border" size="sm" /> : 'Grant Comp-Off'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: EMPLOYEE COMP-OFF DASHBOARD & LEDGER (PAGE 2) - SAME DESIGN AS LEAVERECORDS
  // =========================================================================
  return (
    <div className="elh-wrapper">
      {/* Page Header with Breadcrumb & Back Action */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span style={{ cursor: 'pointer' }} onClick={handleBackToEmployees}>
              Employee Comp-Off History
            </span>
            <span>/</span>
            <span className="active">{selectedEmployee?.name || selectedEmpId}</span>
          </div>
          <h2 className="elh-page-title">
            {selectedEmployee ? `${selectedEmployee.name}'s Comp-Off Records` : 'Employee Comp-Off'}
          </h2>
          <p className="elh-page-subtitle">
            Detailed breakdown of comp-off credits, leave debits, and balance ledger.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="elh-back-btn" onClick={handleBackToEmployees}>
            <FiArrowLeft size={18} />
            <span>Back to Employee List</span>
          </button>
          <button
            type="button"
            className="elh-back-btn"
            onClick={() => openCreditModalWithEmployee(selectedEmpId)}
            style={{ borderColor: 'var(--secondary-color)', color: 'var(--secondary-color)' }}
          >
            <FiPlus size={18} />
            <span>Credit Comp-Off</span>
          </button>
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

      {detailLoading && !selectedEmployee ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" style={{ width: '2.5rem', height: '2.5rem' }} />
          <div className="mt-3 text-muted">Loading employee comp-off details...</div>
        </div>
      ) : (
        <>
          {/* Employee Hero Profile Banner (Identical to LeaveRecords) */}
          {selectedEmployee && (
            <div className="elh-hero-card">
              <div className="elh-hero-content">
                <div className="elh-hero-profile">
                  <div
                    className="elh-hero-avatar"
                    style={{ background: getAvatarGradient(selectedEmployee.name) }}
                  >
                    {getInitial(selectedEmployee.name)}
                  </div>
                  <div>
                    <h3 className="elh-hero-name">{selectedEmployee.name}</h3>
                    <div className="elh-hero-tags">
                      <span className="elh-hero-tag id-tag">
                        Emp ID: #{selectedEmployee.employee_id}
                      </span>
                      <span className="elh-hero-tag desig-tag">
                        {selectedEmployee.designation || 'Employee'}
                      </span>
                      {selectedEmployee.email && (
                        <span className="elh-hero-tag email-tag">
                          <FiMail size={13} />
                          {selectedEmployee.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KPI Summary Cards (Identical Layout to LeaveRecords elh-kpi-grid) */}
          <div className="elh-kpi-grid">
            <div className="elh-kpi-card">
              <div className="elh-kpi-icon-wrapper total">
                <FiAward />
              </div>
              <div className="elh-kpi-info">
                <span className="elh-kpi-label">Total Credited</span>
                <span className="elh-kpi-value text-success">{totalCredited}</span>
              </div>
            </div>

            <div className="elh-kpi-card">
              <div className="elh-kpi-icon-wrapper early">
                <FiClock />
              </div>
              <div className="elh-kpi-info">
                <span className="elh-kpi-label">Total Consumed</span>
                <span className="elh-kpi-value" style={{ color: '#cc5a3f' }}>{totalUsed}</span>
              </div>
            </div>

            <div className="elh-kpi-card">
              <div className="elh-kpi-icon-wrapper balance">
                <FiCheckCircle />
              </div>
              <div className="elh-kpi-info">
                <span className="elh-kpi-label">Comp-Off Balance</span>
                <span className="elh-kpi-value" style={{ color: '#219a6b' }}>
                  {employeeBalance}
                </span>
              </div>
            </div>

            <div className="elh-kpi-card">
              <div className="elh-kpi-icon-wrapper apps">
                <FiCalendar />
              </div>
              <div className="elh-kpi-info">
                <span className="elh-kpi-label">Total Transactions</span>
                <span className="elh-kpi-value">{employeeHistory.length}</span>
              </div>
            </div>
          </div>

          {/* Filter Status Tabs (Identical to LeaveRecords elh-tabs-container) */}
          <div className="elh-tabs-container">
            <div className="elh-filter-tabs">
              {TRANSACTION_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`elh-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <span>{tab === 'All' ? 'All Transactions' : tab}</span>
                  <span className="elh-tab-badge">
                    {tabCounts[tab] !== undefined ? tabCounts[tab] : 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-muted small">
              Showing <strong>{filteredHistory.length}</strong> record{filteredHistory.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Comp-Off Transactions Table (Identical to LeaveRecords elh-table-card) */}
          {detailLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" variant="primary" />
              <span className="ms-2 text-muted">Refreshing records...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="elh-empty-state">
              <FiInbox className="elh-empty-icon" />
              <div className="elh-empty-title">No Comp-Off Records Found</div>
              <p className="elh-empty-text">
                {activeTab === 'All'
                  ? 'This employee has no Comp-Off records recorded yet.'
                  : `No ${activeTab.toLowerCase()} records found for this employee.`}
              </p>
            </div>
          ) : (
            <div className="elh-table-card">
              <Table responsive hover className="elh-web-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Comp-Off Date(s)</th>
                    <th>Reason / Details</th>
                    <th>Authorized By</th>
                    <th className="text-end">Recorded On</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h) => {
                    const isCredit = h.type === 'CREDIT';
                    return (
                      <tr key={h.id}>
                        <td>
                          <span className={`elh-status-badge ${isCredit ? 'approved' : 'rejected'}`}>
                            <span className="elh-status-dot" />
                            <span>{h.type}</span>
                          </span>
                        </td>
                        <td>
                          <span
                            className="fw-semibold text-primary"
                          >
                            {isCredit ? `+${h.days}` : `-${h.days}`} Day{Number(h.days) !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          {isCredit ? (
                            h.work_date ? (
                              <div className="d-flex align-items-center gap-2">
                                <FiCalendar className="text-success" size={14} />
                                <span>{formatDate(h.work_date)}</span>
                                <span
                                  className="badge bg-success-subtle text-success border border-success-subtle py-0 px-1"
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  Worked
                                </span>
                              </div>
                            ) : (
                              <div className="d-flex align-items-center gap-2">
                                <FiCalendar className="text-muted" size={14} />
                                <span>{formatDate(h.created_at)}</span>
                              </div>
                            )
                          ) : (
                            h.leave_start_date ? (
                              <div className="d-flex flex-column gap-1">
                                <div className="d-flex align-items-center gap-2">
                                  <FiCalendar className="text-danger" size={14} />
                                  <span className="fw-medium">
                                    {formatDate(h.leave_start_date)}
                                    {h.leave_end_date && h.leave_end_date !== h.leave_start_date
                                      ? ` → ${formatDate(h.leave_end_date)}`
                                      : ''}
                                  </span>
                                </div>
                                <div className="d-flex align-items-center gap-1">
                                  <span
                                    className="badge bg-danger-subtle text-danger border border-danger-subtle py-0 px-1"
                                    style={{ fontSize: '0.72rem' }}
                                  >
                                    Leave Taken
                                  </span>
                                  {h.leave_request_id && (
                                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                      #{h.leave_request_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : h.work_date ? (
                              <div className="d-flex align-items-center gap-2">
                                <FiCalendar className="text-danger" size={14} />
                                <span>{formatDate(h.work_date)}</span>
                              </div>
                            ) : h.leave_request_id ? (
                              <div className="d-flex align-items-center gap-2">
                                <FiCalendar className="text-muted" size={14} />
                                <span className="badge bg-light text-dark border">
                                  Leave #{h.leave_request_id}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )
                          )}
                        </td>
                        <td>
                          <span
                            className="d-inline-block text-truncate text-muted"
                            style={{ maxWidth: '280px' }}
                            title={h.reason}
                          >
                            {h.reason || '—'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1 text-muted small">
                            <FiUser size={12} />
                            <span>{h.credited_by_name || 'System / Manager'}</span>
                          </div>
                        </td>
                        <td className="text-end text-muted small">
                          {formatDate(h.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* CREDIT COMP-OFF MODAL (Detail View) */}
      <Modal show={showCreditModal} onHide={() => setShowCreditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <FiPlus className="me-2 text-primary" /> Credit Comp-Off
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreditSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">1. Employee</Form.Label>
              <Form.Select
                value={creditTargetEmpId}
                onChange={(e) => setCreditTargetEmpId(e.target.value)}
                required
              >
                <option value="">-- Choose an Employee --</option>
                {employeesList.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.name} (#{emp.employee_id}) — {emp.designation || 'Staff'}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">2. Date Worked (Weekend / Holiday)</Form.Label>
              <Form.Control
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">3. Days to Credit</Form.Label>
              <Form.Select
                value={creditDays}
                onChange={(e) => setCreditDays(parseFloat(e.target.value))}
              >
                <option value="0.5">0.5 Day (Half Day)</option>
                <option value="1">1.0 Day (Full Day)</option>
                <option value="1.5">1.5 Days</option>
                <option value="2">2.0 Days</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="fw-semibold">4. Reason / Justification</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Reason for granting Comp-Off"
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
              style={{ backgroundColor: 'var(--secondary-color)', borderColor: 'var(--secondary-color)', color: '#fff' }}
              className="fw-semibold"
            >
              {submittingCredit ? <Spinner animation="border" size="sm" /> : 'Grant Comp-Off'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeCompOff;
