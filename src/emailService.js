async function postSendEmail(payload) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    return { ok: res.ok, status: res.status, data: json }
  } catch (err) {
    console.error('postSendEmail error', err)
    return { ok: false, error: err }
  }
}

export async function sendTaskCompletionEmail({ to, clientName, jobName, taskName, taskDescription, taskValue, completedAt }, options = {}) {
  if (!to) return { ok: false, error: 'No recipient' }
  const subject = `Task finalizat: ${taskName}`
  const text = `Bună ${clientName || ''},\n\nTask-ul "${taskName}" din jobul "${jobName}" a fost marcat ca finalizat la ${completedAt || new Date().toLocaleString()}.\n\nDescriere: ${taskDescription || 'N/A'}\nValoare: ${taskValue != null ? taskValue + ' lei' : 'N/A'}\n\nMulțumim!`;
  const html = `<p>Bună ${clientName || ''},</p><p>Task-ul <strong>${taskName}</strong> din jobul <strong>${jobName}</strong> a fost marcat ca finalizat la ${completedAt || new Date().toLocaleString()}.</p><p><strong>Descriere:</strong> ${taskDescription || 'N/A'}<br/><strong>Valoare:</strong> ${taskValue != null ? taskValue + ' lei' : 'N/A'}</p><p>Mulțumim!</p>`

  // By default do NOT request a PDF. Pass { includePdf: true } in options to attach a PDF.
  const includePdf = options.includePdf === true
  const payload = { to, subject, text, html }
  if (includePdf) {
    const pdfData = {
      clientName,
      clientEmail: to,
      jobName,
      tasks: [{ name: taskName, description: taskDescription, value: taskValue }],
      totalValue: taskValue != null ? taskValue : null,
      completedAt
    }
    payload.pdfData = pdfData
  }

  return postSendEmail(payload)
}

export async function sendJobCompletionEmail({ to, clientName, jobName, tasks = [], totalValue, completedAt }) {
  if (!to) return { ok: false, error: 'No recipient' }
  const subject = `Job finalizat: ${jobName}`
  const taskList = tasks.map(t => `- ${t.name} (${t.value ? t.value + ' lei' : 'N/A'})`).join('\n')
  const htmlTasks = tasks.map(t => `<li>${t.name} — ${t.value ? t.value + ' lei' : 'N/A'}</li>`).join('')
  const text = `Bună ${clientName || ''},\n\nJobul "${jobName}" a fost finalizat la ${completedAt || new Date().toLocaleString()}.\n\nTaskuri:\n${taskList}\n\nValoare totală: ${totalValue != null ? totalValue + ' lei' : 'N/A'}`
  const html = `<p>Bună ${clientName || ''},</p><p>Jobul <strong>${jobName}</strong> a fost finalizat la ${completedAt || new Date().toLocaleString()}.</p><ul>${htmlTasks}</ul><p><strong>Valoare totală:</strong> ${totalValue != null ? totalValue + ' lei' : 'N/A'}</p>`
  // Also request a generated PDF with all client/job/task data
  const pdfData = { clientName, clientEmail: to, jobName, tasks, totalValue, completedAt }
  return postSendEmail({ to, subject, text, html, pdfData })
}

export function areAllTasksCompleted(allTasks, jobId) {
  const jt = (allTasks || []).filter(t => t.job_id === jobId)
  if (jt.length === 0) return false
  return jt.every(t => t.status === 'completed')
}

const emailService = {
  sendTaskCompletionEmail,
  sendJobCompletionEmail,
  areAllTasksCompleted,
}

export default emailService
