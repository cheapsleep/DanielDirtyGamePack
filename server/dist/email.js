"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendTestEmail = sendTestEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const appUrl = process.env.APP_URL || 'http://localhost:3000';
if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP not fully configured — verification emails will fail until configured');
}
const transporter = nodemailer_1.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
});
// Verify transporter on startup and log result
transporter.verify()
    .then(() => {
    console.log('SMTP transporter verified');
})
    .catch((err) => {
    console.warn('SMTP transporter verification failed:', err && err.message ? err.message : err);
    try {
        const logDir = path_1.default.resolve(process.cwd(), 'server', 'logs');
        if (!fs_1.default.existsSync(logDir))
            fs_1.default.mkdirSync(logDir, { recursive: true });
        fs_1.default.appendFileSync(path_1.default.join(logDir, 'emails.log'), `${new Date().toISOString()} SMTP verify failed: ${String(err)}\n`);
    }
    catch (_) { }
});
function sendVerificationEmail(email, token) {
    return __awaiter(this, void 0, void 0, function* () {
        // Link to client-side verification page which will call the API
        const url = `${appUrl}/verify?token=${encodeURIComponent(token)}`;
        const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`;
        const mail = {
            from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
            to: email,
            subject: 'Verify your email',
            text: `Please verify your email by visiting: ${url}`,
            html: `<p>Please verify your email by clicking <a href="${url}">this link</a>.</p>`
        };
        try {
            const info = yield transporter.sendMail(mail);
            return info;
        }
        catch (err) {
            console.warn('Failed to send verification email:', err);
            try {
                const logDir = path_1.default.resolve(process.cwd(), 'server', 'logs');
                if (!fs_1.default.existsSync(logDir))
                    fs_1.default.mkdirSync(logDir, { recursive: true });
                fs_1.default.appendFileSync(path_1.default.join(logDir, 'emails.log'), `${new Date().toISOString()} VERIFICATION to=${email} token=${token} ERROR=${String(err)}\n`);
                fs_1.default.appendFileSync(path_1.default.join(logDir, 'emails.log'), `MAIL_CONTENT: ${JSON.stringify(mail)}\n`);
            }
            catch (_) { }
            throw err;
        }
    });
}
function sendPasswordResetEmail(email, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`;
        const mail = {
            from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
            to: email,
            subject: 'Password reset',
            text: `Reset your password: ${url}`,
            html: `<p>Reset your password by clicking <a href="${url}">this link</a>.</p>`
        };
        try {
            const info = yield transporter.sendMail(mail);
            return info;
        }
        catch (err) {
            console.warn('Failed to send password reset email:', err);
            try {
                const logDir = path_1.default.resolve(process.cwd(), 'server', 'logs');
                if (!fs_1.default.existsSync(logDir))
                    fs_1.default.mkdirSync(logDir, { recursive: true });
                fs_1.default.appendFileSync(path_1.default.join(logDir, 'emails.log'), `${new Date().toISOString()} RESET to=${email} token=${token} ERROR=${String(err)}\n`);
                fs_1.default.appendFileSync(path_1.default.join(logDir, 'emails.log'), `MAIL_CONTENT: ${JSON.stringify(mail)}\n`);
            }
            catch (_) { }
            throw err;
        }
    });
}
function sendTestEmail(to) {
    return __awaiter(this, void 0, void 0, function* () {
        const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`;
        const mail = {
            from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
            to,
            subject: 'Test email from DanielBox',
            text: 'This is a test email to verify SMTP configuration.'
        };
        return transporter.sendMail(mail);
    });
}
