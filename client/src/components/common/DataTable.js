import React from 'react';
import DataTable from 'react-data-table-component';
import { useSelector } from 'react-redux';

const CustomDataTable = ({ columns, data, title, pagination = true, ...props }) => {
  const { darkMode } = useSelector((state) => state.theme);

  const customStyles = {
    table: {
      style: {
        backgroundColor: darkMode ? '#1e2139' : '#fff',
      },
    },
    headRow: {
      style: {
        backgroundColor: darkMode ? '#2a2f4a' : '#f3f6f9',
        borderBottom: darkMode ? '1px solid #3a3f5a' : '1px solid #e9ecef',
        minHeight: '52px',
      },
    },
    headCells: {
      style: {
        color: darkMode ? '#a6b0cf' : '#495057',
        fontSize: '13px',
        fontWeight: '600',
        textTransform: 'uppercase',
      },
    },
    rows: {
      style: {
        backgroundColor: darkMode ? '#1e2139' : '#fff',
        borderBottom: darkMode ? '1px solid #2a2f4a' : '1px solid #e9ecef',
        minHeight: '48px',
        '&:hover': {
          backgroundColor: darkMode ? '#2a2f4a' : '#f8f9fa',
        },
      },
    },
    cells: {
      style: {
        color: darkMode ? '#ced4da' : '#495057',
        fontSize: '13px',
      },
    },
    pagination: {
      style: {
        backgroundColor: darkMode ? '#1e2139' : '#fff',
        borderTop: darkMode ? '1px solid #2a2f4a' : '1px solid #e9ecef',
        color: darkMode ? '#a6b0cf' : '#495057',
      },
    },
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      title={title}
      pagination={pagination}
      customStyles={customStyles}
      highlightOnHover
      pointerOnHover
      responsive
      {...props}
    />
  );
};

export default CustomDataTable;
