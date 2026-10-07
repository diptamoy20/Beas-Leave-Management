import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaves } from '../store/slices/leaveSlice';
import DataTable from './common/DataTable';
import { useNavigate, Link } from 'react-router-dom';
import {
  FiCalendar,
  FiSearch,
  FiX,
  FiPlus,
  FiEye,
  FiClock,
  FiFileText,
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const MyLeaves = () => {
  const dispatch = useDispatch();
  const { leaves, loading } = useSelector((state) => state.leave);
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      dispatch(fetchLeaves(searchTerm));
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [dispatch, searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusClass = (status || 'pending').toLowerCase();
    return (
      <span className={`elh-status-badge ${statusClass}`}>
        <span className="elh-status-dot" />
        <span>{status || 'Pending'}</span>
      </span>
    );
  };

  const columns = [
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '180px',
      cell: (row) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="text-muted" size={14} />
          <strong>{row.leave_type || 'Leave'}</strong>
        </div>
      ),
    },
    {
      name: 'Date Period',
      sortable: true,
      width: '240px',
      selector: (row) => row.start_date,
      cell: (row) => (
        <span>
          {formatDate(row.start_date)}
          {row.end_date && row.end_date !== row.start_date ? ` → ${formatDate(row.end_date)}` : ''}
        </span>
      ),
    },
    {
      name: 'Duration',
      selector: (row) => row.no_of_days,
      sortable: true,
      width: '120px',
      cell: (row) => (
        <span className="fw-semibold text-primary">
          {row.no_of_days} Day{Number(row.no_of_days) !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      sortable: true,
      grow: 2,
      cell: (row) => (
        <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '280px' }} title={row.reason}>
          {row.reason || '—'}
        </span>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '140px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Applied On',
      selector: (row) => row.created_at,
      sortable: true,
      width: '140px',
      cell: (row) => <span className="text-muted small">{formatDate(row.created_at)}</span>,
    },
    {
      name: 'Action',
      width: '110px',
      right: true,
      cell: (row) => (
        <button
          type="button"
          className="elh-table-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/leave-details/${row.id}`);
          }}
        >
          <FiEye size={13} />
          <span>Details</span>
        </button>
      ),
    },
  ];

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span className="active">My Leaves</span>
          </div>
          <h2 className="elh-page-title">My Leave Requests</h2>
          <p className="elh-page-subtitle">
            Track your applied leaves, review manager approvals, and check submission statuses.
          </p>
        </div>

        <Link
          to="/apply-leave"
          className="elh-back-btn"
          style={{
            background: 'var(--secondary-color)',
            color: '#ffffff',
            borderColor: 'var(--secondary-color)',
            textDecoration: 'none',
          }}
        >
          <FiPlus size={16} />
          <span>Apply for Leave</span>
        </Link>
      </div>

      {/* Toolbar: Search & Counters */}
      <div className="elh-toolbar-card">
        <div className="elh-search-box">
          <FiSearch className="elh-search-icon-left" />
          <Form.Control
            type="text"
            placeholder="Search by leave type, status, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="elh-search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        <div className="elh-toolbar-actions">
          <div className="elh-count-pill">
            <FiFileText size={15} />
            <span>{leaves?.length || 0} Total Requests</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="elh-table-card">
        <DataTable
          columns={columns}
          data={leaves || []}
          progressPending={loading}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 30]}
          onRowClicked={(row) => navigate(`/leave-details/${row.id}`)}
          pointerOnHover
          highlightOnHover
        />
      </div>
    </div>
  );
};

export default MyLeaves;
