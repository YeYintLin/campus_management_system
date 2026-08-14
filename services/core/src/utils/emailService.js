let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (err) {
    console.warn('[emailService] nodemailer module optional load note:', err.message);
}

const createTransporter = () => {
    if (!nodemailer) return null;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
        return nodemailer.createTransport({
            host,
            port: Number(port),
            secure: Number(port) === 465,
            auth: { user, pass },
        });
    }
    return null;
};

const sendVerificationEmail = async (email, code) => {
    console.log(`\n======================================================`);
    console.log(`[GMAIL VERIFICATION CODE] Email: ${email} | CODE: ${code}`);
    console.log(`======================================================\n`);

    const transporter = createTransporter();
    if (!transporter) {
        console.log('[emailService] SMTP not configured in env. Code logged to console above.');
        return true;
    }

    const mailOptions = {
        from: `"TU Hmawbi CMS" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🔐 Account Email Verification Code - TU Hmawbi CMS',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f9; color: #1e293b;">
                <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <h2 style="color: #0891b2; margin-top: 0; text-align: center;">TU Hmawbi CMS</h2>
                    <p style="font-size: 15px; line-height: 1.5; color: #334155;">
                        Hello! Thank you for signing up for the Technological University (Hmawbi) Campus Management System.
                    </p>
                    <p style="font-size: 15px; color: #334155;">
                        Your 6-digit email verification code is:
                    </p>
                    <div style="text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0891b2; background: #ecfeff; padding: 12px 24px; border-radius: 8px; border: 1px solid #cffaff;">
                            ${code}
                        </span>
                    </div>
                    <p style="font-size: 13px; color: #64748b; text-align: center;">
                        This code will expire in 15 minutes. Once verified, your account will be submitted for Admin approval.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #94a3b8; text-align: center;">
                        If you did not request this account, please ignore this email.
                    </p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[emailService] Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`[emailService] Failed to send email to ${email}:`, error);
        return false;
    }
};

const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const sanitizeHeader = (val) => {
    if (!val) return '';
    return String(val).replace(/[\r\n]+/g, ' ').trim();
};

const sendBugReportEmail = async (report) => {
    const adminEmail = process.env.BUG_REPORT_ADMIN_EMAIL || 'yeyint2702@gmail.com';
    const cleanTitle = sanitizeHeader(report.title);
    const cleanName = sanitizeHeader(report.reporterName);
    const cleanRole = sanitizeHeader(report.reporterRole);
    const cleanPriority = sanitizeHeader(report.priority || 'Medium');

    console.log(`\n======================================================`);
    console.log(`[BUG REPORT DISPATCH] To: ${adminEmail} | From: ${report.reporterEmail}`);
    console.log(`[TITLE] ${cleanTitle} | Priority: ${cleanPriority}`);
    console.log(`======================================================\n`);

    const transporter = createTransporter();
    if (!transporter) {
        console.log('[emailService] SMTP not configured in env. Bug report logged to server console above.');
        return true;
    }

    const priorityColors = {
        Urgent: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
        High: { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
        Medium: { bg: '#fef3c7', text: '#92400e', border: '#facc15' },
        Low: { bg: '#f0fdf4', text: '#166534', border: '#4ade80' },
    };

    const pTheme = priorityColors[cleanPriority] || priorityColors.Medium;

    const attachmentsHtml = Array.isArray(report.attachments) && report.attachments.length > 0
        ? report.attachments.map((att, idx) => {
            const fileUrl = att.fileUrl.startsWith('http') ? att.fileUrl : `http://165.245.181.251:5001${att.fileUrl}`;
            return `
                <li style="margin-bottom: 6px;">
                    <a href="${escapeHtml(fileUrl)}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: bold;">
                        📎 ${escapeHtml(att.fileName || `Attachment ${idx + 1}`)}
                    </a>
                    <span style="font-size: 12px; color: #64748b;">(${escapeHtml(att.fileSize || 'File')})</span>
                </li>
            `;
        }).join('')
        : '<p style="margin: 0; color: #64748b; font-style: italic;">No attachments provided.</p>';

    const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #f1f5f9;">
            <div style="max-width: 620px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                
                <!-- Header Banner -->
                <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 24px 30px; text-align: left;">
                    <span style="display: inline-block; background: ${pTheme.bg}; color: ${pTheme.text}; border: 1px solid ${pTheme.border}; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                        🚨 ${escapeHtml(cleanPriority.toUpperCase())} PRIORITY
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                        TU Hmawbi CMS — Bug Report
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">
                        Submitted via Campus Management System Helpdesk
                    </p>
                </div>

                <div style="padding: 24px 30px;">
                    
                    <!-- Sender Details Card -->
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">
                            👤 Sender Information
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 4px 0; color: #94a3b8; width: 120px;">Name:</td>
                                <td style="padding: 4px 0; color: #ffffff; font-weight: 600;">${escapeHtml(report.reporterName)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #94a3b8;">Role:</td>
                                <td style="padding: 4px 0; color: #38bdf8; font-weight: 600;">${escapeHtml(report.reporterRole)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #94a3b8;">Contact Email:</td>
                                <td style="padding: 4px 0;">
                                    <a href="mailto:${escapeHtml(report.reporterEmail)}" style="color: #818cf8; text-decoration: none; font-weight: bold;">
                                        ${escapeHtml(report.reporterEmail)}
                                    </a>
                                </td>
                            </tr>
                            ${report.reporterCohort ? `
                            <tr>
                                <td style="padding: 4px 0; color: #94a3b8;">Cohort / Dept:</td>
                                <td style="padding: 4px 0; color: #cbd5e1;">${escapeHtml(report.reporterCohort)}</td>
                            </tr>` : ''}
                        </table>
                    </div>

                    <!-- Issue Details Card -->
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">
                            📋 Issue Details
                        </h3>
                        <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #ffffff;">
                            ${escapeHtml(report.title)}
                        </p>
                        <p style="margin: 0 0 10px; font-size: 13px; color: #cbd5e1;">
                            <strong>Category:</strong> <span style="background: #334155; padding: 2px 8px; border-radius: 6px; font-size: 12px;">${escapeHtml(report.category)}</span>
                            ${report.pageUrl ? ` • <strong>Location:</strong> <code style="color: #a5b4fc;">${escapeHtml(report.pageUrl)}</code>` : ''}
                        </p>
                        <div style="background: #0f172a; border-left: 3px solid #6366f1; border-radius: 6px; padding: 14px; margin-top: 10px;">
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${escapeHtml(report.description)}</p>
                        </div>
                    </div>

                    <!-- Attachments Card -->
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">
                            📎 Screenshots & Attachments
                        </h3>
                        <ul style="margin: 0; padding-left: 18px; font-size: 14px;">
                            ${attachmentsHtml}
                        </ul>
                    </div>

                    <!-- Device Info -->
                    ${report.deviceInfo?.browser || report.deviceInfo?.os ? `
                    <div style="font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                        <strong>Device / Environment:</strong> ${escapeHtml(report.deviceInfo.browser || '')} on ${escapeHtml(report.deviceInfo.os || '')} (${escapeHtml(report.deviceInfo.screenResolution || '')})
                    </div>` : ''}
                </div>

                <!-- Footer Note -->
                <div style="background: #0b1120; padding: 14px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
                    You can reply directly to this email to contact <strong>${escapeHtml(cleanName)}</strong>.
                </div>
            </div>
        </div>
    `;

    const mailOptions = {
        from: `"TU Hmawbi CMS" <${process.env.SMTP_USER || 'no-reply@hstu.edu.mm'}>`,
        to: adminEmail,
        replyTo: report.reporterEmail,
        subject: `🚨 [CMS Bug Report - ${cleanPriority.toUpperCase()}] ${cleanTitle} (${cleanRole}: ${cleanName})`,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[emailService] Bug report email dispatched to ${adminEmail} (replyTo: ${report.reporterEmail})`);
        return true;
    } catch (error) {
        console.error(`[emailService] Failed to send bug report email to ${adminEmail}:`, error.message);
        return false;
    }
};

