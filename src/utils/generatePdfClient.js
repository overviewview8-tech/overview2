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

    const marginLeft = 50
    let currentY = height - 120
    const lineHeight = 18

    const draw = (label, value) => {
      if (!value && value !== 0) return
      firstPage.drawText(`${label}: ${value}`, { x: marginLeft, y: currentY, size: 12, font: helvetica, color: rgb(0, 0, 0) })
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
