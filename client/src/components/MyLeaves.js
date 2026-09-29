import React, { useEffect, useState } from 'react';
import { Card, Badge, Form } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaves } from '../store/slices/leaveSlice';
import DataTable from './common/DataTable';
import { useNavigate } from 'react-router-dom';
import LeaveDetails from './LeaveDetails';

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

  const getStatusBadge = (status) => {
    const variants = {
      Pending: 'warning',
      Approved: 'success',
      Rejected: 'danger',
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const columns = [
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '150px',
    },
    {
      name: 'Start Date',
      selector: (row) => new Date(row.start_date).toLocaleDateString('en-GB').replace(/\//g, '-'),
      sortable: true,
      width: '130px',
    },
    {
      name: 'End Date',
      selector: (row) => new Date(row.end_date).toLocaleDateString('en-GB').replace(/\//g, '-'),
      sortable: true,
      width: '130px',
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      sortable: true,
      grow: 2,
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '120px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Applied On',
      selector: (row) => new Date(row.created_at).toLocaleDateString('en-GB').replace(/\//g, '-'),
      sortable: true,
      width: '130px',
    },
  ];



  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 dashboard-toggle">
        <h4>My Leave Requests</h4>
        <Form.Group className="mb-0" style={{ width: '250px' }}>
          <Form.Control
            type="text"
            placeholder="Search leaves..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Form.Group>
      </div>
      <Card className="dashboard-card">
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">Loading...</div>
          ) : (
            <DataTable
              columns={columns}
              data={leaves}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[10, 20, 30]}
              onRowClicked={(row) => navigate(`/leave-details/${row.id}`)}
              pointerOnHover
              highlightOnHover
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default MyLeaves;
