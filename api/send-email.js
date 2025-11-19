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
    const disableSmtp = String(process.env.DISABLE_SMTP || 'false').toLowerCase() === 'true'

    let transporter
    let usedEthereal = false

    // If explicitly disabled or missing SMTP creds, fall back to Ethereal test account
    if (disableSmtp || !host || !user || !pass) {
      console.warn('SMTP not fully configured or DISABLE_SMTP=true — using Ethereal test account for local dev')
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      })
      usedEthereal = true
    } else {
      const secure = port === 465 || process.env.SMTP_SECURE === 'true'
      transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    }

    const info = await transporter.sendMail({
      from: from || undefined,
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    })

    const response = { ok: true, messageId: info.messageId }
    if (usedEthereal) {
      response.preview = nodemailer.getTestMessageUrl(info) || null
    }

    return res.status(200).json(response)
  } catch (err) {
    console.error('send-email error', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
