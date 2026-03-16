import React, { useEffect, useState } from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';

const ManageLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllLeaves();
  }, []);

  const fetchAllLeaves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/leaves/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (leaveId, noOfDays, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/leaves/${leaveId}/status`,
        { noOfDays, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAllLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
    }
  };

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
      name: 'Employee',
      selector: (row) => row.employee_name,
      sortable: true,
      width: '200px',
    },
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '130px',
    },
    {
      name: 'Start Date',
      selector: (row) => new Date(row.start_date).toLocaleDateString('en-GB'),
      sortable: true,
      width: '120px',
    },
    {
      name: 'End Date',
      selector: (row) => new Date(row.end_date).toLocaleDateString('en-GB'),
      sortable: true,
      width: '120px',
    },
    {
      name: 'No of Days',
      selector: (row) => row.no_of_days,
      sortable: true,
      width: '120px',
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
      width: '110px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Actions',
      width: '200px',
      cell: (row) =>
        row.status === 'Pending' ? (
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => handleStatusUpdate(row.id, row.no_of_days, 'Approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleStatusUpdate(row.id, row.no_of_days, 'Rejected')}
            >
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted">No action</span>
        ),
    },
  ];

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Manage Leave Requests</h4>
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

export default ManageLeaves;
