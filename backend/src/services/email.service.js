const nodemailer = require('nodemailer');

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function wrapButton(link, label) {
  return `
    <a href="${link}"
       style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;
              text-decoration:none;border-radius:6px;font-weight:600;font-family:sans-serif;">
      ${label}
    </a>`;
}

async function sendAssignmentEmail({ to, facultyName, courseCode, courseTitle, deadline, link }) {
  const subject = `New Course Assignment: ${courseCode} - ${courseTitle}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2>Course Curriculum Assignment</h2>
      <p>Hello ${facultyName},</p>
      <p>You have been assigned to complete the curriculum details for:</p>
      <p><strong>${courseCode} — ${courseTitle}</strong></p>
      <p>Deadline: <strong>${deadline}</strong></p>
      <p style="margin:24px 0;">${wrapButton(link, 'Fill Course Details')}</p>
      <p>If the button does not work, copy this link into your browser:<br/>${link}</p>
    </div>`;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send assignment email:', err.message);
  }
}

async function sendSubmissionEmail({ to, facultyName, courseCode, link }) {
  const subject = `Course Submitted for Review: ${courseCode}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2>Course Submitted for Review</h2>
      <p>${facultyName} has submitted curriculum details for <strong>${courseCode}</strong>.</p>
      <p style="margin:24px 0;">${wrapButton(link, 'Review Submission')}</p>
      <p>If the button does not work, copy this link into your browser:<br/>${link}</p>
    </div>`;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send submission email:', err.message);
  }
}

async function sendReopenedEmail({ to, facultyName, courseCode, courseTitle, note, link }) {
  const subject = `Course Reopened for Edits: ${courseCode}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2>Course Reopened for Edits</h2>
      <p>Hello ${facultyName},</p>
      <p>Your approved submission for <strong>${courseCode} — ${courseTitle}</strong> has been reopened so further
      changes can be made. Nothing was wrong with your original work — it just needs an update.</p>
      ${note ? `<p><strong>Note from the reviewer:</strong> ${note}</p>` : ''}
      <p style="margin:24px 0;">${wrapButton(link, 'Edit Course Details')}</p>
      <p>If the button does not work, copy this link into your browser:<br/>${link}</p>
    </div>`;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send reopened email:', err.message);
  }
}

module.exports = { sendAssignmentEmail, sendSubmissionEmail, sendReopenedEmail };
