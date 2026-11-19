const db = require('../config/db');

/**
 * Creates an in-app notification for a user.
 * Prevents identical unread duplicate notifications within a short window.
 *
 * @param {Object} params
 * @param {number|string} params.recipient_id - Employee ID of receiver
 * @param {number|string} [params.sender_id] - Employee ID of initiator
 * @param {string} params.type - Notification type category
 * @param {string} params.title - Notification headline
 * @param {string} params.message - Descriptive text
 * @param {number|string} [params.reference_id] - Target entity ID (e.g. leave request ID)
 * @param {string} [params.reference_type='LEAVE'] - Entity category (e.g. 'LEAVE', 'COMP_OFF', 'ATTENDANCE')
 * @param {string} [params.link] - Frontend route path to navigate on click
 */
async function createNotification({
  recipient_id,
  sender_id = null,
  type,
  title,
  message,
  reference_id = null,
  reference_type = 'LEAVE',
  link = null
}) {
  if (!recipient_id || !title || !message) {
    return null;
  }

  try {
    const recId = Number(recipient_id);
    const sndId = sender_id !== null && sender_id !== undefined ? Number(sender_id) : null;
    const refId = reference_id !== null && reference_id !== undefined ? Number(reference_id) : null;

    // Check duplicate unread notification for the same event to avoid spamming
    if (refId && type) {
      const [existing] = await db.query(
        'SELECT id FROM notifications WHERE recipient_id = ? AND type = ? AND reference_id = ? AND is_read = 0 AND created_at >= NOW() - INTERVAL 1 MINUTE',
        [recId, type, refId]
      );
      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    const [result] = await db.run(
      `INSERT INTO notifications (recipient_id, sender_id, type, title, message, reference_id, reference_type, link, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [recId, sndId, type, title, message, refId, reference_type, link]
    );

    return result.insertId;
  } catch (error) {
    console.error('Failed to create in-app notification:', error);
    return null;
  }
}

/**
 * Creates notifications for multiple recipients (e.g. all assigned managers or admins)
 */
async function createNotificationsForUsers(recipientIds, payload) {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return [];
  const uniqueIds = [...new Set(recipientIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0))];
  const promises = uniqueIds.map(recId => createNotification({ ...payload, recipient_id: recId }));
  return Promise.all(promises);
}

module.exports = {
  createNotification,
  createNotificationsForUsers
};
