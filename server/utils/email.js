const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a leave application notification to the manager.
 * 
 * @param {string} managerEmail - The manager's email address
 * @param {string} managerName - The manager's name
 * @param {string} employeeName - The employee's name who is applying for leave
 * @param {string} employeeEmail - The employee's email id who is applying for leave
 * @param {object} leaveDetails - Details of the leave
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
        <h3>Leave Request Notification</h3>
        <p>Dear ${managerName} sir,</p>
        <p><strong>${employeeName}</strong> has applied for a leave. Please find the details below:</p>
        <ul>
          <li><strong>Leave Type:</strong> ${leave_type}</li>
          <li><strong>Start Date:</strong> ${start_date}</li>
          <li><strong>End Date:</strong> ${end_date}</li>
          <li><strong>Duration:</strong> ${no_of_days} day(s)</li>
          <li><strong>Reason:</strong> ${reason}</li>
        </ul>
        <p>Please approve my leave ..THIK ACHHE ?</p>
        <br>
        <p>Best Regards,</p>
        <p>${employeeName}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

module.exports = {
  sendLeaveApplicationEmail,
};
