/**
 * Email Service — AWS SES
 *
 * Centralized email sending via SES v2. Uses IAM auth in ECS (task role),
 * local AWS credentials in dev. Replaces Resend.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email";
 *   await sendEmail({ to: ["user@example.com"], subject: "Hello", html: "<p>Hi</p>" });
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });

const DEFAULT_FROM = "Denali <no-reply@denali.health>";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SendEmailResult {
  messageId: string | null;
}

/**
 * Send an email via AWS SES.
 * Returns the SES message ID on success, null on failure.
 * Never throws — errors are logged and returned as null messageId.
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const fromAddress =
    options.from ||
    process.env.SES_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    DEFAULT_FROM;

  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

  try {
    const result = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: toAddresses },
        Content: {
          Simple: {
            Subject: { Data: options.subject, Charset: "UTF-8" },
            Body: { Html: { Data: options.html, Charset: "UTF-8" } },
          },
        },
      })
    );
    return { messageId: result.MessageId || null };
  } catch (error) {
    console.error("[email] SES send failed:", error);
    return { messageId: null };
  }
}
