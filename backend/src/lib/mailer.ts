import "dotenv/config";
import nodemailer from "nodemailer";

type SenderConfig = {
  email: string;
  name: string | null;
};

export async function sendEmail(
  _sender: SenderConfig,
  to: string,
  subject: string,
  body: string
) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error(
      "Ethereal SMTP_USER or SMTP_PASS is missing"
    );
  }

  const transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST ||
        "smtp.ethereal.email",

      port: Number(
        process.env.SMTP_PORT || 587
      ),

      secure: false,

      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

  const info =
    await transporter.sendMail({
      // IMPORTANT:
      // Always use Ethereal account as sender
      from:
        process.env.SMTP_FROM ||
        smtpUser,

      to,
      subject,
      text: body,
    });

  const previewUrl =
    nodemailer.getTestMessageUrl(info);

  console.log("--------------------------------");
  console.log("Ethereal email sent");
  console.log("From:", process.env.SMTP_FROM || smtpUser);
  console.log("To:", to);
  console.log("Message ID:", info.messageId);

  if (previewUrl) {
    console.log(
      "Preview:",
      previewUrl
    );
  }

  console.log("--------------------------------");

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
// import "dotenv/config";

// import nodemailer from "nodemailer";

// type SenderConfig = {
//   email: string;
//   name: string | null;
// };

// export async function sendEmail(
//   sender: SenderConfig,
//   to: string,
//   subject: string,
//   body: string
// ) {
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST || "smtp.ethereal.email",
//     port: Number(process.env.SMTP_PORT || 587),
//     secure: false,

//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });

//   const info = await transporter.sendMail({
//     from: sender.name
//       ? `"${sender.name}" <${sender.email}>`
//       : sender.email,

//     to,
//     subject,
//     text: body,
//   });

//   const previewUrl =
//     nodemailer.getTestMessageUrl(info);

//   console.log("Email sent:", info.messageId);

//   if (previewUrl) {
//     console.log(
//       "Ethereal preview:",
//       previewUrl
//     );
//   }

//   return {
//     ...info,
//     previewUrl,
//   };
// }