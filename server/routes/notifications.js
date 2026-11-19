const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

/**
 * GET /api/notifications
 * Fetch list of notifications for the authenticated user.
 * Supports pagination via ?limit=20&page=1
 */
router.get('/', auth, async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT n.id, n.recipient_id, n.sender_id, n.type, n.title, n.message,
              n.reference_id, n.reference_type, n.link, n.is_read, n.created_at,
              s.name AS sender_name, s.designation AS sender_designation
       FROM notifications n
       LEFT JOIN employees s ON s.employee_id = n.sender_id
       WHERE n.recipient_id = ?
       ORDER BY n.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [employeeId]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM notifications
       WHERE recipient_id = ?`,
      [employeeId]
    );

    const total = Number(countRows[0]?.total || 0);
    const unread = Number(countRows[0]?.unread || 0);

    res.json({
      success: "true",
      message: 'Notifications fetched successfully',
      data: {
        notifications: rows || [],
        pagination: {
          total,
          unread,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for polling unread notification count
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS unread
       FROM notifications
       WHERE recipient_id = ? AND is_read = 0`,
      [employeeId]
    );

    const unread = Number(countRows[0]?.unread || 0);
    res.json({
      success: "true",
      data: { unread }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read.
 */
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);
    const notificationId = Number(req.params.id);

    // Verify ownership
    const [existing] = await db.query(
      'SELECT id, recipient_id, is_read FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: "false", message: 'Notification not found' });
    }

    if (Number(existing[0].recipient_id) !== employeeId) {
      return res.status(403).json({ success: "false", message: 'Access denied to this notification' });
    }

    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [notificationId]
    );

    res.json({
      success: "true",
      message: 'Notification marked as read',
      data: { id: notificationId, is_read: 1 }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications for the authenticated user as read.
 */
router.patch('/read-all', auth, async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);

    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0',
      [employeeId]
    );

    res.json({
      success: "true",
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: "false", message: 'Server error', error: error.message });
  }
});

module.exports = router;
