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
          if (value === undefined || value === null || value === '') return
          const size = (opts.size != null) ? opts.size : defaultFontSize
          const x = (opts.x != null) ? opts.x : marginLeft
          const y = (opts.y != null) ? opts.y : currentY
          firstPage.drawText(`${label ? label + ' ' : ''}${value}`, { x, y, size, font: helvetica, color: pdfLibRgb(0, 0, 0) })
          if (opts.y == null) currentY -= lineHeight
        const lineHeight = Math.max(12, Math.round(defaultFontSize * 1.6))

      // draw simple single-line label + value
      const draw = (label, value, opts = {}) => {
        if (value === undefined || value === null || value === '') return
        const size = (opts.size != null) ? opts.size : defaultFontSize
        const x = (opts.x != null) ? opts.x : marginLeft
        const y = (opts.y != null) ? opts.y : currentY
        firstPage.drawText(`${label ? label + ' ' : ''}${value}`, { x, y, size, font: helvetica, color: pdfLibRgb(0, 0, 0) })
        if (opts.y == null) currentY -= lineHeight
      }

      // draw label and wrap value into multiple lines respecting maxWidth and maxHeight
      const drawWrapped = (label, value, opts = {}) => {
        if (value === undefined || value === null || value === '') {
          if (!opts || opts.y == null) currentY -= lineHeight
          return
        }
        const size = (opts.size != null) ? opts.size : defaultFontSize
        const x = (opts.x != null) ? opts.x : marginLeft
        // prefer explicit width/height if provided
        const availWidthTotal = (opts.width != null) ? opts.width : (opts.maxWidth != null ? opts.maxWidth : (width - marginLeft - 50))
        const maxHeight = (opts.height != null) ? opts.height : (opts.maxHeight != null ? opts.maxHeight : (lineHeight * 4)) // default allow up to 4 lines

        const labelText = label ? `${label} ` : ''
        const y = (opts.y != null) ? opts.y : currentY
        const labelWidth = helvetica.widthOfTextAtSize(labelText, size)
        if (labelText) firstPage.drawText(labelText, { x, y, size, font: helvetica, color: pdfLibRgb(0, 0, 0) })

        const availWidth = Math.max(20, availWidthTotal - labelWidth)
        const words = String(value).split(/\s+/)
        const lines = []
        let line = ''
        for (const w of words) {
          const test = line ? `${line} ${w}` : w
          const wWidth = helvetica.widthOfTextAtSize(test, size)
          if (wWidth <= availWidth) {
            line = test
          } else {
            if (line) lines.push(line)
            line = w
          }
        }
        if (line) lines.push(line)

        const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight))
        let renderedLines = lines.slice(0, maxLines)
        if (lines.length > maxLines) {
          // truncate last line and add ellipsis
          let last = renderedLines[renderedLines.length - 1]
          while (helvetica.widthOfTextAtSize(`${last}...`, size) > availWidth && last.length > 0) {
            last = last.slice(0, -1)
          }
          renderedLines[renderedLines.length - 1] = `${last}...`
        }

        const startX = x + labelWidth
        for (let i = 0; i < renderedLines.length; i++) {
          firstPage.drawText(renderedLines[i], { x: startX, y: y - i * lineHeight, size, font: helvetica, color: pdfLibRgb(0, 0, 0) })
        }
        if (opts.y == null) currentY -= Math.max(lineHeight, renderedLines.length * lineHeight)
      }

      // Helpers to draw on an arbitrary page (page-2). Mirrors drawWrapped/drawField semantics.
      const drawWrappedOn = (page, label, value, opts = {}, pageWidth = width, pageHeight = height) => {
        if (value === undefined || value === null || value === '') return
        const size = (opts.size != null) ? opts.size : defaultFontSize
        const x = (opts.x != null) ? opts.x : marginLeft
        const y = (opts.y != null) ? opts.y : (pageHeight - 120)
        const availWidthTotal = (opts.width != null) ? opts.width : (opts.maxWidth != null ? opts.maxWidth : (pageWidth - marginLeft - 50))
        const maxHeight = (opts.height != null) ? opts.height : (opts.maxHeight != null ? opts.maxHeight : (lineHeight * 4))

        const labelText = label ? `${label} ` : ''
        const labelWidth = helvetica.widthOfTextAtSize(labelText, size)
        if (labelText) page.drawText(labelText, { x, y, size, font: helvetica, color: pdfLibRgb(0,0,0) })

        const availWidth = Math.max(20, availWidthTotal - labelWidth)
        const words = String(value).split(/\s+/)
        const lines = []
        let line = ''
        for (const w of words) {
          const test = line ? `${line} ${w}` : w
          const wWidth = helvetica.widthOfTextAtSize(test, size)
          if (wWidth <= availWidth) {
            line = test
          } else {
            if (line) lines.push(line)
            line = w
          }
        }
        if (line) lines.push(line)

        const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight))
        let renderedLines = lines.slice(0, maxLines)
        if (lines.length > maxLines) {
          let last = renderedLines[renderedLines.length - 1]
          while (helvetica.widthOfTextAtSize(`${last}...`, size) > availWidth && last.length > 0) {
            last = last.slice(0, -1)
          }
          renderedLines[renderedLines.length - 1] = `${last}...`
        }

        const startX = x + labelWidth
        for (let i = 0; i < renderedLines.length; i++) {
          page.drawText(renderedLines[i], { x: startX, y: y - i * lineHeight, size, font: helvetica, color: pdfLibRgb(0,0,0) })
        }
      }

      const drawFieldOn = (page, fieldKey, label, value, defaultX = marginLeft, defaultY = null, defaultOpts = {}, pageWidth = width, pageHeight = height) => {
        const boxes = pdfData && pdfData.fieldBoxes
        const boxOpts = boxes && (boxes[fieldKey] || boxes[label])
        const merged = Object.assign({}, defaultOpts, boxOpts || {})
        if (merged.x == null) merged.x = defaultX
        if (merged.y == null && defaultY != null) merged.y = defaultY
        if (pdfData && pdfData.noLabels) merged.noLabel = true

        // special handling for clientSeries
        if (fieldKey === 'clientSeries' && value) {
          const s = String(value)
          const firstPart = s.slice(0, 2)
          const restPart = s.length > 2 ? s.slice(-6) : ''
          const part1X = (merged.part1X != null) ? merged.part1X : ((merged.x != null) ? merged.x : marginLeft)
          const part1Y = (merged.part1Y != null) ? merged.part1Y : ((merged.y != null) ? merged.y : currentY)
          const baseForOffset = part1X
          const part2X = merged.part2X != null ? merged.part2X : (baseForOffset + (merged.part2Offset != null ? merged.part2Offset : 50))
          const part2Y = (merged.part2Y != null) ? merged.part2Y : ((merged.y != null) ? merged.y : currentY)
          const size = merged.size || defaultFontSize
          if (!merged.noLabel && label) {
            page.drawText(`${label} `, { x: part1X, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
            const lw = helvetica.widthOfTextAtSize(`${label} `, size)
            page.drawText(firstPart, { x: part1X + lw, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
          } else {
            page.drawText(firstPart, { x: part1X, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
          }
          if (restPart) page.drawText(restPart, { x: part2X, y: part2Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
          return
        }

        if (boxOpts) return drawWrappedOn(page, label, value, boxOpts, pageWidth, pageHeight)
        return page.drawText(`${label ? label + ' ' : ''}${value}`, { x: merged.x, y: (merged.y != null) ? merged.y : (pageHeight - 120), size: (merged.size != null) ? merged.size : defaultFontSize, font: helvetica, color: pdfLibRgb(0,0,0) })
      }

        // drawField chooses wrapped or simple rendering based on pdfData.fieldBoxes
        const drawField = (fieldKey, label, value) => {
          const boxes = pdfData && pdfData.fieldBoxes
          const boxOpts = boxes && (boxes[fieldKey] || boxes[label])
          const merged = Object.assign({}, boxOpts || {})
          // global no-label flag
          if (pdfData && pdfData.noLabels) merged.noLabel = true

          // special split for series (first 2 chars and last 6 chars)
          if (fieldKey === 'clientSeries' && value) {
            const s = String(value)
            const firstPart = s.slice(0, 2)
            const restPart = s.length > 2 ? s.slice(-6) : ''
            // compute positions: allow explicit part1X/part1Y and part2X/part2Y
            const part1X = (merged.part1X != null) ? merged.part1X : ((merged.x != null) ? merged.x : marginLeft + 520 - marginLeft)
            const part1Y = (merged.part1Y != null) ? merged.part1Y : ((merged.y != null) ? merged.y : currentY)
            const baseForOffset = part1X
            const part2X = merged.part2X != null ? merged.part2X : (baseForOffset + (merged.part2Offset != null ? merged.part2Offset : 50))
            const part2Y = (merged.part2Y != null) ? merged.part2Y : ((merged.y != null) ? merged.y : currentY)
            const size = merged.size || 12
            if (!merged.noLabel && label) {
              firstPage.drawText(`${label} `, { x: part1X, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
              const lw = helvetica.widthOfTextAtSize(`${label} `, size)
              firstPage.drawText(firstPart, { x: part1X + lw, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
            } else {
              firstPage.drawText(firstPart, { x: part1X, y: part1Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
            }
            if (restPart) firstPage.drawText(restPart, { x: part2X, y: part2Y, size, font: helvetica, color: pdfLibRgb(0,0,0) })
            if (merged.y == null) currentY -= lineHeight
            return
          }

          if (boxOpts) return drawWrapped(label, value, boxOpts)
          return draw(label, value)
        }

      drawField('clientLastName', '', pdfData.clientLastName || pdfData.clientName || '')
      drawField('clientFirstName', '', pdfData.clientFirstName || '')
      drawField('clientCNP', 'CNP', pdfData.clientCNP || pdfData.cnp || '')
      drawField('clientSeries', 'Serie', pdfData.clientSeries || pdfData.serie || '')
      // Address/location uses configurable box when provided via pdfData.fieldBoxes.clientAddress
      drawField('clientAddress', 'Adresa', pdfData.clientAddress || pdfData.address || '')
      drawField('jobName', 'Job', pdfData.jobName || '')
      drawField('completedAt', 'Finalizat la', pdfData.completedAt || '')
      if (pdfData.receptionNumber) drawField('receptionNumber', 'Numar receptie', String(pdfData.receptionNumber))

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
      doc.fontSize(12).text(`Client ${pdfData.clientName || ''}`)
      doc.text(`Client email ${pdfData.clientEmail || ''}`)
      if (pdfData.clientFirstName || pdfData.clientLastName) doc.text(`Client name parts ${pdfData.clientFirstName || ''} ${pdfData.clientLastName || ''}`)
      if (pdfData.clientCNP) doc.text(`CNP ${pdfData.clientCNP}`)
      if (pdfData.clientSeries) doc.text(`Serie ${pdfData.clientSeries}`)
      if (pdfData.clientAddress) doc.text(`Adresa ${pdfData.clientAddress}`)
      doc.text(`Completed at ${pdfData.completedAt || ''}`)
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
