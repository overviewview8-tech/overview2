const nodemailer = require('nodemailer')

// Simple POST /api/send-email handler for Vercel serverless or other Node hosts.
// Expects JSON body: { to: string, subject: string, text?: string, html?: string }
// Environment variables required:
//  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//  - FROM_EMAIL (optional; defaults to SMTP_USER)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, text, html } = req.body || {}
    if (!to || !subject) return res.status(400).json({ error: 'Missing required fields: to, subject' })

    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = process.env.FROM_EMAIL || user

    if (!host || !user || !pass) {
      console.error('SMTP config missing', { host, user, pass: !!pass })
      return res.status(500).json({ error: 'SMTP configuration is not set on the server' })
    }

    const secure = port === 465 || process.env.SMTP_SECURE === 'true'

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    })

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    })

    return res.status(200).json({ ok: true, messageId: info.messageId })
  } catch (err) {
    console.error('send-email error', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
