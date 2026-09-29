import React, { useEffect, useState } from 'react';
import { Card, Badge, Button, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';
import LeaveDetails from './LeaveDetails';

const ManageLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState(null);
  const [rejectLeaveDays, setRejectLeaveDays] = useState(0);
  const [rejectReason, setRejectReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchAllLeaves(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchAllLeaves = async (search = '') => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (search) params.search = search;
      
      const response = await axios.get('/api/leaves/all', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLeaves(response.data.data.leaves);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (leaveId, noOfDays, status, rejection_reason = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/leaves/${leaveId}/status`,
        { noOfDays, status, rejection_reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAllLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      alert(error.response?.data?.message || 'Failed to update leave');
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
              onClick={() => {
                setRejectLeaveId(row.id);
                setRejectLeaveDays(row.no_of_days);
                setRejectReason('');
                setShowRejectModal(true);
              }}
            >
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted">No action</span>
        ),
    },
  ];

  if (selectedLeave) {
    return <LeaveDetails leave={selectedLeave} onBack={() => setSelectedLeave(null)} />;
  }

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4 dashboard-toggle">
          <h4>Manage Leave Requests</h4>
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
              onRowClicked={(row) => setSelectedLeave(row)}
              pointerOnHover
              highlightOnHover
            />
          )}
        </Card.Body>
      </Card>

      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reject Leave Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Reason for Rejection</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter reason for rejecting this leave..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              handleStatusUpdate(rejectLeaveId, rejectLeaveDays, 'Rejected', rejectReason);
              setShowRejectModal(false);
            }}
            disabled={!rejectReason.trim()}
          >
            Confirm Reject
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ManageLeaves;
