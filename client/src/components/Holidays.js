import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Holidays() {
  const [holidays, setHolidays] = useState([]);
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
    fetchHolidays();
  }, [selectedYear]);

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/holidays?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHolidays(response.data);
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

      alert(response.data.message + (response.data.errors ? '\n\nErrors:\n' + response.data.errors.join('\n') : ''));
      setShowUploadModal(false);
      setUploadFile(null);
      fetchHolidays();
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
      fetchHolidays();
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
      fetchHolidays();
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
      fetchHolidays();
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
    window.print();
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

  const generalHolidays = holidays.filter(h => h.type === 'General');
  const restrictedHolidays = holidays.filter(h => h.type === 'Restricted');

  return (
    <div>
      <div className="top-bar">
        <h1>Holiday List {selectedYear}</h1>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb'}}
          >
            {[2024, 2025, 2026, 2027, 2028].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Holiday
          </button>
          <button className="btn" style={{background: '#8b5cf6', color: 'white'}} onClick={() => setShowUploadModal(true)}>
            📤 Upload Excel
          </button>
          <button className="btn btn-danger" onClick={handleClearYear}>
            🗑️ Clear Year
          </button>
          <button className="btn btn-success" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-primary" onClick={exportToPDF}>
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>General Holidays</h2>
          <span style={{color: '#6b7280'}}>Total: {generalHolidays.reduce((sum, h) => sum + h.number_of_days, 0)} days</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SR. NO.</th>
                <th>DATE</th>
                <th>DAY</th>
                <th>PURPOSE</th>
                <th>NUMBER OF DAYS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {generalHolidays.map((holiday, index) => (
                <tr key={holiday.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(holiday.date).toLocaleDateString('en-GB')}</td>
                  <td>{holiday.day}</td>
                  <td>{holiday.purpose}</td>
                  <td>{holiday.number_of_days}</td>
                  <td>
                    <div className="action-icons">
                      <button className="icon-btn edit" onClick={() => handleEdit(holiday)}>✏️</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(holiday.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Restricted Holidays</h2>
          <span style={{color: '#6b7280'}}>Total: {restrictedHolidays.reduce((sum, h) => sum + h.number_of_days, 0)} days</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SR. NO.</th>
                <th>DATE</th>
                <th>DAY</th>
                <th>PURPOSE</th>
                <th>NUMBER OF DAYS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {restrictedHolidays.map((holiday, index) => (
                <tr key={holiday.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(holiday.date).toLocaleDateString('en-GB')}</td>
                  <td>{holiday.day}</td>
                  <td>{holiday.purpose}</td>
                  <td>{holiday.number_of_days}</td>
                  <td>
                    <div className="action-icons">
                      <button className="icon-btn edit" onClick={() => handleEdit(holiday)}>✏️</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(holiday.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{width: '500px', maxWidth: '90%'}}>
            <h2>Upload Holiday List</h2>
            <p style={{color: '#6b7280', marginTop: '8px', fontSize: '14px'}}>
              Upload an Excel file (.xlsx, .xls) or CSV file with holiday data
            </p>
            
            <div style={{
              background: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              marginTop: '16px',
              fontSize: '13px',
              color: '#374151'
            }}>
              <strong>Excel Format Required:</strong>
              <ul style={{marginTop: '8px', marginLeft: '20px'}}>
                <li>Column: DATE (e.g., 01/01/2026 or 2026-01-01)</li>
                <li>Column: DAY (e.g., Monday)</li>
                <li>Column: PURPOSE (e.g., New Year)</li>
                <li>Column: TYPE (General or Restricted)</li>
                <li>Column: NUMBER OF DAYS (e.g., 1)</li>
              </ul>
            </div>

            <form onSubmit={handleFileUpload} style={{marginTop: '20px'}}>
              <div className="form-group">
                <label>Select Excel/CSV File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                  style={{padding: '8px'}}
                />
                {uploadFile && (
                  <p style={{marginTop: '8px', fontSize: '13px', color: '#10b981'}}>
                    ✓ Selected: {uploadFile.name}
                  </p>
                )}
              </div>
              
              <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{flex: 1}}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : '📤 Upload & Import'}
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{flex: 1, background: '#6b7280', color: 'white'}}
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{width: '500px', maxWidth: '90%'}}>
            <h2>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h2>
            <form onSubmit={handleSubmit} style={{marginTop: '20px'}}>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Day</label>
                <input
                  type="text"
                  value={formData.day}
                  onChange={(e) => setFormData({...formData, day: e.target.value})}
                  placeholder="e.g., Monday"
                  required
                />
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                  placeholder="e.g., New Year"
                  required
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="General">General Holiday</option>
                  <option value="Restricted">Restricted Holiday</option>
                </select>
              </div>
              <div className="form-group">
                <label>Number of Days</label>
                <input
                  type="number"
                  value={formData.number_of_days}
                  onChange={(e) => setFormData({...formData, number_of_days: parseInt(e.target.value)})}
                  min="1"
                  required
                />
              </div>
              <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
                <button type="submit" className="btn btn-primary" style={{flex: 1}}>
                  {editingHoliday ? 'Update' : 'Add'} Holiday
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{flex: 1, background: '#6b7280', color: 'white'}}
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingHoliday(null);
                    setFormData({ date: '', day: '', purpose: '', type: 'General', number_of_days: 1 });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Holidays;
