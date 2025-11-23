const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')

// Load the API handlers from the repo's api/ folder
const sendEmailHandler = require(path.join(__dirname, '..', 'api', 'send-email'))
let generatePdfHandler = null
try {
  generatePdfHandler = require(path.join(__dirname, '..', 'api', 'generate-pdf'))
} catch (e) {
  console.warn('generate-pdf handler not found or failed to load:', e && e.message)
}

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

app.use(bodyParser.json())

// Mount the API routes
app.post('/api/send-email', (req, res) => sendEmailHandler(req, res))
if (generatePdfHandler) {
  app.post('/api/generate-pdf', (req, res) => generatePdfHandler(req, res))
}

// Optional: health check
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
})
