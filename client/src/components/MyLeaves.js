import React, { useEffect } from 'react';
import { Card, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLeaves } from '../store/slices/leaveSlice';
import DataTable from './common/DataTable';

const MyLeaves = () => {
  const dispatch = useDispatch();
  const { leaves, loading } = useSelector((state) => state.leave);

  useEffect(() => {
    dispatch(fetchLeaves());
  }, [dispatch]);

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
      <h4 className="mb-4 dashboard-toggle">My Leave Requests</h4>
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
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default MyLeaves;
