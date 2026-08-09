// Importing modules
import nodemailer from "nodemailer";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

// function to send emails (mock-logs when SEND_MAIL is false)
function sendMail(to: string, subject: string, html: string) {

    if (env.SEND_MAIL) {

        const transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
            },
        });

        transporter.sendMail({
            from: env.SENDING_USER || "noreply@autoshorts.app",
            to,
            subject,
            html
        }).catch(err => logger.warn(`sendMail error: ${err.message}`));

    } else {

        logger.info(`[Mail Mock Log] To: ${to} | Subject: ${subject} | HTML: ${html}`);

    }

}

export default sendMail;
