import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Spinner, Badge, Alert, Row, Col, Card } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import axios from 'axios';
import DataTable from './common/DataTable';
import {
  FiCalendar,
  FiClock,
  FiPlus,
  FiEdit3,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiUsers,
  FiVideo,
  FiMapPin,
  FiMail,
  FiSearch,
  FiRotateCcw,
  FiList,
  FiBriefcase
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ClientMeetings = () => {
  const { user } = useSelector((state) => state.auth);
  const isManagerOrAdmin =
    user?.role === 'manager' ||
    ['super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'all', 'logs'
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Employees List for attendee selection
  const [employeesList, setEmployeesList] = useState([]);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('11:00');
  const [formEndTime, setFormEndTime] = useState('12:00');
  const [formLocation, setFormLocation] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Edit / Reschedule Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editAttendees, setEditAttendees] = useState([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Notification Logs
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (activeTab === 'upcoming') params.upcoming = 'true';

      const res = await axios.get('/api/meetings', {
        headers: getAuthHeaders(),
        params
      });
      setMeetings(res.data.data?.meetings || []);
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setError(err.response?.data?.message || 'Failed to load client meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('/api/employees', { headers: getAuthHeaders() });
      setEmployeesList(res.data.data?.employees || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchNotificationLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get('/api/meetings/notifications/logs', { headers: getAuthHeaders() });
      setNotificationLogs(res.data.data?.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchEmployees();
  }, [activeTab, statusFilter]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchNotificationLogs();
    }
  }, [activeTab]);

  const handleOpenScheduleModal = () => {
    setFormTitle('');
    setFormClient('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDate(tomorrow.toISOString().slice(0, 10));
    setFormStartTime('11:00');
    setFormEndTime('12:00');
    setFormLocation('Google Meet');
    setFormPurpose('');
    setSelectedAttendees(user?.employee_id ? [String(user.employee_id)] : []);
    setSendNotifications(true);
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formClient.trim() || !formDate || !formPurpose.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    setSubmittingSchedule(true);
    try {
      const res = await axios.post(
        '/api/meetings',
        {
          title: formTitle,
          client_name: formClient,
          meeting_date: formDate,
          start_time: formStartTime,
          end_time: formEndTime,
          location_or_link: formLocation,
          purpose: formPurpose,
          attendees: selectedAttendees,
          send_notifications: sendNotifications
        },
        { headers: getAuthHeaders() }
      );

      setMessage(res.data.message || 'Client meeting scheduled successfully!');
      setShowScheduleModal(false);
      fetchMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleOpenEditModal = (meeting) => {
    setSelectedMeeting(meeting);
    setEditTitle(meeting.title || '');
    setEditClient(meeting.client_name || '');
    setEditDate(meeting.meeting_date || '');
    setEditStartTime(meeting.start_time || '');
    setEditEndTime(meeting.end_time || '');
    setEditLocation(meeting.location_or_link || '');
    setEditPurpose(meeting.purpose || '');
    const attendeesArr = String(meeting.attendees || '').split(',').map(a => a.trim()).filter(Boolean);
    setEditAttendees(attendeesArr);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    setSubmittingEdit(true);
    try {
      const res = await axios.put(
        `/api/meetings/${selectedMeeting.id}`,
        {
          title: editTitle,
          client_name: editClient,
          meeting_date: editDate,
          start_time: editStartTime,
          end_time: editEndTime,
          location_or_link: editLocation,
          purpose: editPurpose,
          attendees: editAttendees,
          send_notifications: true
        },
        { headers: getAuthHeaders() }
      );

      setMessage(res.data.message || 'Meeting updated and email notifications dispatched.');
      setShowEditModal(false);
      fetchMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update meeting');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to cancel this client meeting? Email cancellation notices will be sent to all attendees.')) {
      return;
    }

    try {
      await axios.put(`/api/meetings/${meetingId}/cancel`, {}, { headers: getAuthHeaders() });
      setMessage('Meeting cancelled and cancellation notices sent.');
      fetchMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel meeting');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'scheduled') return <Badge bg="primary">Scheduled</Badge>;
    if (s === 'rescheduled') return <Badge bg="warning" text="dark">Rescheduled</Badge>;
    if (s === 'completed') return <Badge bg="success">Completed</Badge>;
    if (s === 'cancelled') return <Badge bg="danger">Cancelled</Badge>;
    return <Badge bg="secondary">{status}</Badge>;
  };

  const toggleAttendeeSelection = (empId) => {
    const idStr = String(empId);
    if (selectedAttendees.includes(idStr)) {
      setSelectedAttendees(selectedAttendees.filter((id) => id !== idStr));
    } else {
      setSelectedAttendees([...selectedAttendees, idStr]);
    }
  };

  const toggleEditAttendeeSelection = (empId) => {
    const idStr = String(empId);
    if (editAttendees.includes(idStr)) {
      setEditAttendees(editAttendees.filter((id) => id !== idStr));
    } else {
      setEditAttendees([...editAttendees, idStr]);
    }
  };

  const meetingColumns = [
    {
      name: 'Meeting Title & Client',
      selector: (row) => row.title,
      sortable: true,
      width: '240px',
      cell: (row) => (
        <div>
          <div className="fw-bold text-dark">{row.title}</div>
          <div className="text-muted small d-flex align-items-center gap-1">
            <FiBriefcase size={12} className="text-secondary" />
            <span>Client: {row.client_name}</span>
          </div>
        </div>
      ),
    },
    {
      name: 'Date & Time',
      selector: (row) => row.meeting_date,
      sortable: true,
      width: '210px',
      cell: (row) => (
        <div>
          <div className="fw-semibold">
            <FiCalendar size={13} className="me-1 text-primary" />
            {formatDate(row.meeting_date)}
          </div>
          <div className="text-muted small">
            <FiClock size={12} className="me-1" />
            {row.start_time} - {row.end_time}
          </div>
        </div>
      ),
    },
    {
      name: 'Location / Link',
      selector: (row) => row.location_or_link,
      width: '180px',
      cell: (row) => (
        <span className="small text-truncate d-inline-block" style={{ maxWidth: '160px' }} title={row.location_or_link}>
          {row.location_or_link?.toLowerCase().includes('http') || row.location_or_link?.toLowerCase().includes('meet') ? (
            <a href={row.location_or_link} target="_blank" rel="noreferrer" className="text-primary text-decoration-none">
              <FiVideo size={13} className="me-1" />
              Join Meeting
            </a>
          ) : (
            <span>
              <FiMapPin size={13} className="me-1 text-muted" />
              {row.location_or_link || 'Online'}
            </span>
          )}
        </span>
      ),
    },
    {
      name: 'Organizer',
      selector: (row) => row.organizer_name,
      sortable: true,
      width: '160px',
      cell: (row) => (
        <div>
          <div className="small fw-semibold">{row.organizer_name || 'Organizer'}</div>
          <div className="text-muted" style={{ fontSize: '0.72rem' }}>
            {row.organizer_designation || `ID: ${row.organizer_id}`}
          </div>
        </div>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      width: '130px',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      name: 'Agenda / Purpose',
      selector: (row) => row.purpose,
      grow: 2,
      cell: (row) => (
        <span className="text-muted small text-truncate d-inline-block" style={{ maxWidth: '220px' }} title={row.purpose}>
          {row.purpose}
        </span>
      ),
    },
    {
      name: 'Actions',
      width: '180px',
      right: true,
      cell: (row) => {
        const canManage = isManagerOrAdmin || String(row.organizer_id) === String(user?.employee_id);
        if (!canManage || row.status === 'Cancelled') {
          return <span className="text-muted small">—</span>;
        }
        return (
          <div className="d-flex gap-1 align-items-center">
            <Button
              size="sm"
              variant="outline-primary"
              style={{ borderRadius: '8px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '600' }}
              onClick={() => handleOpenEditModal(row)}
              title="Reschedule / Edit Meeting"
            >
              <FiEdit3 size={12} className="me-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              style={{ borderRadius: '8px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '600' }}
              onClick={() => handleCancelMeeting(row.id)}
              title="Cancel Meeting"
            >
              <FiX size={12} className="me-1" />
              Cancel
            </Button>
          </div>
        );
      },
    },
  ];

  const logColumns = [
    {
      name: 'Log ID',
      selector: (row) => row.id,
      sortable: true,
      width: '90px',
      cell: (row) => <strong>#{row.id}</strong>,
    },
    {
      name: 'Event Type',
      selector: (row) => row.type,
      sortable: true,
      width: '190px',
      cell: (row) => <Badge bg="secondary">{row.type}</Badge>,
    },
    {
      name: 'Meeting Reference',
      selector: (row) => row.reference_id,
      width: '180px',
      cell: (row) => (
        <div>
          <div className="fw-semibold small">{row.meeting_title || `Meeting #${row.reference_id}`}</div>
          {row.client_name && <small className="text-muted">Client: {row.client_name}</small>}
        </div>
      ),
    },
    {
      name: 'Recipient',
      selector: (row) => row.recipient_email,
      sortable: true,
      width: '210px',
      cell: (row) => (
        <div>
          <div className="small fw-semibold">{row.recipient_name || 'Team Member'}</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{row.recipient_email}</div>
        </div>
      ),
    },
    {
      name: 'Email Subject',
      selector: (row) => row.subject,
      grow: 2,
      cell: (row) => <span className="small text-truncate d-inline-block" style={{ maxWidth: '240px' }} title={row.subject}>{row.subject}</span>,
    },
    {
      name: 'Delivery Status',
      selector: (row) => row.status,
      sortable: true,
      width: '130px',
      cell: (row) => (
        row.status === 'Sent' ? (
          <Badge bg="success"><FiCheckCircle className="me-1" />Sent</Badge>
        ) : (
          <Badge bg="danger" title={row.error_message}><FiAlertCircle className="me-1" />Failed</Badge>
        )
      ),
    },
    {
      name: 'Dispatched At',
      selector: (row) => row.sent_at,
      sortable: true,
      width: '140px',
      cell: (row) => <span className="text-muted small">{formatDate(row.sent_at)}</span>,
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
            <span className="active">Client Meetings</span>
          </div>
          <h2 className="elh-page-title">Client Meetings & Notifications</h2>
          <p className="elh-page-subtitle">
            Schedule client meetings, coordinate with your project team, and dispatch automated email notifications.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenScheduleModal}
          style={{
            borderRadius: '12px',
            padding: '10px 18px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FiPlus size={16} />
          <span>Schedule Meeting</span>
        </Button>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)} className="mb-4">
          <FiCheckCircle className="me-2" />
          {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
          <FiAlertCircle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 border-bottom mb-4 pb-2">
        <Button
          variant={activeTab === 'upcoming' ? 'primary' : 'outline-secondary'}
          size="sm"
          style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
          onClick={() => setActiveTab('upcoming')}
        >
          <FiCalendar className="me-1" />
          Upcoming Meetings
        </Button>

        <Button
          variant={activeTab === 'all' ? 'primary' : 'outline-secondary'}
          size="sm"
          style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
          onClick={() => setActiveTab('all')}
        >
          <FiList className="me-1" />
          All Meetings
        </Button>

        {isManagerOrAdmin && (
          <Button
            variant={activeTab === 'logs' ? 'primary' : 'outline-secondary'}
            size="sm"
            style={{ borderRadius: '10px', fontWeight: '600', padding: '6px 16px' }}
            onClick={() => setActiveTab('logs')}
          >
            <FiMail className="me-1" />
            Email Notification Logs
          </Button>
        )}
      </div>

      {/* Toolbar / Search for Meetings */}
      {activeTab !== 'logs' && (
        <div className="elh-toolbar-card mb-4">
          <Row className="align-items-center g-3">
            <Col md={8}>
              <div className="elh-search-input-wrap">
                <FiSearch className="elh-search-icon" size={17} />
                <Form.Control
                  type="text"
                  className="elh-search-input"
                  placeholder="Search by title, client name, purpose, or organizer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchMeetings()}
                />
                {searchTerm && (
                  <button type="button" className="elh-search-clear-btn" onClick={() => { setSearchTerm(''); fetchMeetings(); }}>
                    <FiX size={14} />
                  </button>
                )}
              </div>
            </Col>
            <Col md={4} className="d-flex gap-2 justify-content-end">
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ borderRadius: '12px', height: '42px', fontSize: '0.88rem' }}
              >
                <option value="All">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </Form.Select>
              <Button
                variant="outline-secondary"
                onClick={() => { setSearchTerm(''); setStatusFilter('All'); fetchMeetings(); }}
                style={{ borderRadius: '12px', height: '42px', padding: '0 16px' }}
              >
                <FiRotateCcw size={15} />
              </Button>
            </Col>
          </Row>
        </div>
      )}

      {/* Table Container */}
      <div className="elh-table-card">
        {activeTab === 'logs' ? (
          <DataTable
            columns={logColumns}
            data={notificationLogs || []}
            progressPending={logsLoading}
            pagination
            paginationPerPage={20}
            noDataComponent={<div className="p-4 text-muted">No notification logs recorded yet.</div>}
          />
        ) : (
          <DataTable
            columns={meetingColumns}
            data={meetings || []}
            progressPending={loading}
            pagination
            paginationPerPage={15}
            noDataComponent={<div className="p-4 text-muted">No client meetings scheduled. Click "Schedule Meeting" above to create one.</div>}
          />
        )}
      </div>

      {/* MODAL 1: Schedule Client Meeting */}
      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} centered size="lg">
        <Form onSubmit={handleScheduleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
              <FiBriefcase className="me-2 text-primary" />
              Schedule Client Meeting
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3 mb-3">
              <Col md={7}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Meeting Title</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    placeholder="e.g. Q4 Sprint Architecture Review"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Client Name</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    placeholder="e.g. Global Tech Solutions"
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Date</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">End Time</Form.Label>
                  <Form.Control
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Location or Video Call Link</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. https://meet.google.com/xyz-abc or Conference Room 3B"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Agenda & Purpose</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                required
                placeholder="Outline discussion points, client goals, and deliverables..."
                value={formPurpose}
                onChange={(e) => setFormPurpose(e.target.value)}
              />
            </Form.Group>

            {/* Attendee Selection */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small d-flex justify-content-between">
                <span>Select Team Attendees ({selectedAttendees.length} selected)</span>
                <span className="text-muted fw-normal">Emails will be dispatched to selected members</span>
              </Form.Label>
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  background: '#f8fafc'
                }}
              >
                {employeesList.map((emp) => {
                  const isChecked = selectedAttendees.includes(String(emp.employee_id));
                  return (
                    <Form.Check
                      key={emp.employee_id}
                      type="checkbox"
                      id={`att-${emp.employee_id}`}
                      label={`${emp.name} (${emp.email}) - ${emp.designation || 'Employee'}`}
                      checked={isChecked}
                      onChange={() => toggleAttendeeSelection(emp.employee_id)}
                      className="mb-1 small"
                    />
                  );
                })}
              </div>
            </Form.Group>

            <Form.Check
              type="checkbox"
              id="send-notif-check"
              label="Automatically send meeting invitation emails to all attendees via Brevo SMTP"
              checked={sendNotifications}
              onChange={(e) => setSendNotifications(e.target.checked)}
              className="fw-semibold text-primary"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingSchedule}>
              {submittingSchedule ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Scheduling & Notifying...
                </>
              ) : (
                'Schedule Meeting'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL 2: Edit / Reschedule Client Meeting */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Form onSubmit={handleEditSubmit}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '700' }}>
              <FiEdit3 className="me-2 text-warning" />
              Reschedule / Edit Meeting
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3 mb-3">
              <Col md={7}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Meeting Title</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Client Name</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={editClient}
                    onChange={(e) => setEditClient(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Date</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">End Time</Form.Label>
                  <Form.Control
                    type="time"
                    required
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Location or Video Call Link</Form.Label>
              <Form.Control
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Agenda / Purpose</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                required
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Attendees</Form.Label>
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  background: '#f8fafc'
                }}
              >
                {employeesList.map((emp) => {
                  const isChecked = editAttendees.includes(String(emp.employee_id));
                  return (
                    <Form.Check
                      key={emp.employee_id}
                      type="checkbox"
                      id={`edit-att-${emp.employee_id}`}
                      label={`${emp.name} (${emp.email})`}
                      checked={isChecked}
                      onChange={() => toggleEditAttendeeSelection(emp.employee_id)}
                      className="mb-1 small"
                    />
                  );
                })}
              </div>
            </Form.Group>

            <Alert variant="warning" className="small py-2 mb-0">
              <FiMail className="me-1" />
              Updating this meeting will automatically send rescheduled email notifications to all attendees. Duplicate notifications are prevented.
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="warning" type="submit" disabled={submittingEdit}>
              {submittingEdit ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Saving & Notifying...
                </>
              ) : (
                'Save Changes & Notify'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientMeetings;
