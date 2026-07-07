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

// One labeled row of the assignment email's details table. Inline styles
// only — email clients don't support external CSS.
function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;background-color:#f8fafc;font-weight:600;white-space:nowrap;">${label}</td>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;">${value ?? '—'}</td>
    </tr>`;
}

// Every send function resolves to a result object and NEVER throws:
//   { sent: true }
//   { sent: false, reason: 'smtp_not_configured' }   — SMTP env vars missing
//   { sent: false, reason: <error message> }          — sendMail failed
// Callers log the failure (fastify.log.warn) but never let it block the
// action that triggered the email.
async function sendAssignmentEmail({ to, facultyName, courseCode, courseTitle, departmentName, deadline, taskId, link }) {
  const subject = `New Course Assignment: ${courseCode} - ${courseTitle}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2>Course Curriculum Assignment</h2>
      <p>Hello ${facultyName},</p>
      <p>You have been assigned to complete the curriculum details for the following course:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        ${detailRow('Course Code', courseCode)}
        ${detailRow('Course Title', courseTitle)}
        ${detailRow('Department', departmentName)}
        ${detailRow('Deadline', deadline)}
        ${detailRow('Task ID', taskId)}
      </table>
      <p style="margin:24px 0;">${wrapButton(link, 'Fill Course Details')}</p>
      <p>If the button does not work, copy this link into your browser:<br/>${link}</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">
        This is an automated message from CurriSync — please do not reply.
      </p>
    </div>`;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send assignment email:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendSubmissionEmail({ to, facultyName, courseCode, link }) {
  const subject = `Course Submitted for Review: ${courseCode}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return { sent: false, reason: 'smtp_not_configured' };
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
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send submission email:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendReopenedEmail({ to, facultyName, courseCode, courseTitle, note, link }) {
  const subject = `Course Reopened for Edits: ${courseCode}`;
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured — skipping send, would have sent:', { to, subject });
    return { sent: false, reason: 'smtp_not_configured' };
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
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send reopened email:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendAssignmentEmail, sendSubmissionEmail, sendReopenedEmail };
