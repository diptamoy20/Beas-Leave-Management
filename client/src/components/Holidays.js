import React, { useEffect } from 'react';
import { Card } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHolidays } from '../store/slices/holidaySlice';
import DataTable from './common/DataTable';

const Holidays = () => {
  const dispatch = useDispatch();
  const { holidays, loading } = useSelector((state) => state.holiday);

  useEffect(() => {
    dispatch(fetchHolidays());
  }, [dispatch]);

  const columns = [
    {
      name: 'Date',
      selector: (row) => new Date(row.date).toLocaleDateString(),
      sortable: true,
      width: '150px',
    },
    {
      name: 'Day',
      selector: (row) => row.day,
      sortable: true,
      width: '120px',
    },
    {
      name: 'Holiday',
      selector: (row) => row.purpose,
      sortable: true,
      grow: 2,
    },
    {
      name: 'Type',
      selector: (row) => row.type,
      sortable: true,
      width: '150px',
      cell: (row) => (
        <span className={`badge bg-${row.type === 'General' ? 'primary' : 'success'}`}>
          {row.type}
        </span>
      ),
    },
    {
      name: 'Days',
      selector: (row) => row.number_of_days,
      sortable: true,
      width: '100px',
      center: true,
    },
  ];

  return (
    <div>
      <h4 className="mb-4 dashboard-toggle">Holiday List</h4>
      <Card className="dashboard-card">
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">Loading...</div>
          ) : (
            <DataTable
              columns={columns}
              data={holidays}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[10, 20, 30, 50]}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Holidays;