const sendBugStatusUpdateEmail = async (report, newStatus, adminNotes) => {
    const cleanTitle = sanitizeHeader(report.title);
    const cleanStatus = sanitizeHeader(newStatus);

    const transporter = createTransporter();
    if (!transporter) {
        console.log(`[emailService] SMTP not configured. Status update to ${report.reporterEmail} skipped.`);
        return true;
    }

    const mailOptions = {
        from: `"TU Hmawbi CMS Helpdesk" <${process.env.SMTP_USER || 'no-reply@hstu.edu.mm'}>`,
        to: report.reporterEmail,
        subject: `[TU Hmawbi CMS] Your Bug Report status is now "${cleanStatus}"`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f1f5f9;">
                <div style="max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 25px; border: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="color: #38bdf8; margin-top: 0;">Bug Report Status Update</h2>
                    <p style="font-size: 14px; color: #cbd5e1;">Hello <strong>${escapeHtml(report.reporterName)}</strong>,</p>
                    <p style="font-size: 14px; color: #cbd5e1;">
                        Your submitted bug report <strong>"${escapeHtml(cleanTitle)}"</strong> has been updated to:
                    </p>
                    <div style="margin: 15px 0;">
                        <span style="font-size: 16px; font-weight: 700; background: #334155; color: #ffffff; padding: 6px 14px; border-radius: 8px; border: 1px solid #475569;">
                            ${escapeHtml(cleanStatus)}
                        </span>
                    </div>
                    ${adminNotes ? `
                    <div style="background: rgba(255,255,255,0.04); border-left: 3px solid #38bdf8; border-radius: 6px; padding: 12px; margin: 15px 0;">
                        <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: bold;">Admin Notes:</p>
                        <p style="margin: 4px 0 0; font-size: 14px; color: #f1f5f9;">${escapeHtml(adminNotes)}</p>
                    </div>` : ''}
                    <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                        Thank you for helping us improve the Technological University (Hmawbi) Campus Management System.
                    </p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[emailService] Status update email sent to ${report.reporterEmail}`);
        return true;
    } catch (err) {
        console.error(`[emailService] Status update email failed:`, err.message);
        return false;
    }
};

module.exports = {
    sendVerificationEmail,
    sendBugReportEmail,
    sendBugStatusUpdateEmail,
};

