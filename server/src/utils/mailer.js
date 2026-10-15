import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

/** Sends an email. Without SMTP configured it prints the email to the console (dev mode). */
export async function sendMail(to, subject, text) {
  if (!transport) {
    console.log(`\n--- EMAIL (dev mode, SMTP not configured) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n---------------------------------------------\n`);
    return;
  }
  try {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
  } catch (err) {
    console.error('Email failed:', err.message); // never break the request because of email
  }
}
