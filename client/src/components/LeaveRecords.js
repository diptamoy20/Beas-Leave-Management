import React, { useEffect, useState, useMemo } from 'react';
import { Card, Form, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';

const LeaveRecords = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchApprovedLeaves = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/leaves/approved', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLeaves(response.data);
      } catch (error) {
        console.error('Error fetching approved leaves:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedLeaves();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leaves;
    return leaves.filter(
      (l) =>
        l.employee_name?.toLowerCase().includes(q) ||
        String(l.emp_id).includes(q)
    );
  }, [leaves, search]);

  const columns = [
    {
      name: 'Emp ID',
      selector: (row) => row.emp_id,
      sortable: true,
      width: '100px',
    },
    {
      name: 'Name',
      selector: (row) => row.employee_name,
      sortable: true,
      grow: 1,
    },
    {
      name: 'Leave Type',
      selector: (row) => row.leave_type,
      sortable: true,
      width: '140px',
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
      name: 'Days',
      selector: (row) => row.no_of_days,
      sortable: true,
      width: '80px',
      center: true,
    },
    {
      name: 'Reason',
      selector: (row) => row.reason,
      grow: 2,
    },
    {
      name: 'Approved On',
      selector: (row) => new Date(row.created_at).toLocaleDateString('en-GB'),
      sortable: true,
      width: '130px',
    },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0 dashboard-toggle">Leave Records</h4>
        <InputGroup style={{ width: '280px' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            placeholder="Search by name or emp ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <Card className="dashboard-card">
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">Loading...</div>
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              pagination
              paginationPerPage={15}
              paginationRowsPerPageOptions={[15, 30, 50]}
              noDataComponent="No approved leaves found."
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default LeaveRecords;
