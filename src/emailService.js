async function postSendEmail(payload) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    return { ok: res.ok, success: res.ok, status: res.status, data: json }
  } catch (err) {
    console.error('postSendEmail error', err)
    return { ok: false, success: false, error: err }
  }
}

export async function sendTaskCompletionEmail({ to, clientName, jobName, taskName, taskDescription, taskValue, completedAt }) {
  if (!to) return { ok: false, error: 'No recipient' }
  // support different keys for recipient
  const recipient = to || clientEmail || client_email
  if (!recipient) return { ok: false, success: false, error: 'No recipient' }
  const subject = `Task finalizat: ${taskName}`
  const text = `Bună ${clientName || ''},\n\nTask-ul "${taskName}" din jobul "${jobName}" a fost marcat ca finalizat la ${completedAt || new Date().toLocaleString()}.\n\nDescriere: ${taskDescription || 'N/A'}\nValoare: ${taskValue != null ? taskValue + ' lei' : 'N/A'}\n\nMulțumim!`;
  const html = `<p>Bună ${clientName || ''},</p><p>Task-ul <strong>${taskName}</strong> din jobul <strong>${jobName}</strong> a fost marcat ca finalizat la ${completedAt || new Date().toLocaleString()}.</p><p><strong>Descriere:</strong> ${taskDescription || 'N/A'}<br/><strong>Valoare:</strong> ${taskValue != null ? taskValue + ' lei' : 'N/A'}</p><p>Mulțumim!</p>`
  return postSendEmail({ to: recipient, subject, text, html })
}

export async function sendJobCompletionEmail({ to, clientName, jobName, tasks = [], totalValue, completedAt }) {
  if (!to) return { ok: false, error: 'No recipient' }
  const recipient = to || clientEmail || client_email
  if (!recipient) return { ok: false, success: false, error: 'No recipient' }
  const subject = `Job finalizat: ${jobName}`
  const taskList = tasks.map(t => `- ${t.name} (${t.value ? t.value + ' lei' : 'N/A'})`).join('\n')
  const htmlTasks = tasks.map(t => `<li>${t.name} — ${t.value ? t.value + ' lei' : 'N/A'}</li>`).join('')
  const text = `Bună ${clientName || ''},\n\nJobul "${jobName}" a fost finalizat la ${completedAt || new Date().toLocaleString()}.\n\nTaskuri:\n${taskList}\n\nValoare totală: ${totalValue != null ? totalValue + ' lei' : 'N/A'}`
  const html = `<p>Bună ${clientName || ''},</p><p>Jobul <strong>${jobName}</strong> a fost finalizat la ${completedAt || new Date().toLocaleString()}.</p><ul>${htmlTasks}</ul><p><strong>Valoare totală:</strong> ${totalValue != null ? totalValue + ' lei' : 'N/A'}</p>`
  return postSendEmail({ to: recipient, subject, text, html })
}

export function areAllTasksCompleted(allTasks, jobId) {
  const jt = (allTasks || []).filter(t => t.job_id === jobId)
  if (jt.length === 0) return false
  return jt.every(t => t.status === 'completed')
}

// Check tasks for a given job via Supabase and send job completion email
import supabase from './supabase-client'

export async function notifyIfAllTasksCompleted({ jobId, to, clientName, jobName }) {
  if (!jobId) return { ok: false, error: 'No jobId provided' }
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('job_id', jobId)

    if (error) return { ok: false, error }

    if (!tasks || tasks.length === 0) return { ok: false, error: 'No tasks found for job' }

    const allCompleted = tasks.every(t => t.status === 'completed')
    if (!allCompleted) return { ok: false, okAllCompleted: false }

    // compute total value
    const totalValue = tasks.reduce((sum, t) => sum + (t.value ? Number(t.value) : 0), 0)

    const completedAt = new Date().toLocaleString()

    const res = await sendJobCompletionEmail({ to, clientName, jobName, tasks, totalValue, completedAt })
    return res
  } catch (err) {
    console.error('notifyIfAllTasksCompleted error', err)
    return { ok: false, error: err.message }
  }
}

const emailService = {
  sendTaskCompletionEmail,
  sendJobCompletionEmail,
  areAllTasksCompleted,
  notifyIfAllTasksCompleted,
}

export default emailService
