import React from 'react';
import DataTable from 'react-data-table-component';
import { useSelector } from 'react-redux';
import { Spinner } from 'react-bootstrap';
import { FiInbox } from 'react-icons/fi';

const CustomDataTable = ({
  columns,
  data,
  title,
  pagination = true,
  paginationPerPage = 10,
  paginationRowsPerPageOptions = [10, 20, 30, 50],
  noDataText = 'No records found',
  ...props
}) => {
  const { darkMode } = useSelector((state) => state.theme);

  const customStyles = {
    table: {
      style: {
        backgroundColor: darkMode ? '#12222a' : '#ffffff',
        borderRadius: '20px',
      },
    },
    tableWrapper: {
      style: {
        borderRadius: '20px',
        overflow: 'hidden',
      },
    },
    header: {
      style: {
        backgroundColor: darkMode ? '#12222a' : '#ffffff',
        color: darkMode ? '#edf4f6' : '#143844',
        fontSize: '1.1rem',
        fontWeight: '700',
        padding: '16px 20px',
      },
    },
    subHeader: {
      style: {
        backgroundColor: darkMode ? '#12222a' : '#ffffff',
        padding: '12px 20px',
      },
    },
    headRow: {
      style: {
        backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(31, 78, 95, 0.04)',
        borderBottom: darkMode ? '1px solid rgba(150, 194, 206, 0.14)' : '1px solid rgba(31, 78, 95, 0.12)',
        minHeight: '52px',
      },
    },
    headCells: {
      style: {
        color: darkMode ? '#96aeb6' : '#6b7d85',
        fontSize: '12.5px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        paddingLeft: '18px',
        paddingRight: '18px',
      },
    },
    rows: {
      style: {
        backgroundColor: darkMode ? 'rgba(18, 34, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
        borderBottom: darkMode ? '1px solid rgba(150, 194, 206, 0.1)' : '1px solid rgba(31, 78, 95, 0.08)',
        minHeight: '54px',
        fontSize: '13.5px',
        transition: 'background-color 0.18s ease',
        '&:hover': {
          backgroundColor: darkMode ? 'rgba(120, 194, 209, 0.08)' : 'rgba(47, 127, 143, 0.05)',
        },
      },
    },
    cells: {
      style: {
        color: darkMode ? '#edf4f6' : '#24404a',
        paddingLeft: '18px',
        paddingRight: '18px',
      },
    },
    pagination: {
      style: {
        backgroundColor: darkMode ? '#12222a' : '#ffffff',
        borderTop: darkMode ? '1px solid rgba(150, 194, 206, 0.14)' : '1px solid rgba(31, 78, 95, 0.12)',
        color: darkMode ? '#96aeb6' : '#6b7d85',
        fontSize: '13px',
        minHeight: '54px',
      },
      pageButtonsStyle: {
        borderRadius: '8px',
        height: '36px',
        width: '36px',
        padding: '6px',
        margin: '0 3px',
        cursor: 'pointer',
        transition: '0.2s',
        color: darkMode ? '#96aeb6' : '#6b7d85',
        fill: darkMode ? '#96aeb6' : '#6b7d85',
        backgroundColor: 'transparent',
        '&:disabled': {
          cursor: 'unset',
          color: darkMode ? 'rgba(150, 194, 206, 0.3)' : 'rgba(31, 78, 95, 0.3)',
          fill: darkMode ? 'rgba(150, 194, 206, 0.3)' : 'rgba(31, 78, 95, 0.3)',
        },
        '&:hover:not(:disabled)': {
          backgroundColor: darkMode ? 'rgba(120, 194, 209, 0.15)' : 'rgba(47, 127, 143, 0.1)',
        },
        '&:focus': {
          outline: 'none',
        },
      },
    },
  };

  const defaultNoDataComponent = (
    <div className="text-center py-5 w-100">
      <FiInbox size={38} style={{ color: darkMode ? '#96aeb6' : '#6b7d85', opacity: 0.6 }} />
      <div
        className="mt-2 fw-bold"
        style={{ color: darkMode ? '#edf4f6' : '#143844', fontSize: '0.98rem' }}
      >
        {noDataText}
      </div>
      <div className="text-muted small mt-1">There are no records to display at this time.</div>
    </div>
  );

  const defaultProgressComponent = (
    <div className="text-center py-5 w-100">
      <Spinner animation="border" variant="primary" style={{ width: '2.2rem', height: '2.2rem' }} />
      <div className="mt-2 text-muted small">Loading records...</div>
    </div>
  );

  return (
    <div className="custom-web-table-container">
      <DataTable
        columns={columns}
        data={data}
        title={title}
        pagination={pagination}
        paginationPerPage={paginationPerPage}
        paginationRowsPerPageOptions={paginationRowsPerPageOptions}
        customStyles={customStyles}
        noDataComponent={defaultNoDataComponent}
        progressComponent={defaultProgressComponent}
        highlightOnHover
        pointerOnHover
        responsive
        {...props}
      />
    </div>
  );
};

export default CustomDataTable;
