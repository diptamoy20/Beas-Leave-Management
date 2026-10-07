import React, { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Form } from 'react-bootstrap';
import axios from 'axios';
import DataTable from './common/DataTable';
import * as XLSX from 'xlsx';

const parseDateOnly = (value) => {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const toDateOnlyString = (value) => {
  const d = parseDateOnly(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getWeekdayLabel = (value) => {
  const d = parseDateOnly(value);
  return d ? d.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase() : '-';
};

const AttendanceSummary = () => {
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);



  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/employees', { headers: { Authorization: `Bearer ${token}` } });
      setEmployees(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (selectedEmployeeId) params.employeeId = selectedEmployeeId;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await axios.get('/api/attendance/summary', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      // If server returned flattened rows, use them directly
      if (res.data?.data && Array.isArray(res.data.data.rows)) {
        setResults(res.data.data.rows);
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        // Server returned raw attendance array (older/newer endpoints) - normalize for table
        const mapped = res.data.data.map((a) => {
          const dateYMD = a.date ? String(a.date).slice(0, 10) : '';
          const localDate = parseDateOnly(a.date || dateYMD);
          const weekday = localDate ? localDate.getDay() : null; // 0=Sun,6=Sat

          // base normalized object
          const obj = {
            date: dateYMD,
            employee_id: a.employee_id || a.emp_id || a.employeeId || '',
            employee_name: a.employee_name || a.name || '',
            clock_in: a.clock_in || a.clockIn || null,
            clock_out: a.clock_out || a.clockOut || null,
            total_time: a.total_time != null ? a.total_time : (a.totalTime != null ? a.totalTime : null),
            leave_type: a.leave_type || null,
            isLeave: !!(a.leave_type),
            holiday_type: a.holiday_type || null,
            holiday_purpose: a.holiday_purpose || null,
            status: a.status || (a.clock_in ? 'present' : 'absent'),
            statusText: a.statusText || (a.clock_in ? 'Present' : 'Absent'),
          };

          // If weekend (sat/sun), mark as holiday and zero times
          if (weekday === 0 || weekday === 6) {
            const name = weekday === 0 ? 'sunday' : 'saturday';
            obj.status = 'holiday';
            obj.statusText = name;
            obj.isLeave = true;
            obj.leave_type = name;
            obj.clock_in = null;
            obj.clock_out = null;
            obj.total_time = 0;
            obj.holiday_type = name;
          }

          return obj;
        });
        setResults(mapped);
      } else {
        // fallback: if older response shape, try to reconstruct day-wise rows client-side
        const attendanceRows = res.data?.data?.attendance || [];
        const leaves = res.data?.data?.leaves || [];
        const holidays = res.data?.data?.holidays || [];
        // reconstruct day-wise rows (existing client-side fallback)
        let startDate = fromDate ? parseDateOnly(fromDate) : null;
        let endDate = toDate ? parseDateOnly(toDate) : null;
        if (!startDate && attendanceRows.length) startDate = parseDateOnly(attendanceRows[attendanceRows.length - 1].date);
        if (!endDate && attendanceRows.length) endDate = parseDateOnly(attendanceRows[0].date);
        if (!startDate || !endDate) {
          endDate = endDate || new Date();
          startDate = startDate || new Date(new Date().setDate(endDate.getDate() - 29));
        }

        const attMap = new Map();
        attendanceRows.forEach((r) => attMap.set(toDateOnlyString(r.date), r));

        const leaveDays = [];
        leaves.forEach((l) => {
          if (l.status !== 'Approved') return;
          const s = parseDateOnly(l.start_date);
          const e = parseDateOnly(l.end_date);
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            leaveDays.push({ date: toDateOnlyString(d), ...l });
          }
        });
        const leaveMap = new Map();
        leaveDays.forEach((d) => leaveMap.set(String(d.date), d));

        const holidayMap = new Map();
        holidays.forEach((h) => holidayMap.set(toDateOnlyString(h.date), h));

        const rows = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const key = toDateOnlyString(d);
          const att = attMap.get(key) || null;
          const lv = leaveMap.get(key) || null;
          const hl = holidayMap.get(key) || null;

          const row = {
            date: key,
            employee_id: att ? att.employee_id : (lv ? lv.employee_id : (selectedEmployeeId || '')),
            employee_name: att ? att.employee_name : (lv ? lv.employee_name : ''),
            clock_in: att ? att.clock_in : null,
            clock_out: att ? att.clock_out : null,
            total_time: att ? att.total_time : null,
            leave_type: lv ? lv.leave_type : null,
            isLeave: !!lv,
            holiday_type: hl ? hl.type : null,
            holiday_purpose: hl ? hl.purpose : null,
          };

          if (hl && String(hl.type).toLowerCase() === 'general') {
            row.status = 'holiday';
            row.statusText = 'General Holiday';
          } else if (lv) {
            const lt = String(lv.leave_type || '').toLowerCase();
            if (lt.includes('restricted')) {
              row.status = 'restricted_leave';
              row.statusText = 'Taken Restricted Leave';
            } else {
              row.status = 'taken_leave';
              row.statusText = 'Taken Leave';
            }
          } else if (att) {
            row.status = 'present';
            row.statusText = 'Present';
          } else {
            row.status = 'absent';
            row.statusText = 'Absent';
          }

          rows.push(row);
        }

        rows.sort((a, b) => (a.date < b.date ? 1 : -1));
        setResults(rows);
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!results || results.length === 0) return;
    const formatDateYMD = (ymd) => {
      if (!ymd) return '';
      const s = String(ymd).slice(0, 10);
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      const d = new Date(ymd);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };
    const formatTimeOnly = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toLocaleTimeString();
    };

    const data = results.map((r) => ({
      Date: formatDateYMD(r.date),
      Day: r.date ? getWeekdayLabel(r.date) : '',
      'Employee ID': r.employee_id,
      Name: r.employee_name,
      'Clock In': formatTimeOnly(r.clock_in),
      'Clock Out': formatTimeOnly(r.clock_out),
      'Total Minutes': r.total_time == null ? '' : r.total_time,
      'Leave': r.isLeave ? r.leave_type || 'Leave' : (r.leave_type || ''),
      'Holiday': r.holiday_type ? `${r.holiday_type}${r.holiday_purpose ? ` - ${r.holiday_purpose}` : ''}` : '',
      'Status': r.statusText || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_${selectedEmployeeId || 'all'}_${fromDate || ''}_${toDate || ''}.xlsx`);
  };

  const columns = [
    {
      name: 'Date', selector: (r) => {
        if (!r.date) return '-';
        const s = String(r.date).slice(0, 10);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        const d = parseDateOnly(r.date);
        if (!d) return '-';
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      }, sortable: true, width: '130px'
    },
    { name: 'Day', selector: (r) => getWeekdayLabel(r.date), sortable: true, width: '140px' },
    { name: 'Employee ID', selector: (r) => r.employee_id, sortable: true },
    { name: 'Name', selector: (r) => r.employee_name, sortable: true },
    { name: 'Clock In', selector: (r) => (r.clock_in ? new Date(r.clock_in).toLocaleTimeString() : '-'), sortable: true },
    { name: 'Clock Out', selector: (r) => (r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : '-'), sortable: true },
    { name: 'Total Time', selector: (r) => (r.total_time == null ? '-' : `${Math.floor(r.total_time / 60)}h ${r.total_time % 60}m`) },
    { name: 'Leave', selector: (r) => r.isLeave ? r.leave_type || 'Leave' : (r.leave_type || '-'), sortable: true },
    { name: 'Holiday', selector: (r) => r.holiday_type ? `${r.holiday_type}${r.holiday_purpose ? ` - ${r.holiday_purpose}` : ''}` : '-', sortable: true },
  ];

  const conditionalRowStyles = [
    { when: (row) => row.status === 'holiday', style: { backgroundColor: '#e6ffed' } },
    { when: (row) => row.status === 'restricted_leave', style: { backgroundColor: '#ffe6e6' } },
    { when: (row) => row.status === 'taken_leave', style: { backgroundColor: '#e6f0ff' } },
    { when: (row) => row.status === 'absent', style: { backgroundColor: '#f8f9fa' } },
    { when: (row) => row.status === 'present', style: { backgroundColor: '#ffffff' } },
  ];

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>Attendance</span>
            <span>/</span>
            <span className="active">Summary</span>
          </div>
          <h2 className="elh-page-title">Attendance Summary</h2>
          <p className="elh-page-subtitle">
            Search and export detailed employee attendance history across customizable date ranges.
          </p>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="elh-toolbar-card mb-4">
        <Form onSubmit={handleSearch} className="w-100">
          <Row className="align-items-end g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-muted mb-1">Employee (Search Name or ID)</Form.Label>
                <Form.Control
                  list="employee-list"
                  placeholder="Type to search..."
                  value={employeeSearch}
                  style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setSelectedEmployeeId('');
                  }}
                  onBlur={() => {
                    const trimmed = (employeeSearch || '').trim();
                    const m = trimmed.match(/\((\d+)\)\s*$/);
                    if (m) {
                      setSelectedEmployeeId(m[1]);
                      return;
                    }
                    let found = employees.find((emp) => String(emp.employee_id) === trimmed || String(emp.id) === trimmed);
                    if (!found) {
                      const low = trimmed.toLowerCase();
                      found = employees.find((emp) => emp.name && emp.name.toLowerCase() === low) || employees.find((emp) => emp.name && emp.name.toLowerCase().includes(low));
                    }
                    setSelectedEmployeeId(found ? found.employee_id : '');
                  }}
                />
                <datalist id="employee-list">
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={`${emp.name} (${emp.employee_id})`} />
                  ))}
                </datalist>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-muted mb-1">From Date</Form.Label>
                <Form.Control
                  type="date"
                  value={fromDate}
                  style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-muted mb-1">To Date</Form.Label>
                <Form.Control
                  type="date"
                  value={toDate}
                  style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-center gap-2">
              <Button
                variant="primary"
                type="submit"
                style={{ borderRadius: '12px', height: '42px', padding: '0 18px', fontWeight: '600', fontSize: '0.88rem' }}
              >
                Search
              </Button>
              <Button
                variant="outline-secondary"
                style={{ borderRadius: '12px', height: '42px', padding: '0 14px', fontWeight: '600', fontSize: '0.88rem' }}
                onClick={() => {
                  setEmployeeSearch('');
                  setSelectedEmployeeId('');
                  setFromDate('');
                  setToDate('');
                  setResults([]);
                }}
              >
                Reset
              </Button>
              <Button
                variant="success"
                style={{ borderRadius: '12px', height: '42px', padding: '0 16px', fontWeight: '600', fontSize: '0.88rem' }}
                onClick={handleExport}
                disabled={!results.length}
              >
                Export Excel
              </Button>
            </Col>
          </Row>
        </Form>
      </div>

      {/* Table Container */}
      <div className="elh-table-card">
        <DataTable
          columns={columns}
          data={results}
          progressPending={loading}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 30, 50]}
          conditionalRowStyles={conditionalRowStyles}
        />
      </div>
    </div>
  );
};

export default AttendanceSummary;
