const nodemailer = require('nodemailer')
// PDF generation library
let PDFDocument
try {
  PDFDocument = require('pdfkit')
} catch (e) {
  // pdfkit might not be installed in some environments; handler will skip PDF generation
  PDFDocument = null
}

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
    const { to, subject, text, html, pdfData } = req.body || {}
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

    const mailOptions = {
      from: from || undefined,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      attachments: []
    }

    // If pdfData provided and pdfkit available, generate a PDF buffer and attach
    if (pdfData && PDFDocument) {
      try {
        const buffer = await new Promise((resolve, reject) => {
          const doc = new PDFDocument({ size: 'A4', margin: 50 })
          const chunks = []
          doc.on('data', chunk => chunks.push(chunk))
          doc.on('end', () => resolve(Buffer.concat(chunks)))
          doc.on('error', err => reject(err))

          // Simple PDF layout with job & client data
          doc.fontSize(18).text(pdfData.jobName || 'Job Summary', { align: 'center' })
          doc.moveDown()
          doc.fontSize(12).text(`Client: ${pdfData.clientName || ''}`)
          doc.text(`Client email: ${pdfData.clientEmail || ''}`)
          if (pdfData.clientFirstName || pdfData.clientLastName) {
            doc.text(`Client name parts: ${pdfData.clientFirstName || ''} ${pdfData.clientLastName || ''}`)
          }
          doc.text(`Completed at: ${pdfData.completedAt || ''}`)
          doc.moveDown()
          doc.fontSize(14).text('Tasks:', { underline: true })
          doc.moveDown(0.5)
          const tasks = Array.isArray(pdfData.tasks) ? pdfData.tasks : []
          tasks.forEach((t, i) => {
            doc.fontSize(12).text(`${i + 1}. ${t.name || '—'}`)
            if (t.description) doc.text(`   Description: ${t.description}`)
            if (t.value != null) doc.text(`   Value: ${t.value} lei`)
            if (t.estimated_hours != null) doc.text(`   Estimated hours: ${t.estimated_hours}`)
            doc.moveDown(0.5)
          })
          doc.moveDown()
          doc.fontSize(12).text(`Total value: ${pdfData.totalValue != null ? pdfData.totalValue + ' lei' : 'N/A'}`)

          doc.end()
        })

        mailOptions.attachments.push({ filename: `${(pdfData.jobName || 'job').replace(/[^a-z0-9\-]/gi, '_')}_summary.pdf`, content: buffer })
      } catch (err) {
        console.warn('PDF generation failed, sending email without PDF:', err && err.message)
      }
    }

    // If the client provided a pdfUrl, try to fetch that file and attach it
    if ((!pdfData || !PDFDocument) && req.body && req.body.pdfUrl) {
      const pdfUrl = req.body.pdfUrl
      try {
        const get = pdfUrl.startsWith('https') ? require('https').get : require('http').get
        const buffer = await new Promise((resolve, reject) => {
          const reqGet = get(pdfUrl, (resp) => {
            if (resp.statusCode && resp.statusCode >= 400) return reject(new Error('Failed to fetch pdfUrl: ' + resp.statusCode))
            const chunks = []
            resp.on('data', c => chunks.push(c))
            resp.on('end', () => resolve(Buffer.concat(chunks)))
            resp.on('error', err => reject(err))
          })
          reqGet.on('error', err => reject(err))
        })
        // try to infer filename from URL
        const filename = (pdfUrl.split('/').pop() || 'attachment')
        mailOptions.attachments.push({ filename, content: buffer })
      } catch (err) {
        console.warn('Failed to fetch pdfUrl, continuing without attachment:', err && err.message)
      }
    }

    const info = await transporter.sendMail(mailOptions)

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
