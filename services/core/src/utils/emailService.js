const nodemailer = require('nodemailer');

const createTransporter = () => {
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

module.exports = {
    sendVerificationEmail,
};
