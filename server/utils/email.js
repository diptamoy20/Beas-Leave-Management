const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/db');

// Create a transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a leave application notification to the manager.
 */
const sendLeaveApplicationEmail = async (managerEmail, managerName, employeeName, employeeEmail, leaveDetails) => {
  try {
    const { leave_type, start_date, end_date, no_of_days, reason } = leaveDetails;

    const mailOptions = {
      from: `"${employeeName}" <${process.env.EMAIL_FROM || 'no-reply@beas.co.in'}>`,
      replyTo: employeeEmail,
      to: managerEmail,
      subject: `New Leave Request from ${employeeName}`,
      html: `
        <h3>Leave Application Notification</h3>
        <p>Dear ${managerName},</p>
        <p><strong>${employeeName}</strong> has applied for a leave. Please find the details below:</p>
        <ul>
          <li><strong>Leave Type:</strong> ${leave_type}</li>
          <li><strong>Start Date:</strong> ${start_date}</li>
          <li><strong>End Date:</strong> ${end_date}</li>
          <li><strong>Duration:</strong> ${no_of_days} day(s)</li>
          <li><strong>Reason:</strong> ${reason}</li>
        </ul>
        <br>
        <p>Best Regards,</p>
        <p>${employeeName}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Leave email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending leave email:', error);
    return false;
  }
};

const toLocalYMD = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Sends a client meeting notification email (Scheduled, Updated/Rescheduled, Cancelled).
 * Prevents duplicate emails using content hashes and maintains notification logs.
 *
 * @param {object} params
 * @param {object} params.meeting - Client meeting data
 * @param {string} params.action - 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'UPDATED'
 * @param {string} params.recipientEmail - Recipient email address
 * @param {string} params.recipientName - Recipient display name
 * @param {string} params.organizerName - Organizer display name
 */
const sendClientMeetingEmail = async ({
  meeting,
  action = 'SCHEDULED',
  recipientEmail,
  recipientName = 'Team Member',
  organizerName = 'Organizer'
}) => {
  if (!recipientEmail) {
    console.warn('[Meeting Email] Skipped: No recipient email provided.');
    return { success: false, message: 'Missing recipient email' };
  }

  const formattedDate = toLocalYMD(meeting.meeting_date);
  const startTimeStr = String(meeting.start_time || '').trim().slice(0, 5);
  const endTimeStr = String(meeting.end_time || '').trim().slice(0, 5);

  const hashPayload = `${meeting.id}-${formattedDate}-${startTimeStr}-${endTimeStr}-${action}-${recipientEmail.trim().toLowerCase()}`;
  const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  try {
    // 2. Check if this exact notification has already been sent
    const [existing] = await db.query(
      'SELECT id, sent_at FROM notification_logs WHERE content_hash = ? AND status IN ("Sent", "Pending")',
      [contentHash]
    );

    if (existing && existing.length > 0) {
      console.log(`[Duplicate Prevented] Email already sent to ${recipientEmail} for meeting #${meeting.id} (${action}).`);
      return {
        success: true,
        duplicatePrevented: true,
        logId: existing[0].id,
        message: 'Duplicate notification prevented'
      };
    }

    // 3. Format email subject & content
    let actionTitle = 'New Client Meeting Scheduled';
    let actionColor = '#1f4e5f';
    let badgeText = 'Scheduled';

    if (action === 'RESCHEDULED' || action === 'UPDATED') {
      actionTitle = 'Client Meeting Rescheduled / Updated';
      actionColor = '#d7a24a';
      badgeText = 'Updated';
    } else if (action === 'CANCELLED') {
      actionTitle = 'Client Meeting Cancelled';
      actionColor = '#dc3545';
      badgeText = 'Cancelled';
    }

    const subject = `[${badgeText}] ${meeting.client_name}: ${meeting.title} - ${meeting.meeting_date}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f7f9fa; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e1e7eb; }
          .header { background: ${actionColor}; color: #ffffff; padding: 24px 30px; }
          .header h2 { margin: 0; font-size: 20px; font-weight: 600; }
          .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
          .body { padding: 30px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: ${actionColor}18; color: ${actionColor}; margin-bottom: 16px; }
          .detail-table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 20px; }
          .detail-table td { padding: 10px 12px; border-bottom: 1px solid #edf2f5; font-size: 14px; }
          .detail-table td.label { font-weight: 600; color: #5a6a75; width: 34%; }
          .detail-table td.value { color: #1f2a30; font-weight: 500; }
          .purpose-box { background: #f8fafc; border-left: 4px solid ${actionColor}; padding: 14px 18px; margin: 18px 0; border-radius: 0 8px 8px 0; font-size: 14px; color: #2c3e50; }
          .footer { padding: 18px 30px; background: #fafbfc; border-top: 1px solid #edf2f5; font-size: 12px; color: #8a9ba8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>${actionTitle}</h2>
            <p>BEAS Consultancy & Communication LMS Notification</p>
          </div>
          <div class="body">
            <span class="badge">${badgeText}</span>
            <p style="margin-top: 0; font-size: 15px;">Hello <strong>${recipientName}</strong>,</p>
            <p style="font-size: 14px; color: #5a6a75;">
              ${action === 'CANCELLED'
                ? 'Please note that the following client meeting has been <strong>cancelled</strong>.'
                : 'You have been invited to or updated on the following client meeting:'
              }
            </p>

            <table class="detail-table">
              <tr>
                <td class="label">Meeting Title:</td>
                <td class="value"><strong>${meeting.title}</strong></td>
              </tr>
              <tr>
                <td class="label">Client Name:</td>
                <td class="value">${meeting.client_name}</td>
              </tr>
              <tr>
                <td class="label">Date:</td>
                <td class="value"><strong>${meeting.meeting_date}</strong></td>
              </tr>
              <tr>
                <td class="label">Time:</td>
                <td class="value">${meeting.start_time} - ${meeting.end_time}</td>
              </tr>
              <tr>
                <td class="label">Location / Link:</td>
                <td class="value">${meeting.location_or_link || 'To be shared / Online Meeting'}</td>
              </tr>
              <tr>
                <td class="label">Organizer:</td>
                <td class="value">${organizerName}</td>
              </tr>
            </table>

            <div style="font-weight: 600; font-size: 13px; color: #5a6a75; text-transform: uppercase; letter-spacing: 0.5px;">Agenda / Purpose:</div>
            <div class="purpose-box">
              ${meeting.purpose ? meeting.purpose.replace(/\n/g, '<br>') : 'Client collaboration meeting.'}
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              Please be prepared and join on time. If you have any scheduling conflicts, contact the organizer immediately.
            </p>
          </div>
          <div class="footer">
            This is an automated notification from BEAS Leave & Attendance Management System.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"BEAS Client Meetings" <${process.env.EMAIL_FROM || 'no-reply@beas.co.in'}>`,
      to: recipientEmail,
      subject,
      html,
    };

    // 4. Send email
    let sendResultStatus = 'Sent';
    let errorMessage = null;
    let messageId = null;

    try {
      const info = await transporter.sendMail(mailOptions);
      messageId = info.messageId;
      console.log(`[Meeting Email Sent] to ${recipientEmail} for #${meeting.id}: %s`, info.messageId);
    } catch (mailErr) {
      console.error(`[Meeting Email Error] Failed to send email to ${recipientEmail}:`, mailErr.message);
      sendResultStatus = 'Failed';
      errorMessage = mailErr.message;
    }

    // 5. Always record the transaction in notification_logs for complete audit trail
    await db.run(`
      INSERT INTO notification_logs (
        type, reference_id, recipient_email, recipient_name, subject, content_hash, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `CLIENT_MEETING_${action}`,
      meeting.id,
      recipientEmail,
      recipientName,
      subject,
      contentHash,
      sendResultStatus,
      errorMessage
    ]);

    return {
      success: sendResultStatus === 'Sent',
      messageId,
      status: sendResultStatus,
      error: errorMessage
    };
  } catch (outerErr) {
    console.error('[sendClientMeetingEmail error]', outerErr);
    return { success: false, error: outerErr.message };
  }
};

module.exports = {
  sendLeaveApplicationEmail,
  sendClientMeetingEmail,
  transporter,
};
