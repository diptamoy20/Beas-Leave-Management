import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Form, InputGroup, Spinner, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import { fetchEmployees, fetchEmployeeLeaveHistory, clearEmployeeHistory } from '../store/slices/empSlice';
import { useNavigate } from 'react-router-dom';
import '../assets/css/EmployeeLeaveHistory.css';

const STATUS_TABS = ['All', 'Approved', 'Pending', 'Rejected'];

const LeaveRecords = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [view, setView] = useState('list'); // 'list' or 'history'
  const [selectedEmpId, setSelectedEmpId] = useState(null);

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

  // Fetch leave history when employee selected or tab changes
  useEffect(() => {
    if (selectedEmpId) {
      dispatch(fetchEmployeeLeaveHistory({ employeeId: selectedEmpId, status: activeTab }));
    }
  }, [dispatch, selectedEmpId, activeTab]);

  const handleEmployeeClick = (empId) => {
    setSelectedEmpId(empId);
    setActiveTab('All');
    setView('history');
  };

  const handleBack = () => {
    setView('list');
    setSelectedEmpId(null);
    setActiveTab('All');
    dispatch(clearEmployeeHistory());
  };

  const handleLeaveClick = (leaveId) => {
    navigate(`/leave-details/${leaveId}`);
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getInitialColor = (name) => {
    const colors = ['#4c90a6', '#d7a24a', '#219a6b', '#cc5a3f', '#7c5cbf', '#2f7f8f'];
    const charCode = name ? name.charCodeAt(0) : 0;
    return colors[charCode % colors.length];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return '#219a6b';
      case 'Rejected': return '#cc5a3f';
      case 'Pending': return '#d7a24a';
      default: return '#6b7d85';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'Approved': return 'rgba(33, 154, 107, 0.1)';
      case 'Rejected': return 'rgba(204, 90, 63, 0.1)';
      case 'Pending': return 'rgba(215, 162, 74, 0.1)';
      default: return 'rgba(107, 125, 133, 0.1)';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
  };

  // Group leaves by month
  const groupedLeaves = useMemo(() => {
    if (!employeeLeaves || employeeLeaves.length === 0) return {};
    const groups = {};
    employeeLeaves.forEach((leave) => {
      const d = new Date(leave.fromDate);
      if (isNaN(d)) return;
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(leave);
    });
    return groups;
  }, [employeeLeaves]);

  // ---- EMPLOYEE LIST VIEW ----
  if (view === 'list') {
    return (
      <div className="elh-container">
        <h4 className="mb-4 dashboard-toggle">Employee Leave History</h4>

        <div className="elh-search-wrapper">
          <InputGroup className="elh-search-input-group">
            <InputGroup.Text className="elh-search-icon">
              <FiSearch />
            </InputGroup.Text>
            <Form.Control
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="elh-search-input"
            />
          </InputGroup>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-5 text-muted">
            No employees found.
          </div>
        ) : (
          <div className="elh-employee-list">
            {employees.map((emp) => (
              <div
                key={emp.employee_id}
                className="elh-employee-card"
                onClick={() => handleEmployeeClick(emp.employee_id)}
              >
                <div className="elh-employee-avatar" style={{ background: getInitialColor(emp.name) }}>
                  {getInitial(emp.name)}
                </div>
                <div className="elh-employee-info">
                  <div className="elh-employee-name">{emp.name}</div>
                  <div className="elh-employee-designation">{emp.designation || 'Employee'}</div>
                  <div className="elh-employee-id">{emp.employee_id}</div>
                </div>
                <div className="elh-employee-arrow">
                  <FiChevronRight size={20} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- EMPLOYEE LEAVE HISTORY VIEW ----
  return (
    <div className="elh-container">
      <div className="elh-header" onClick={handleBack}>
        <FiChevronLeft size={22} />
        <span>Leave History</span>
      </div>

      {historyLoading && !selectedEmployee ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          {/* Employee Info Card */}
          {selectedEmployee && (
            <Card className="elh-emp-info-card">
              <Card.Body>
                <div className="elh-emp-info-name">{selectedEmployee.name}</div>
                <div className="elh-emp-info-id">Employee id: {selectedEmployee.employeeId}</div>
                <div className="elh-emp-info-designation">{selectedEmployee.designation || 'Employee'}</div>
              </Card.Body>
            </Card>
          )}

          {/* Leave Summary Cards */}
          {leaveSummary && (
            <div className="elh-summary-row">
              <div className="elh-summary-card">
                <div className="elh-summary-label">Total Leave</div>
                <div className="elh-summary-value" style={{ color: '#405189' }}>{leaveSummary.totalLeave}</div>
              </div>
              <div className="elh-summary-card">
                <div className="elh-summary-label">Balance Leave</div>
                <div className="elh-summary-value" style={{ color: '#219a6b' }}>{leaveSummary.balanceLeave}</div>
              </div>
              <div className="elh-summary-card">
                <div className="elh-summary-label">Early Leave</div>
                <div className="elh-summary-value" style={{ color: '#cc5a3f' }}>{leaveSummary.earlyLeave}</div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="elh-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                className={`elh-tab ${activeTab === tab ? 'elh-tab-active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'Approved' ? 'Approve' : tab}
              </button>
            ))}
          </div>

          {/* Leave Records List */}
          {historyLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" variant="primary" />
            </div>
          ) : Object.keys(groupedLeaves).length === 0 ? (
            <div className="text-center py-4 text-muted">
              No leave records found.
            </div>
          ) : (
            <div className="elh-leaves-list">
              {Object.entries(groupedLeaves).map(([month, leaves]) => (
                <div key={month} className="elh-month-group">
                  <div className="elh-month-label">{month}</div>
                  {leaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="elh-leave-card"
                      onClick={() => handleLeaveClick(leave.id)}
                    >
                      <div className="elh-leave-card-top">
                        <div className="elh-leave-app-type">
                          {leave.applicationType === 'Full Day'
                            ? 'Full Day Application'
                            : leave.applicationType === 'Half Day'
                            ? 'Half Day Application'
                            : leave.applicationType === 'Quarterly Leave'
                            ? 'Early Leave Application'
                            : `${leave.applicationType} Application`}
                        </div>
                        <span
                          className="elh-leave-status-badge"
                          style={{
                            color: getStatusColor(leave.status),
                            background: getStatusBgColor(leave.status),
                          }}
                        >
                          {leave.status === 'Approved' ? 'Approve' : leave.status}
                        </span>
                      </div>
                      <div className="elh-leave-date">{formatDate(leave.fromDate)}</div>
                      <div className="elh-leave-card-bottom">
                        <span className="elh-leave-type">{leave.leaveType}</span>
                        <FiChevronRight className="elh-leave-arrow" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaveRecords;
