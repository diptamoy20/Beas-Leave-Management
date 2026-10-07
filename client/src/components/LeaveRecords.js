import React, { useEffect, useState, useMemo } from 'react';
import { Form, Spinner, Table } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiSearch,
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiFileText,
  FiEye,
  FiGrid,
  FiList,
  FiX,
  FiMail,
  FiUser,
  FiInbox,
  FiAward,
} from 'react-icons/fi';
import { fetchEmployees, fetchEmployeeLeaveHistory, clearEmployeeHistory } from '../store/slices/empSlice';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../assets/css/EmployeeLeaveHistory.css';

const STATUS_TABS = ['All', 'Approved', 'Pending', 'Rejected'];

const LeaveRecords = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search input state for employee list
  const [search, setSearch] = useState('');
  // View mode for employee list: 'grid' or 'table'
  const [viewMode, setViewMode] = useState('grid');
  // Active status filter tab for leave history
  const [activeTab, setActiveTab] = useState('All');

  // URL-driven employee selection (allows browser back button to work naturally)
  const selectedEmpId = searchParams.get('empId');
  const view = selectedEmpId ? 'history' : 'list';

  const {
    employees,
    loading,
    selectedEmployee,
    leaveSummary,
    employeeLeaves,
    historyLoading,
  } = useSelector((state) => state.employees);

  // Fetch employees on mount and on search change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(fetchEmployees(search));
    }, 300);
    return () => clearTimeout(timer);
  }, [dispatch, search]);

  // Fetch leave history when an employee is selected in the URL or status tab changes
  useEffect(() => {
    if (selectedEmpId) {
      dispatch(fetchEmployeeLeaveHistory({ employeeId: selectedEmpId, status: activeTab }));
    }
  }, [dispatch, selectedEmpId, activeTab]);

  const handleEmployeeClick = (empId) => {
    setActiveTab('All');
    setSearchParams({ empId });
  };

  const handleBackToEmployees = () => {
    setActiveTab('All');
    dispatch(clearEmployeeHistory());
    setSearchParams({});
  };

  const handleLeaveClick = (leaveId) => {
    navigate(`/leave-details/${leaveId}`);
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

  // Status counts for tabs
  const tabCounts = useMemo(() => {
    const counts = { All: 0, Approved: 0, Pending: 0, Rejected: 0 };
    if (!employeeLeaves) return counts;
    counts.All = employeeLeaves.length;
    employeeLeaves.forEach((l) => {
      const s = l.status;
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [employeeLeaves]);

  // Filtered leaves according to active tab
  const filteredLeaves = useMemo(() => {
    if (!employeeLeaves) return [];
    if (activeTab === 'All') return employeeLeaves;
    return employeeLeaves.filter((l) => l.status === activeTab);
  }, [employeeLeaves, activeTab]);

  // =========================================================================
  // VIEW 1: EMPLOYEE DIRECTORY LIST VIEW (PAGE 1)
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
              <span className="active">Employee Leave History</span>
            </div>
            <h2 className="elh-page-title">Employee Leave History</h2>
            <p className="elh-page-subtitle">
              Browse employees to inspect leave balances, view leave records, and review application history.
            </p>
          </div>
        </div>

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
              <span>{employees?.length || 0} Employees</span>
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
        ) : !employees || employees.length === 0 ? (
          /* Empty State */
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
          /* Responsive Card Grid */
          <div className="elh-grid">
            {employees.map((emp) => (
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
                    <span>View Leave History</span>
                    <FiArrowRight size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Enterprise Web Table View */
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
                {employees.map((emp) => (
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: EMPLOYEE LEAVE HISTORY & DASHBOARD (PAGE 2)
  // =========================================================================
  return (
    <div className="elh-wrapper">
      {/* Page Header with Breadcrumb & Back Action */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span style={{ cursor: 'pointer' }} onClick={handleBackToEmployees}>
              Employee Leave History
            </span>
            <span>/</span>
            <span className="active">{selectedEmployee?.name || selectedEmpId}</span>
          </div>
          <h2 className="elh-page-title">
            {selectedEmployee ? `${selectedEmployee.name}'s Leave Records` : 'Employee Leave History'}
          </h2>
          <p className="elh-page-subtitle">
            Detailed breakdown of leave balances, quarterly/early leaves, and submission records.
          </p>
        </div>

        <button type="button" className="elh-back-btn" onClick={handleBackToEmployees}>
          <FiArrowLeft size={18} />
          <span>Back to Employee List</span>
        </button>
      </div>

      {historyLoading && !selectedEmployee ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" style={{ width: '2.5rem', height: '2.5rem' }} />
          <div className="mt-3 text-muted">Loading employee leave profile...</div>
        </div>
      ) : (
        <>
          {/* Employee Hero Profile Banner */}
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
                        Emp ID: #{selectedEmployee.employeeId}
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

          {/* KPI Leave Summary Cards */}
          {leaveSummary && (
            <div className="elh-kpi-grid">
              <div className="elh-kpi-card">
                <div className="elh-kpi-icon-wrapper total">
                  <FiCalendar />
                </div>
                <div className="elh-kpi-info">
                  <span className="elh-kpi-label">Total Leave</span>
                  <span className="elh-kpi-value">{leaveSummary.totalLeave || 0}</span>
                </div>
              </div>

              <div className="elh-kpi-card">
                <div className="elh-kpi-icon-wrapper balance">
                  <FiCheckCircle />
                </div>
                <div className="elh-kpi-info">
                  <span className="elh-kpi-label">Balance Leave</span>
                  <span className="elh-kpi-value" style={{ color: '#219a6b' }}>
                    {leaveSummary.balanceLeave || 0}
                  </span>
                </div>
              </div>

              <div className="elh-kpi-card">
                <div className="elh-kpi-icon-wrapper early">
                  <FiClock />
                </div>
                <div className="elh-kpi-info">
                  <span className="elh-kpi-label">Early Leave</span>
                  <span className="elh-kpi-value" style={{ color: '#cc5a3f' }}>
                    {leaveSummary.earlyLeave || 0}
                  </span>
                </div>
              </div>

              <div className="elh-kpi-card">
                <div className="elh-kpi-icon-wrapper apps">
                  <FiFileText />
                </div>
                <div className="elh-kpi-info">
                  <span className="elh-kpi-label">Total Requests</span>
                  <span className="elh-kpi-value">{employeeLeaves?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Status Tabs */}
          <div className="elh-tabs-container">
            <div className="elh-filter-tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`elh-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <span>{tab === 'Approved' ? 'Approved' : tab}</span>
                  <span className="elh-tab-badge">
                    {tabCounts[tab] !== undefined ? tabCounts[tab] : 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-muted small">
              Showing <strong>{filteredLeaves.length}</strong> record{filteredLeaves.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Leave History Table */}
          {historyLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" variant="primary" />
              <span className="ms-2 text-muted">Refreshing records...</span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="elh-empty-state">
              <FiInbox className="elh-empty-icon" />
              <div className="elh-empty-title">No Leave Records Found</div>
              <p className="elh-empty-text">
                {activeTab === 'All'
                  ? 'This employee has no leave records submitted yet.'
                  : `No ${activeTab.toLowerCase()} leave requests found for this employee.`}
              </p>
            </div>
          ) : (
            <div className="elh-table-card">
              <Table responsive hover className="elh-web-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Application Type</th>
                    <th>Date Period</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Applied On</th>
                    <th>Reason</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((leave) => {
                    const statusClass = (leave.status || '').toLowerCase();
                    return (
                      <tr key={leave.id} onClick={() => handleLeaveClick(leave.id)}>
                        <td>
                          <strong>{leave.leaveType || 'Leave'}</strong>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {leave.applicationType || 'Full Day'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <FiCalendar className="text-muted" size={14} />
                            <span>
                              {formatDate(leave.fromDate)}
                              {leave.toDate && leave.toDate !== leave.fromDate
                                ? ` → ${formatDate(leave.toDate)}`
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="fw-semibold text-primary">
                            {leave.totalDays} Day{Number(leave.totalDays) !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <span className={`elh-status-badge ${statusClass}`}>
                            <span className="elh-status-dot" />
                            <span>{leave.status}</span>
                          </span>
                        </td>
                        <td className="text-muted small">{formatDate(leave.appliedOn)}</td>
                        <td>
                          <span
                            className="d-inline-block text-truncate text-muted"
                            style={{ maxWidth: '180px' }}
                            title={leave.reason}
                          >
                            {leave.reason || '—'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="elh-table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeaveClick(leave.id);
                            }}
                          >
                            <FiEye size={14} />
                            <span>Details</span>
                          </button>
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
    </div>
  );
};

export default LeaveRecords;
