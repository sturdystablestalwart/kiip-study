const nodemailer = require('nodemailer');

const subjects = {
    en: 'Your sign-in link for KIIP Study',
    ko: 'KIIP Study 로그인 링크',
    ru: 'Ссылка для входа в KIIP Study',
    es: 'Tu enlace de inicio de sesion en KIIP Study',
};

const bodies = {
    en: (link) => `
        <p>Click the button below to sign in. This link expires in 10 minutes.</p>
        <a href="${link}" style="display:inline-block;padding:12px 32px;background:#A0634A;color:#fff;text-decoration:none;border-radius:10px;font-family:Inter,system-ui,sans-serif;font-size:16px;">Sign in to KIIP Study</a>
        <p style="color:#7B8086;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    ko: (link) => `
        <p>아래 버튼을 클릭하여 로그인하세요. 이 링크는 10분 후 만료됩니다.</p>
        <a href="${link}" style="display:inline-block;padding:12px 32px;background:#A0634A;color:#fff;text-decoration:none;border-radius:10px;font-family:Inter,system-ui,sans-serif;font-size:16px;">KIIP Study 로그인</a>
        <p style="color:#7B8086;font-size:13px;margin-top:24px;">본인이 요청하지 않은 경우 이 이메일을 무시해도 됩니다.</p>
    `,
    ru: (link) => `
        <p>Нажмите кнопку ниже для входа. Ссылка действительна 10 минут.</p>
        <a href="${link}" style="display:inline-block;padding:12px 32px;background:#A0634A;color:#fff;text-decoration:none;border-radius:10px;font-family:Inter,system-ui,sans-serif;font-size:16px;">Войти в KIIP Study</a>
        <p style="color:#7B8086;font-size:13px;margin-top:24px;">Если вы не запрашивали эту ссылку, просто проигнорируйте это письмо.</p>
    `,
    es: (link) => `
        <p>Haz clic en el boton de abajo para iniciar sesion. Este enlace caduca en 10 minutos.</p>
        <a href="${link}" style="display:inline-block;padding:12px 32px;background:#A0634A;color:#fff;text-decoration:none;border-radius:10px;font-family:Inter,system-ui,sans-serif;font-size:16px;">Iniciar sesion en KIIP Study</a>
        <p style="color:#7B8086;font-size:13px;margin-top:24px;">Si no solicitaste este enlace, puedes ignorar este correo.</p>
    `,
};

function buildHtml(lang, link) {
    const body = (bodies[lang] || bodies.en)(link);
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:40px 20px;background:#F7F2E8;font-family:Inter,system-ui,sans-serif;color:#1F2328;">
    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:40px 32px;">
        <h2 style="margin:0 0 24px;font-size:20px;font-weight:600;">KIIP Study</h2>
        ${body}
    </div>
</body></html>`;
}

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        return transporter;
    }
    return null;
}

async function sendMagicLinkEmail(email, token, lang = 'en') {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${clientUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    const subject = subjects[lang] || subjects.en;
    const html = buildHtml(lang, link);

    const transport = getTransporter();
    if (!transport) {
        console.warn('[magic-link] SMTP not configured — email NOT sent. Check SMTP_USER/SMTP_PASS/SMTP_FROM env vars.');
        return { sent: false, reason: 'smtp-not-configured' };
    }

    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
    });
}

module.exports = { sendMagicLinkEmail };
