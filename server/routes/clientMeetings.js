const express = require('express');
const db = require('../config/db');
const { auth, isManager, ADMIN_ROLES } = require('../middleware/auth');
const { sendClientMeetingEmail } = require('../utils/email');

const router = express.Router();

const toLocalYMD = (d) => {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date)) return d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 1. Schedule a new client meeting and trigger notifications
router.post('/', auth, async (req, res) => {
  try {
    const organizerId = req.user.employee_id;
    const {
      title,
      client_name,
      meeting_date,
      start_time,
      end_time,
      location_or_link = '',
      purpose,
      attendees = [], // Array of employee_ids or emails
      send_notifications = true
    } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ success: "false", message: 'Meeting title is required.' });
    }

    if (!client_name || client_name.trim().length < 2) {
      return res.status(400).json({ success: "false", message: 'Client name is required.' });
    }

    if (!meeting_date) {
      return res.status(400).json({ success: "false", message: 'Meeting date is required.' });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({ success: "false", message: 'Start time and end time are required.' });
    }

    if (!purpose || purpose.trim().length < 5) {
      return res.status(400).json({ success: "false", message: 'Meeting agenda / purpose is required.' });
    }

    // Standardize attendees list as comma-separated string
    let attendeeList = [];
    if (Array.isArray(attendees)) {
      attendeeList = attendees.map(a => String(a).trim()).filter(Boolean);
    } else if (typeof attendees === 'string') {
      attendeeList = attendees.split(',').map(a => a.trim()).filter(Boolean);
    }

    // Always include organizer in attendee list if not already present
    if (!attendeeList.includes(String(organizerId))) {
      attendeeList.push(String(organizerId));
    }

    const attendeesStr = attendeeList.join(',');

    // Insert meeting into client_meetings table
    const [result] = await db.run(`
      INSERT INTO client_meetings (
        title, client_name, meeting_date, start_time, end_time, location_or_link, purpose, attendees, organizer_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled')
    `, [
      title.trim(),
      client_name.trim(),
      toLocalYMD(meeting_date),
      start_time.trim(),
      end_time.trim(),
      location_or_link.trim(),
      purpose.trim(),
      attendeesStr,
      organizerId
    ]);

    const meetingId = result.insertId;

    const createdMeeting = {
      id: meetingId,
      title: title.trim(),
      client_name: client_name.trim(),
      meeting_date: toLocalYMD(meeting_date),
      start_time: start_time.trim(),
      end_time: end_time.trim(),
      location_or_link: location_or_link.trim(),
      purpose: purpose.trim(),
      status: 'Scheduled',
      organizer_id: organizerId
    };

    // Fetch organizer info
    const [organizerRows] = await db.query('SELECT name, email FROM employees WHERE employee_id = ?', [organizerId]);
    const organizerName = organizerRows[0]?.name || req.user.name || 'Organizer';

    // 2. Resolve attendee emails and names from database
    const notificationSummary = [];
    if (send_notifications && attendeeList.length > 0) {
      // Find employees by employee_id or email
      const placeholders = attendeeList.map(() => '?').join(',');
      const [empRows] = await db.query(`
        SELECT employee_id, name, email 
        FROM employees 
        WHERE employee_id IN (${placeholders}) OR email IN (${placeholders})
      `, [...attendeeList, ...attendeeList]);

      // Map unique recipients
      const recipientsMap = new Map();
      empRows.forEach(emp => {
        if (emp.email) {
          recipientsMap.set(emp.email.toLowerCase(), emp.name);
        }
      });

      // Send email notifications to all attendees
      for (const [email, name] of recipientsMap.entries()) {
        const sendRes = await sendClientMeetingEmail({
          meeting: createdMeeting,
          action: 'SCHEDULED',
          recipientEmail: email,
          recipientName: name,
          organizerName
        });
        notificationSummary.push({ email, name, ...sendRes });
      }
    }

    res.status(201).json({
      success: "true",
      message: `Client meeting "${title}" successfully scheduled and notifications dispatched.`,
      data: {
        meeting: createdMeeting,
        notifications: notificationSummary
      }
    });
  } catch (error) {
    console.error('Error scheduling client meeting:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 2. Fetch list of client meetings
router.get('/', auth, async (req, res) => {
  try {
    const callerEmpId = req.user.employee_id;
    const isCallerAdmin = ADMIN_ROLES.includes(req.user.role) || req.user.role === 'manager';
    const { status, search, from, to, upcoming } = req.query;

    let query = `
      SELECT 
        m.*,
        org.name AS organizer_name,
        org.email AS organizer_email,
        org.designation AS organizer_designation
      FROM client_meetings m
      LEFT JOIN employees org ON m.organizer_id = org.employee_id
      WHERE 1=1
    `;
    const params = [];

    // Filter by user unless admin/manager
    if (!isCallerAdmin) {
      query += ` AND (m.organizer_id = ? OR FIND_IN_SET(?, m.attendees) > 0 OR FIND_IN_SET(?, m.attendees) > 0)`;
      params.push(callerEmpId, callerEmpId, req.user.email);
    }

    if (status && status !== 'All') {
      query += ' AND m.status = ?';
      params.push(status);
    }

    if (upcoming === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      query += ' AND m.meeting_date >= ? AND m.status != "Cancelled"';
      params.push(today);
    }

    if (from) {
      query += ' AND m.meeting_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND m.meeting_date <= ?';
      params.push(to);
    }

    if (search) {
      query += ' AND (m.title LIKE ? OR m.client_name LIKE ? OR m.purpose LIKE ? OR org.name LIKE ?)';
      const p = `%${search}%`;
      params.push(p, p, p, p);
    }

    query += ' ORDER BY m.meeting_date DESC, m.start_time DESC';

    const [rows] = await db.query(query, params);

    const formatted = rows.map(r => ({
      ...r,
      meeting_date: toLocalYMD(r.meeting_date)
    }));

    res.json({
      success: "true",
      message: 'Client meetings fetched',
      data: { meetings: formatted }
    });
  } catch (error) {
    console.error('Error fetching client meetings:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 3. View Notification Audit Logs (Must be before /:id route)
router.get('/notifications/logs', auth, isManager, async (req, res) => {
  try {
    const { reference_id, search, limit = 100 } = req.query;

    let query = `
      SELECT n.*, m.title AS meeting_title, m.client_name
      FROM notification_logs n
      LEFT JOIN client_meetings m ON n.reference_id = m.id AND n.type LIKE 'CLIENT_MEETING_%'
      WHERE 1=1
    `;
    const params = [];

    if (reference_id) {
      query += ' AND n.reference_id = ?';
      params.push(reference_id);
    }

    if (search) {
      query += ' AND (n.recipient_email LIKE ? OR n.recipient_name LIKE ? OR n.subject LIKE ?)';
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    const safeLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    query += ` ORDER BY n.sent_at DESC LIMIT ${safeLimit}`;

    const [logs] = await db.query(query, params);

    res.json({ success: "true", message: 'Notification logs fetched', data: { logs } });
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 4. Fetch single client meeting details
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        m.*,
        org.name AS organizer_name,
        org.email AS organizer_email,
        org.designation AS organizer_designation
      FROM client_meetings m
      LEFT JOIN employees org ON m.organizer_id = org.employee_id
      WHERE m.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Client meeting not found' });
    }

    const meeting = rows[0];
    meeting.meeting_date = toLocalYMD(meeting.meeting_date);

    // Fetch attendee employee details
    const attendeeIds = String(meeting.attendees || '').split(',').map(a => a.trim()).filter(Boolean);
    let attendeeDetails = [];

    if (attendeeIds.length > 0) {
      const placeholders = attendeeIds.map(() => '?').join(',');
      const [empRows] = await db.query(`
        SELECT employee_id, name, email, designation, department 
        FROM employees 
        WHERE employee_id IN (${placeholders}) OR email IN (${placeholders})
      `, [...attendeeIds, ...attendeeIds]);
      attendeeDetails = empRows;
    }

    meeting.attendeeDetails = attendeeDetails;

    // Fetch recent notification logs for this meeting
    const [notifLogs] = await db.query(`
      SELECT id, type, recipient_email, recipient_name, subject, status, error_message, sent_at
      FROM notification_logs
      WHERE reference_id = ? AND type LIKE 'CLIENT_MEETING_%'
      ORDER BY sent_at DESC
    `, [id]);

    meeting.notificationLogs = notifLogs;

    res.json({ success: "true", message: 'Meeting details fetched', data: { meeting } });
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 4. Update / Reschedule a client meeting
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const callerEmpId = req.user.employee_id;
    const isCallerAdmin = ADMIN_ROLES.includes(req.user.role) || req.user.role === 'manager';

    const [rows] = await db.query('SELECT * FROM client_meetings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Meeting not found' });
    }
    const oldMeeting = rows[0];

    // Only organizer or manager/admin can edit
    if (String(oldMeeting.organizer_id) !== String(callerEmpId) && !isCallerAdmin) {
      return res.status(403).json({ success: "false", message: 'Access denied. Only meeting organizer or admin can modify this meeting.' });
    }

    const {
      title = oldMeeting.title,
      client_name = oldMeeting.client_name,
      meeting_date = oldMeeting.meeting_date,
      start_time = oldMeeting.start_time,
      end_time = oldMeeting.end_time,
      location_or_link = oldMeeting.location_or_link,
      purpose = oldMeeting.purpose,
      attendees = oldMeeting.attendees,
      status = 'Rescheduled',
      send_notifications = true
    } = req.body;

    let attendeeList = [];
    if (Array.isArray(attendees)) {
      attendeeList = attendees.map(a => String(a).trim()).filter(Boolean);
    } else if (typeof attendees === 'string') {
      attendeeList = attendees.split(',').map(a => a.trim()).filter(Boolean);
    }
    const attendeesStr = attendeeList.join(',');

    const updatedDate = toLocalYMD(meeting_date);

    await db.run(`
      UPDATE client_meetings SET
        title = ?,
        client_name = ?,
        meeting_date = ?,
        start_time = ?,
        end_time = ?,
        location_or_link = ?,
        purpose = ?,
        attendees = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      title.trim(),
      client_name.trim(),
      updatedDate,
      start_time.trim(),
      end_time.trim(),
      location_or_link ? location_or_link.trim() : '',
      purpose.trim(),
      attendeesStr,
      status,
      id
    ]);

    const updatedMeeting = {
      id,
      title: title.trim(),
      client_name: client_name.trim(),
      meeting_date: updatedDate,
      start_time: start_time.trim(),
      end_time: end_time.trim(),
      location_or_link: location_or_link ? location_or_link.trim() : '',
      purpose: purpose.trim(),
      status,
      organizer_id: oldMeeting.organizer_id
    };

    // Dispatch Rescheduled / Updated Notifications
    const notificationSummary = [];
    if (send_notifications && attendeeList.length > 0) {
      const [organizerRows] = await db.query('SELECT name FROM employees WHERE employee_id = ?', [oldMeeting.organizer_id]);
      const organizerName = organizerRows[0]?.name || 'Organizer';

      const placeholders = attendeeList.map(() => '?').join(',');
      const [empRows] = await db.query(`
        SELECT employee_id, name, email 
        FROM employees 
        WHERE employee_id IN (${placeholders}) OR email IN (${placeholders})
      `, [...attendeeList, ...attendeeList]);

      const recipientsMap = new Map();
      empRows.forEach(emp => {
        if (emp.email) recipientsMap.set(emp.email.toLowerCase(), emp.name);
      });

      for (const [email, name] of recipientsMap.entries()) {
        const sendRes = await sendClientMeetingEmail({
          meeting: updatedMeeting,
          action: 'RESCHEDULED',
          recipientEmail: email,
          recipientName: name,
          organizerName
        });
        notificationSummary.push({ email, name, ...sendRes });
      }
    }

    res.json({
      success: "true",
      message: 'Meeting updated and notifications dispatched.',
      data: {
        meeting: updatedMeeting,
        notifications: notificationSummary
      }
    });
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

// 5. Cancel a client meeting
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const callerEmpId = req.user.employee_id;
    const isCallerAdmin = ADMIN_ROLES.includes(req.user.role) || req.user.role === 'manager';

    const [rows] = await db.query('SELECT * FROM client_meetings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: "false", message: 'Meeting not found' });
    }
    const meeting = rows[0];

    if (String(meeting.organizer_id) !== String(callerEmpId) && !isCallerAdmin) {
      return res.status(403).json({ success: "false", message: 'Access denied.' });
    }

    await db.run('UPDATE client_meetings SET status = "Cancelled", updated_at = NOW() WHERE id = ?', [id]);
    meeting.status = 'Cancelled';
    meeting.meeting_date = toLocalYMD(meeting.meeting_date);

    // Send cancellation notifications
    const attendeeList = String(meeting.attendees || '').split(',').map(a => a.trim()).filter(Boolean);
    const notificationSummary = [];

    if (attendeeList.length > 0) {
      const [organizerRows] = await db.query('SELECT name FROM employees WHERE employee_id = ?', [meeting.organizer_id]);
      const organizerName = organizerRows[0]?.name || 'Organizer';

      const placeholders = attendeeList.map(() => '?').join(',');
      const [empRows] = await db.query(`
        SELECT employee_id, name, email 
        FROM employees 
        WHERE employee_id IN (${placeholders}) OR email IN (${placeholders})
      `, [...attendeeList, ...attendeeList]);

      for (const emp of empRows) {
        if (emp.email) {
          const sendRes = await sendClientMeetingEmail({
            meeting,
            action: 'CANCELLED',
            recipientEmail: emp.email,
            recipientName: emp.name,
            organizerName
          });
          notificationSummary.push({ email: emp.email, name: emp.name, ...sendRes });
        }
      }
    }

    res.json({
      success: "true",
      message: 'Meeting cancelled and attendees notified.',
      data: { id, status: 'Cancelled', notifications: notificationSummary }
    });
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
