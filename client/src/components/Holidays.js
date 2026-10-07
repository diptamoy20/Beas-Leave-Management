import { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, ButtonGroup } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHolidays } from '../store/slices/holidaySlice';
import DataTable from './common/DataTable';
import axios from 'axios';
import { FiCalendar, FiPlus, FiUpload, FiTrash2, FiDownload, FiPrinter } from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const Holidays = () => {
  const dispatch = useDispatch();
  const { holidays, loading } = useSelector((state) => state.holiday);
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    day: '',
    purpose: '',
    type: 'General',
    number_of_days: 1
  });

  useEffect(() => {
    fetchHolidaysData();
  }, [selectedYear]);

  const fetchHolidaysData = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.get(`/api/holidays?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(fetchHolidays());
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a file');
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('year', selectedYear);
      const response = await axios.post('/api/holidays/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert(response.data.message + (response.data.data?.errors ? '\n\nErrors:\n' + response.data.data.errors.join('\n') : ''));
      setShowUploadModal(false);
      setUploadFile(null);
      fetchHolidaysData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleClearYear = async () => {
    if (!window.confirm(`Are you sure you want to delete all holidays for ${selectedYear}? This action cannot be undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/holidays/year/${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('All holidays deleted successfully');
      fetchHolidaysData();
    } catch (error) {
      alert('Failed to delete holidays');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const holidayData = { ...formData, year: selectedYear };
      if (editingHoliday) {
        await axios.put(`/api/holidays/${editingHoliday.id}`, holidayData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/holidays', holidayData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowAddModal(false);
      setEditingHoliday(null);
      setFormData({ date: '', day: '', purpose: '', type: 'General', number_of_days: 1 });
      fetchHolidaysData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save holiday');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/holidays/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchHolidaysData();
    } catch (error) {
      alert('Failed to delete holiday');
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date,
      day: holiday.day,
      purpose: holiday.purpose,
      type: holiday.type,
      number_of_days: holiday.number_of_days
    });
    setShowAddModal(true);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Holiday List ${selectedYear}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
          tr:hover {
            background-color: #ddd;
          }
          .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
          }
          .badge-general {
            // background-color: #0d6efd;
            color: #0d6efd;
          }
          .badge-restricted {
            // background-color: #3545;
            color: #DC3545;
          }
          @media print {
            body {
              padding: 10px;
            }
            button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <h1>Holiday List ${selectedYear}</h1>
        <table>
          <thead>
            <tr>
              <th>SR. NO.</th>
              <th>Date</th>
              <th>Day</th>
              <th>Holiday</th>
              <th>Type</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            ${holidays.map((holiday, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(holiday.date).toLocaleDateString()}</td>
                <td>${holiday.day}</td>
                <td>${holiday.purpose}</td>
                <td><span class="badge badge-${holiday.type.toLowerCase()}">${holiday.type}</span></td>
                <td>${holiday.number_of_days}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const exportToExcel = () => {
    const csvContent = [
      ['SR. NO.', 'DATE', 'DAY', 'PURPOSE', 'TYPE', 'NUMBER OF DAYS'],
      ...holidays.map((h, i) => [
        i + 1,
        new Date(h.date).toLocaleDateString(),
        h.day,
        h.purpose,
        h.type,
        h.number_of_days
      ])
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holidays_${selectedYear}.csv`;
    a.click();
  };

  const columns = [
    {
      name: 'Date',
      selector: (row) => new Date(row.date).toLocaleDateString('en-GB').replace(/\//g, '-'),
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
        <span className={`badge text-${row.type === 'General' ? 'primary' : 'danger'}`} style={{fontSize:"13px"}}>
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
    {
      name: 'Actions',
      width: '150px',
      omit: !isAdmin,
      cell: (row) => (
        <ButtonGroup size="sm">
          <Button variant="outline-primary" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button variant="outline-danger" onClick={() => handleDelete(row.id)}>
            Delete
          </Button>
        </ButtonGroup>
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
            <span>Calendar</span>
            <span>/</span>
            <span className="active">Holidays</span>
          </div>
          <h2 className="elh-page-title">Holiday Calendar {selectedYear}</h2>
          <p className="elh-page-subtitle">
            Official company holiday schedule, general observances, and restricted holidays.
          </p>
        </div>
      </div>

      {/* Toolbar Card */}
      <div className="elh-toolbar-card mb-4">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <span className="small fw-semibold text-muted">Year:</span>
            <Form.Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ width: '110px', borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
            >
              {[2024, 2025, 2026, 2027, 2028].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="elh-count-pill">
            <FiCalendar size={14} />
            <span>{holidays?.length || 0} Holidays Scheduled</span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                style={{ borderRadius: '12px', height: '42px', padding: '0 16px', fontWeight: '600', fontSize: '0.85rem' }}
              >
                <FiPlus size={15} className="me-1" />
                Add Holiday
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowUploadModal(true)}
                style={{ borderRadius: '12px', height: '42px', padding: '0 16px', fontWeight: '600', fontSize: '0.85rem' }}
              >
                <FiUpload size={14} className="me-1" />
                Upload Excel
              </Button>
              <Button
                variant="outline-danger"
                onClick={handleClearYear}
                style={{ borderRadius: '12px', height: '42px', padding: '0 14px', fontWeight: '600', fontSize: '0.85rem' }}
              >
                <FiTrash2 size={14} className="me-1" />
                Clear Year
              </Button>
            </>
          )}
          <Button
            variant="outline-secondary"
            onClick={exportToExcel}
            style={{ borderRadius: '12px', height: '42px', padding: '0 14px', fontWeight: '600', fontSize: '0.85rem' }}
          >
            <FiDownload size={14} className="me-1" />
            Excel
          </Button>
          <Button
            variant="outline-secondary"
            onClick={exportToPDF}
            style={{ borderRadius: '12px', height: '42px', padding: '0 14px', fontWeight: '600', fontSize: '0.85rem' }}
          >
            <FiPrinter size={14} className="me-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="elh-table-card">
        <DataTable
          columns={columns}
          data={holidays || []}
          progressPending={loading}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 30, 50]}
        />
      </div>

      {/* Upload Modal */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Holiday List</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Upload an Excel file (.xlsx, .xls) or CSV file with holiday data
          </p>
          <div className="bg-light p-3 rounded mb-3">
            <strong>Excel Format Required:</strong>
            <ul className="small mt-2 mb-0">
              <li>Column: DATE (e.g., 01/01/2026 or 2026-01-01)</li>
              <li>Column: DAY (e.g., Monday)</li>
              <li>Column: PURPOSE (e.g., New Year)</li>
              <li>Column: TYPE (General or Restricted)</li>
              <li>Column: NUMBER OF DAYS (e.g., 1)</li>
            </ul>
          </div>
          <Form onSubmit={handleFileUpload}>
            <Form.Group className="mb-3">
              <Form.Label>Select Excel/CSV File</Form.Label>
              <Form.Control
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setUploadFile(e.target.files[0])}
                required
              />
              {uploadFile && (
                <Form.Text className="text-success">
                  ✓ Selected: {uploadFile.name}
                </Form.Text>
              )}
            </Form.Group>
            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" disabled={uploading} className="flex-fill">
                {uploading ? 'Uploading...' : '📤 Upload & Import'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                disabled={uploading}
                className="flex-fill"
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Day</Form.Label>
              <Form.Control
                type="text"
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                placeholder="e.g., Monday"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Purpose</Form.Label>
              <Form.Control
                type="text"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="e.g., New Year"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="General">General Holiday</option>
                <option value="Restricted">Restricted Holiday</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Number of Days</Form.Label>
              <Form.Control
                type="number"
                value={formData.number_of_days}
                onChange={(e) => setFormData({ ...formData, number_of_days: parseInt(e.target.value) })}
                min="1"
                required
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" className="flex-fill">
                {editingHoliday ? 'Update' : 'Add'} Holiday
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingHoliday(null);
                  setFormData({ date: '', day: '', purpose: '', type: 'General', number_of_days: 1 });
                }}
                className="flex-fill"
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Holidays;
