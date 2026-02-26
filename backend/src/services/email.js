import nodemailer from 'nodemailer';

const hasEmailConfig = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () =>
  nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

// ── Send password reset email ─────────────────────────────────────────────────
export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (!hasEmailConfig()) {
    // No SMTP configured — print to console so admin can copy the link
    console.log('\n' + '='.repeat(60));
    console.log('📧  PASSWORD RESET REQUEST (email not configured)');
    console.log(`    To   : ${toEmail}`);
    console.log(`    Link : ${resetUrl}`);
    console.log('='.repeat(60) + '\n');
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: `"StockAnalyzer 📊" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'איפוס סיסמה — StockAnalyzer',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="font-size: 48px;">📊</div>
            <h1 style="color: #1e3a5f; margin: 8px 0;">StockAnalyzer</h1>
          </div>
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h2 style="color: #1e293b; margin-top: 0;">איפוס סיסמה</h2>
            <p style="color: #475569; line-height: 1.6;">
              קיבלנו בקשה לאיפוס הסיסמה של חשבונך.<br/>
              לחץ על הכפתור למטה לאיפוס הסיסמה — הקישור תקף לשעה אחת.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block;">
                אפס סיסמה →
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 0;">
              אם לא ביקשת איפוס סיסמה, אפשר להתעלם מאימייל זה בבטחה.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Reset email sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return false;
  }
};
