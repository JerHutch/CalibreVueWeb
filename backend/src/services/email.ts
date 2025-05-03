import nodemailer from 'nodemailer';
import { User } from '../types/user';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export const sendApprovalEmail = async (user: User) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error('Admin email not configured');
  }

  const approvalUrl = `${process.env.APP_URL}/admin/approve/${user.id}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: adminEmail,
    subject: 'New User Approval Request',
    html: `
      <h2>New User Approval Request</h2>
      <p>A new user has requested access to the Calibre Web Interface:</p>
      <ul>
        <li>Name: ${user.name}</li>
        <li>Email: ${user.email}</li>
      </ul>
      <p>Click the link below to approve or reject this request:</p>
      <a href="${approvalUrl}">${approvalUrl}</a>
    `
  };

  await transporter.sendMail(mailOptions);
}; 