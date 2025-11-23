const fs = require('fs')
const path = require('path')

let PDFLib = null
let PDFLibDocument = null
let pdfLibRgb = null
let pdfLibStandardFonts = null
try {
  PDFLib = require('pdf-lib')
  PDFLibDocument = PDFLib.PDFDocument
  pdfLibRgb = PDFLib.rgb
  pdfLibStandardFonts = PDFLib.StandardFonts
} catch (e) {
  PDFLib = null
}

let PDFKit = null
try { PDFKit = require('pdfkit') } catch (e) { PDFKit = null }

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pdfData } = req.body || {}
    if (!pdfData) return res.status(400).json({ error: 'Missing pdfData' })

    // Prefer template fill via pdf-lib
    if (pdfData.template === 'blank' && PDFLibDocument) {
      const candidates = [
        path.join(process.cwd(), 'public', 'template.pdf'),
        path.join(process.cwd(), 'public', 'blank (1).pdf')
      ]
      let templatePath = null
      for (const p of candidates) {
        if (fs.existsSync(p)) { templatePath = p; break }
      }
      if (!templatePath) return res.status(404).json({ error: 'Template not found' })

      const existingPdfBytes = fs.readFileSync(templatePath)
      const pdfDoc = await PDFLibDocument.load(existingPdfBytes)
      const pages = pdfDoc.getPages()
      const firstPage = pages[0]
      const { width, height } = firstPage.getSize()
      const helvetica = await pdfDoc.embedFont(pdfLibStandardFonts.Helvetica)

      const marginLeft = 50
      let currentY = height - 120
      const lineHeight = 18
      const draw = (label, value) => {
        if (!value) return
        firstPage.drawText(`${label}: ${value}`, { x: marginLeft, y: currentY, size: 12, font: helvetica, color: pdfLibRgb(0, 0, 0) })
        currentY -= lineHeight
      }

      draw('Nume', pdfData.clientLastName || pdfData.clientName || '')
      draw('Prenume', pdfData.clientFirstName || '')
      draw('CNP', pdfData.clientCNP || pdfData.cnp || '')
      draw('Serie', pdfData.clientSeries || pdfData.serie || '')
      draw('Adresa', pdfData.clientAddress || pdfData.address || '')
      draw('Job', pdfData.jobName || '')
      draw('Finalizat la', pdfData.completedAt || '')
      if (pdfData.receptionNumber) draw('Numar receptie', String(pdfData.receptionNumber))

      const modified = await pdfDoc.save()
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${(pdfData.clientLastName || 'client')}_${(pdfData.jobName || 'job')}_filled.pdf"`)
      return res.status(200).send(Buffer.from(modified))
    }

    // Fallback: generate a simple PDF with pdfkit
    if (PDFKit) {
      const doc = new PDFKit({ size: 'A4', margin: 50 })
      const chunks = []
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${(pdfData.jobName || 'job').replace(/[^a-z0-9\-]/gi, '_')}_summary.pdf"`)
        res.status(200).send(buffer)
      })

      doc.fontSize(18).text(pdfData.jobName || 'Job Summary', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12).text(`Client: ${pdfData.clientName || ''}`)
      doc.text(`Client email: ${pdfData.clientEmail || ''}`)
      if (pdfData.clientFirstName || pdfData.clientLastName) doc.text(`Client name parts: ${pdfData.clientFirstName || ''} ${pdfData.clientLastName || ''}`)
      if (pdfData.clientCNP) doc.text(`CNP: ${pdfData.clientCNP}`)
      if (pdfData.clientSeries) doc.text(`Serie: ${pdfData.clientSeries}`)
      if (pdfData.clientAddress) doc.text(`Adresa: ${pdfData.clientAddress}`)
      doc.text(`Completed at: ${pdfData.completedAt || ''}`)
      doc.moveDown()
      doc.fontSize(14).text('Tasks:', { underline: true })
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
      return
    }

    return res.status(500).json({ error: 'No PDF generation library available on server' })
  } catch (err) {
    console.error('generate-pdf error', err)
    return res.status(500).json({ error: err.message || 'Failed to generate PDF' })
  }
}
