import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

async function fetchTemplateBuffer() {
  const candidates = ['/template.pdf', '/blank (1).pdf']
  for (const p of candidates) {
    try {
      const res = await fetch(p)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      return buf
    } catch (e) {
      // try next
    }
  }
  return null
}

export async function generateAndDownloadPdf(pdfData) {
  try {
    const tpl = await fetchTemplateBuffer()
    let pdfDoc
    if (tpl) {
      pdfDoc = await PDFDocument.load(tpl)
    } else {
      pdfDoc = await PDFDocument.create()
      pdfDoc.addPage()
    }

    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // global/default font size (can be overridden per-field via pdfData.fieldBoxes[...].size)
    const defaultFontSize = (pdfData && pdfData.fontSize) ? Number(pdfData.fontSize) : 12
    const marginLeft = 50
    let currentY = height - 120
    const lineHeight = Math.max(12, Math.round(defaultFontSize * 1.6))

    const draw = (label, value, opts = {}) => {
      if (value === undefined || value === null || value === '') return
      const x = (opts.x != null) ? opts.x : marginLeft
      const y = (opts.y != null) ? opts.y : currentY
      const size = opts.size || defaultFontSize
      const text = label ? `${label} ${value}` : `${value}`
      firstPage.drawText(text, { x, y, size, font: helvetica, color: rgb(0, 0, 0) })
      // only advance flow Y if we used flow placement (no explicit y provided)
      if (opts.y == null) currentY -= lineHeight
    }

    const drawWrapped = (label, value, opts = {}) => {
      if (value === undefined || value === null || value === '') {
        // if using flow placement, still advance
        if (!opts || opts.y == null) currentY -= lineHeight
        return
      }
      const size = opts.size || defaultFontSize
      const x = (opts.x != null) ? opts.x : marginLeft
      // use provided y or currentY for flow
      const y = (opts.y != null) ? opts.y : currentY
      // prefer explicit width/height if provided, otherwise fall back to maxWidth/maxHeight
      const availWidthTotal = (opts.width != null) ? opts.width : (opts.maxWidth != null ? opts.maxWidth : (width - marginLeft - 50))
      const maxHeight = (opts.height != null) ? opts.height : (opts.maxHeight != null ? opts.maxHeight : (lineHeight * 4))

      const labelText = label ? `${label} ` : ''
      const labelWidth = helvetica.widthOfTextAtSize(labelText, size)
      if (labelText) firstPage.drawText(labelText, { x, y, size, font: helvetica, color: rgb(0, 0, 0) })

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
        while (helvetica.widthOfTextAtSize(`${last}...`, size) > availWidth && last.length > 0) last = last.slice(0, -1)
        renderedLines[renderedLines.length - 1] = `${last}...`
      }

      const startX = x + labelWidth
      for (let i = 0; i < renderedLines.length; i++) {
        firstPage.drawText(renderedLines[i], { x: startX, y: y - i * lineHeight, size, font: helvetica, color: rgb(0, 0, 0) })
      }
      // advance flow only if we used flow (no explicit y provided)
      if (opts.y == null) currentY -= Math.max(lineHeight, renderedLines.length * lineHeight)
    }

    // Draw a field with per-field defaults. If pdfData.fieldBoxes provides options
    // it will be merged with the defaults. If opts.y is provided, absolute placement
    // is used and flow (currentY) is not advanced; otherwise flow is used.
    const drawFieldAt = (fieldKey, label, value, defaultX = marginLeft, defaultY = null, defaultOpts = {}) => {
      const boxes = pdfData && pdfData.fieldBoxes
      const boxOpts = boxes && (boxes[fieldKey] || boxes[label])
      const merged = Object.assign({}, defaultOpts, boxOpts || {})
      if (merged.x == null) merged.x = defaultX
      if (merged.y == null && defaultY != null) merged.y = defaultY

      // support global or per-field noLabel flag
      const noLabelGlobal = pdfData && pdfData.noLabels
      if (noLabelGlobal) merged.noLabel = true

        // Special handling for series: split into first 2 chars and last 6 chars
        if (fieldKey === 'clientSeries' && value) {
          const s = String(value)
          const firstPart = s.slice(0, 2)
          const restPart = s.length > 2 ? s.slice(-6) : ''
        // compute positions: allow explicit part1X/part1Y and part2X/part2Y
        const part1X = merged.part1X != null ? merged.part1X : merged.x
        const part1Y = merged.part1Y != null ? merged.part1Y : merged.y
        const baseForOffset = (merged.part1X != null ? merged.part1X : merged.x)
        const part2X = merged.part2X != null ? merged.part2X : (baseForOffset + (merged.part2Offset != null ? merged.part2Offset : 35))
        const part2Y = merged.part2Y != null ? merged.part2Y : merged.y
        const size = merged.size || defaultFontSize
        if (!merged.noLabel && label) {
          // draw label once at part1X
          firstPage.drawText(`${label} `, { x: part1X, y: part1Y, size, font: helvetica, color: rgb(0, 0, 0) })
          const lw = helvetica.widthOfTextAtSize(`${label} `, size)
          firstPage.drawText(firstPart, { x: part1X + lw, y: part1Y, size, font: helvetica, color: rgb(0, 0, 0) })
        } else {
          firstPage.drawText(firstPart, { x: part1X, y: part1Y, size, font: helvetica, color: rgb(0, 0, 0) })
        }
        if (restPart) firstPage.drawText(restPart, { x: part2X, y: part2Y, size, font: helvetica, color: rgb(0, 0, 0) })
        if (merged.y == null) currentY -= lineHeight
        return
      }

      // If user provided explicit x/y in merged opts, drawWrapped will not advance flow.
      if (boxOpts) return drawWrapped(label, value, merged)

      // No per-field box provided: use flow placement. Pass opts without y so draw/drawWrapped
      // will advance currentY.
      return draw(label, value, merged)
    }

    // Use exact coordinates for our own keys (not fillTemplate keys).
    // Defaults can be overridden by entries in pdfData.fieldBoxes using the same keys.
    

    // Client fields (our keys)
    drawFieldAt('clientLastName', '', pdfData.clientLastName || pdfData.clientName || '', 190, height - 390, { width: 200, height: 18, size: defaultFontSize })
    drawFieldAt('clientFirstName', '', pdfData.clientFirstName || '', 250, height - 390, { width: 200, height: 18, size: defaultFontSize })
    drawFieldAt('clientCNP', '', pdfData.clientCNP || pdfData.cnp || '', 380, height - 405, { width: 160, height: 18, size: defaultFontSize })
    drawFieldAt('clientSeries', '', pdfData.clientSeries || pdfData.serie || '', 270, height - 405, { width: 100, height: 18, size: defaultFontSize })
    drawFieldAt('clientAddress', '', pdfData.clientAddress || pdfData.address || '', 385, height - 390, { width: 300, height: 180, size: defaultFontSize })
   

    // Representative and signatures
    

   

    const uint8Array = await pdfDoc.save()
    const blob = new Blob([uint8Array], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filenameBase = `${(pdfData.clientLastName || 'client').replace(/[^a-z0-9\-_\. ]/gi, '_')}_${(pdfData.jobName || 'job').replace(/[^a-z0-9\-_\. ]/gi, '_')}`
    a.href = url
    a.download = `${filenameBase}_filled.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (err) {
    console.error('generateAndDownloadPdf error', err)
    return { ok: false, error: err.message || String(err) }
  }
}

export default generateAndDownloadPdf
