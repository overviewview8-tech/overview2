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
  if (!to || (Array.isArray(to) && to.length === 0)) return { ok: false, error: 'No recipient' }
  // normalize recipient list: accept string or array
  if (Array.isArray(to)) {
    to = to.join(',')
  }
  const subject = `Task finalizat: ${taskName}`
  const completedStr = completedAt || new Date().toLocaleString()
  const text = `Bună ziua,\n\nEtapa de lucru: "${taskName}" a fost finalizata.\n\nVă mulțumim că ați ales Survalley!\n\nCu Stima,\nEchipa Survalley\n\nSite: Survalley.ro\nNr. telefon:\nRel. cu publicul: 0771791893\nDep. Cadastru nr. tel: 0741155172\n\nÎn conformitate cu Regulamentul general privind protecția datelor (GDPR) (UE) 2016/679, avem datoria legală de a proteja orice informație pe care o colectăm de la dvs. Informațiile conținute în acest e-mail și orice atașament pot fi privilegiate sau confidențiale și destinate utilizării exclusive a destinatarului original. Dacă ați primit acest e-mail din greșeală, vă rugăm să informați expeditorul imediat și să ștergeți e-mailul, inclusiv golirea căsuței de e-mail șterse.\n\nUnder the General Data Protection Regulation (GDPR) (EU) 2016/679, we have a legal duty to protect any information we collect from you. Information contained in this email and any attachments may be privileged or confidential and intended for the exclusive use of the original recipient. If you have received this email by mistake, please advise the sender immediately and delete the email, including emptying your deleted email box.\n\nContact: contact@survalley.ro`;
  const html = `
    <p>Bună ziua,</p>
    <p><strong>Etapa de lucru:</strong> "<strong>${taskName}</strong>" a fost finalizata.</p>
    <p>Vă mulțumim că ați ales <strong>Survalley</strong>!</p>
    <p>Cu Stima,<br/>Echipa Survalley</p>
    <p>Site: <a href="https://survalley.ro">Survalley.ro</a><br/>Rel. cu publicul: 0771791893<br/>Dep. Cadastru nr. tel: 0741155172</p>
    <hr/>
    <p style="font-size:12px;color:#444;">În conformitate cu Regulamentul general privind protecția datelor (GDPR) (UE) 2016/679, avem datoria legală de a proteja orice informație pe care o colectăm de la dvs. Informațiile conținute în acest e-mail și orice atașament pot fi privilegiate sau confidențiale și destinate utilizării exclusive a destinatarului original. Dacă ați primit acest e-mail din greșeală, vă rugăm să informați expeditorul imediat și să ștergeți e-mailul, inclusiv golirea căsuței de e-mail șterse.</p>
    <p style="font-size:12px;color:#444;">Under the General Data Protection Regulation (GDPR) (EU) 2016/679, we have a legal duty to protect any information we collect from you. Information contained in this email and any attachments may be privileged or confidential and intended for the exclusive use of the original recipient. If you have received this email by mistake, please advise the sender immediately and delete the email, including emptying your deleted email box.</p>
    <p style="font-size:12px;color:#222;"><strong>Contact:</strong> <a href="mailto:contact@survalley.ro">contact@survalley.ro</a></p>
  `

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

  const res = await postSendEmail(payload)
  if (!res.ok) console.warn('sendTaskCompletionEmail result:', res)
  return res
}

export async function sendJobCompletionEmail({ to, clientName, jobName, tasks = [], totalValue, completedAt, clientCNP, clientSeries, clientAddress, clientFirstName, clientLastName, receptionNumber }, options = {}) {
  if (!to || (Array.isArray(to) && to.length === 0)) return { ok: false, error: 'No recipient' }
  // normalize recipient list: accept string or array
  if (Array.isArray(to)) {
    to = to.join(',')
  }
  const subject = `Înregistrare documentație cadastrală: ${jobName}`
  const completedStr = completedAt || new Date().toLocaleString()
  const text = `Bună ziua!\n\nDorim sa va informam ca inregistrarea documentatiei cadastrale a fost realizata cu succes pentru jobul "${jobName}". Pe masura ce vom primi detalii de la OCPI va vom informa. Va multumim ca ati ales Survalley!\n\nSite: Survalley.ro\nNr. telefon:\nRel. cu publicul: 0771791893\nDep. Cadastru nr. tel: 0741155172\n\nÎn conformitate cu Regulamentul general privind protecția datelor (GDPR) (UE) 2016/679, avem datoria legală de a proteja orice informație pe care o colectăm de la dvs. Informațiile conținute în acest e-mail și orice atașament pot fi privilegiate sau confidențiale și destinate utilizării exclusive a destinatarului original. Dacă ați primit acest e-mail din greșeală, vă rugăm să informați expeditorul imediat și să ștergeți e-mailul, inclusiv golirea căsuței de e-mail șterse.\n\nUnder the General Data Protection Regulation (GDPR) (EU) 2016/679, we have a legal duty to protect any information we collect from you. Information contained in this email and any attachments may be privileged or confidential and intended for the exclusive use of the original recipient. If you have received this email by mistake, please advise the sender immediately and delete the email, including emptying your deleted email box.\n\nContact: contact@survalley.ro`
  const html = `
    <p>Bună ziua!</p>
    <p>Dorim sa va informam ca inregistrarea documentatiei cadastrale a fost realizata cu succes pentru jobul "<strong>${jobName}</strong>".</p>
    <p>Pe masura ce vom primi detalii de la OCPI va vom informa.</p>
    <p>Va multumim ca ati ales <strong>Survalley</strong>!</p>
    <p>Site: <a href="https://survalley.ro">Survalley.ro</a><br/>Rel. cu publicul: 0771791893<br/>Dep. Cadastru nr. tel: 0741155172</p>
    <hr/>
    <p style="font-size:12px;color:#444;">În conformitate cu Regulamentul general privind protecția datelor (GDPR) (UE) 2016/679, avem datoria legală de a proteja orice informație pe care o colectăm de la dvs. Informațiile conținute în acest e-mail și orice atașament pot fi privilegiate sau confidențiale și destinate utilizării exclusive a destinatarului original. Dacă ați primit acest e-mail din greșeală, vă rugăm să informați expeditorul imediat și să ștergeți e-mailul, inclusiv golirea căsuței de e-mail șterse.</p>
    <p style="font-size:12px;color:#444;">Under the General Data Protection Regulation (GDPR) (EU) 2016/679, we have a legal duty to protect any information we collect from you. Information contained in this email and any attachments may be privileged or confidential and intended for the exclusive use of the original recipient. If you have received this email by mistake, please advise the sender immediately and delete the email, including emptying your deleted email box.</p>
    <p style="font-size:12px;color:#222;"><strong>Contact:</strong> <a href="mailto:contact@survalley.ro">contact@survalley.ro</a></p>
  `
  // By default do NOT attach a PDF. Pass { includePdf: true } to include the filled template.
  const includePdf = options.includePdf === true
  const payload = { to, subject, text, html }
  if (includePdf) {
    const pdfData = {
      template: 'blank',
      clientName,
      clientFirstName: clientFirstName || null,
      clientLastName: clientLastName || null,
      clientCNP: clientCNP || null,
      clientSeries: clientSeries || null,
      clientAddress: clientAddress || null,
      clientEmail: to,
      jobName,
      tasks,
      totalValue,
      completedAt,
      receptionNumber: receptionNumber != null ? receptionNumber : null
    }
    payload.pdfData = pdfData
  }
  const res = await postSendEmail(payload)
  if (!res.ok) console.warn('sendJobCompletionEmail result:', res)
  return res
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
