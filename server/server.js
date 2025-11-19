const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')

// Load the API handler from the repo's api/ folder
const sendEmailHandler = require(path.join(__dirname, '..', 'api', 'send-email'))

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

app.use(bodyParser.json())

// Mount the API route
app.post('/api/send-email', (req, res) => sendEmailHandler(req, res))

// Optional: health check
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
})
