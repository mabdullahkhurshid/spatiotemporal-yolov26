const nodemailer = require('nodemailer');

// Create transporter (only if email is configured)
let transporter = null;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Verify connection (non-blocking, don't crash on failure)
  transporter.verify((error, success) => {
    if (error) {
      console.warn('Email service not available:', error.message);
      console.warn('Email features will be disabled. Configure EMAIL_* variables in .env to enable.');
    } else {
      console.log('Email service is ready');
    }
  });
} else {
  console.warn('Email service not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env to enable email features.');
}

// Send email
const sendEmail = async (options) => {
  if (!transporter) {
    console.warn('Email service not configured. Email not sent to:', options.email);
    return null;
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!fromAddress) {
      console.warn('EMAIL_FROM and EMAIL_USER not set. Email not sent.');
      return null;
    }
    const message = {
      from: `${process.env.EMAIL_FROM_NAME || 'Fire Detection System'} <${fromAddress}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(message);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Send verification email
const sendVerificationEmail = async (user, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Email Verification</h2>
      <p>Hello ${user.name},</p>
      <p>Thank you for registering with Fire Detection System. Please verify your email address using the OTP below:</p>
      <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #dc2626; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't create an account, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">Fire Detection System</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Email Verification - Fire Detection System',
    html,
  });
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Password Reset Request</h2>
      <p>Hello ${user.name},</p>
      <p>You requested to reset your password. Click the button below to reset it:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">Fire Detection System</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Password Reset - Fire Detection System',
    html,
  });
};

// Send alert notification email
const sendAlertEmail = async (user, alert, camera) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">🚨 Fire Alert Detected</h2>
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <h3 style="color: #991b1b; margin-top: 0;">Alert Details</h3>
        <p><strong>Camera:</strong> ${camera.label}</p>
        <p><strong>Location:</strong> ${camera.location}</p>
        <p><strong>Fire Confidence:</strong> ${alert.fireConfidence}%</p>
        <p><strong>Smoke Confidence:</strong> ${alert.smokeConfidence}%</p>
        <p><strong>Intensity:</strong> ${alert.intensityLevel.toUpperCase()}</p>
        <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
      </div>
      <p style="color: #dc2626; font-weight: bold;">Please take immediate action!</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">Fire Detection System</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: `🚨 Fire Alert: ${camera.label} - ${alert.intensityLevel.toUpperCase()}`,
    html,
  });
};

// Send operator welcome email with login credentials
const sendOperatorWelcomeEmail = async (user, plainPassword, loginUrl) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Welcome to Fire Detection System</h2>
      <p>Hello ${user.name},</p>
      <p>Your operator account has been created. Use the credentials below to sign in:</p>
      <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0 0 8px;"><strong>Username:</strong> ${user.email}</p>
        <p style="margin: 0;"><strong>Password:</strong> ${plainPassword}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Sign In</a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="color: #6b7280; word-break: break-all;">${loginUrl}</p>
      <p>Please change your password after your first login if your organization requires it.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">Fire Detection System</p>
    </div>
  `;

  const text = [
    `Hello ${user.name},`,
    '',
    'Your operator account has been created.',
    `Username: ${user.email}`,
    `Password: ${plainPassword}`,
    `Sign in: ${loginUrl}`,
  ].join('\n');

  return sendEmail({
    email: user.email,
    subject: 'Your Operator Account - Fire Detection System',
    html,
    text,
  });
};

// Send contact form notification to business email
const sendContactNotificationEmail = async (contact) => {
  const businessEmail = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!businessEmail) {
    console.warn('No CONTACT_EMAIL configured. Contact saved but email not sent.');
    return null;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">New Contact Inquiry</h2>
      <p><strong>From:</strong> ${contact.name} &lt;${contact.email}&gt;</p>
      ${contact.organization ? `<p><strong>Organization:</strong> ${contact.organization}</p>` : ''}
      <p><strong>Subject:</strong> ${contact.subject || 'General inquiry'}</p>
      <div style="background-color: #f3f4f6; padding: 16px; margin: 16px 0; border-radius: 8px;">
        <p style="margin: 0; white-space: pre-wrap;">${contact.message}</p>
      </div>
      <p style="color: #6b7280; font-size: 12px;">Received at ${new Date(contact.createdAt || Date.now()).toLocaleString()}</p>
    </div>
  `;

  return sendEmail({
    email: businessEmail,
    subject: `[Contact] ${contact.subject || 'General inquiry'} — ${contact.name}`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAlertEmail,
  sendOperatorWelcomeEmail,
  sendContactNotificationEmail,
};
