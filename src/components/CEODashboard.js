import React, { useEffect, useState } from 'react'
import supabase from '../supabase-client'

export default function CEODashboard() {
  const formatProfileLabel = (p) => {
    if (!p) return ''
    const email = p.email || ''
    const name = p.full_name || p.name
    return name ? `${email} — ${name}` : (email || String(p.id))
  }
  // create-job form state
  const [jobname, setJobname] = useState('')
  const [clientname, setClientname] = useState('')
  const [clientemail, setClientemail] = useState('')
  // total is computed from tasks; don't store manual totalValue
  const [newJobTasks, setNewJobTasks] = useState([{ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' }])
  const [showCreateWithTasks, setShowCreateWithTasks] = useState(false)

  // listing/editing state
  const [jobs, setJobs] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskEdits, setTaskEdits] = useState({})
  const [addingTaskFor, setAddingTaskFor] = useState(null)
  const [newTaskFields, setNewTaskFields] = useState({ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' })

  // fetch jobs + tasks
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: jobsData, error: jobsErr } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
      if (jobsErr) throw jobsErr
      const { data: tasksData, error: tasksErr } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      // fetch profiles for assignment and display
      const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('id, user_id, email, full_name, name').order('id')
      if (profilesErr) console.warn('Could not fetch profiles', profilesErr)
      if (tasksErr) throw tasksErr
      setJobs(jobsData || [])
      setTasks(tasksData || [])
      setProfiles(profilesData || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la încărcare date')
    } finally {
      setLoading(false)
    }
  }

  // allow manual refresh of profiles list if the dropdown appears empty
  const fetchProfiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('id, user_id, email, full_name, name').order('id')
      if (profilesErr) throw profilesErr
      setProfiles(profilesData || [])
    } catch (err) {
      console.error('Could not fetch profiles', err)
      setError(err.message || 'Eroare la încărcare profiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ensure we have profile rows for any user ids referenced in tasks (completed_by / assigned_to)
  useEffect(() => {
    const referenced = new Set()
    for (const t of tasks) {
      if (t && t.completed_by) referenced.add(String(t.completed_by))
      if (t && t.assigned_to) referenced.add(String(t.assigned_to))
      if (t && t.assigned_to_email) referenced.add(String(t.assigned_to_email))
    }
    if (referenced.size === 0) return
    const knownIds = new Set([
      ...profiles.map(p => String(p.id)),
      ...profiles.map(p => String(p.user_id)),
      ...profiles.map(p => String(p.email))
    ])
    const missing = [...referenced].filter(id => id && !knownIds.has(id))
    if (missing.length === 0) return

    // fetch missing profiles and merge into state; first try by id, then by user_id for any left
    ;(async () => {
      try {
        const fetched = []
        // fetch by id
        try {
          const { data: byId, error: byIdErr } = await supabase.from('profiles').select('id, user_id, email, full_name, name').in('id', missing)
          if (byIdErr) console.warn('profiles by id err', byIdErr)
          if (byId && byId.length) fetched.push(...byId)
        } catch (e) { console.warn('fetch by id failed', e) }

        // determine still missing (not found by id)
        const foundIds = new Set(fetched.map(p => String(p.id)).concat(fetched.map(p => String(p.user_id))))
        const stillMissing = missing.filter(id => !foundIds.has(id))
        if (stillMissing.length > 0) {
          try {
            const { data: byUser, error: byUserErr } = await supabase.from('profiles').select('id, user_id, email, full_name, name').in('user_id', stillMissing)
            if (byUserErr) console.warn('profiles by user_id err', byUserErr)
            if (byUser && byUser.length) fetched.push(...byUser)
          } catch (e) { console.warn('fetch by user_id failed', e) }
        }

        // still missing: try by email
        const foundEmails = new Set(fetched.map(p => String(p.email)))
        const stillMissingEmails = missing.filter(id => !foundEmails.has(id))
        if (stillMissingEmails.length > 0) {
          try {
            const { data: byEmail, error: byEmailErr } = await supabase.from('profiles').select('id, user_id, email, full_name, name').in('email', stillMissingEmails)
            if (byEmailErr) console.warn('profiles by email err', byEmailErr)
            if (byEmail && byEmail.length) fetched.push(...byEmail)
          } catch (e) { console.warn('fetch by email failed', e) }
        }

        if (fetched.length > 0) {
          setProfiles(prev => {
            const byKey = new Map(prev.map(p => [String(p.id), p]))
            for (const p of fetched) byKey.set(String(p.id), p)
            return [...byKey.values()]
          })
        }
      } catch (err) {
        console.warn('Error fetching missing profiles', err)
      }
    })()
  }, [tasks, profiles])

  // create job handler (keeps previous behavior)
  const handleCreateJob = async (e) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (!jobname || !clientname) {
      setMessage('Completează numele job și client.')
      return
    }
    // total_value is computed from task values, do not accept manual total here

    setLoading(true)
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userData?.user
      if (!user) { setMessage('Trebuie autentificat'); setLoading(false); return }

  const payload = { name: jobname, client_name: clientname, client_email: clientemail || null, created_by: user.id }
      const { data, error: insertErr } = await supabase.from('jobs').insert([payload]).select()
      if (insertErr) throw insertErr

      const createdJob = data[0]
      // if there are newJobTasks, insert them linked to the created job
      if (Array.isArray(newJobTasks) && newJobTasks.length > 0) {
        // prepare tasks payload mapping and parsing numbers
        const tasksPayload = newJobTasks
            .filter(t => t && t.name)
        .map(t => ({
              job_id: createdJob.id,
              name: t.name,
              description: t.description || null,
          value: t.value === '' ? null : parseFloat(t.value),
          estimated_hours: t.estimated_hours === '' ? null : parseFloat(t.estimated_hours),
          assigned_to_email: t.assigned_to_email || null,
              created_by: user.id
            }))

          // validate numeric values for tasksPayload
          for (const tp of tasksPayload) {
            if (tp.value != null && (isNaN(Number(tp.value)) || Number(tp.value) < 0)) {
              throw new Error('Unul din taskuri are valoare invalidă (trebuie >= 0)')
            }
            if (tp.estimated_hours != null && (isNaN(Number(tp.estimated_hours)) || Number(tp.estimated_hours) < 0)) {
              throw new Error('Unul din taskuri are ore estimate invalide (trebuie >= 0)')
            }
          }

        if (tasksPayload.length > 0) {
            const { data: tasksData, error: tasksErr } = await supabase.from('tasks').insert(tasksPayload).select()
            if (tasksErr) throw tasksErr
            // add new tasks to local state
            setTasks(prev => [...tasksData, ...prev])
          // persist total_value to DB based on inserted tasks
          await recalcJobTotal(createdJob.id)
          // refresh createdJob from DB so it has the updated total_value
          const { data: refreshed, error: rErr } = await supabase.from('jobs').select('*').eq('id', createdJob.id).limit(1).single()
          if (!rErr && refreshed) createdJob.total_value = refreshed.total_value
        }
        else {
          // no tasks: ensure job total is zero in DB
          await recalcJobTotal(createdJob.id)
          const { data: refreshed, error: rErr } = await supabase.from('jobs').select('*').eq('id', createdJob.id).limit(1).single()
          if (!rErr && refreshed) createdJob.total_value = refreshed.total_value
        }
      }

  setMessage('Job creat cu succes')
  // add to local jobs list (createdJob may have been refreshed with total)
  setJobs(prev => [createdJob, ...prev])
  // reset form
  setJobname(''); setClientname(''); setClientemail('')
  setNewJobTasks([{ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' }])
      setShowCreateWithTasks(false)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la creare job')
    } finally {
      setLoading(false)
    }
  }

  // handlers for building tasks in the create-job form


  const addNewJobTaskRow = () => setNewJobTasks(prev => [...prev, { name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' }])
  const removeNewJobTaskRow = (index) => setNewJobTasks(prev => prev.filter((_, i) => i !== index))
  const updateNewJobTaskField = (index, field, value) => setNewJobTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))

  // helpers for tasks listing/edit
  const tasksByJob = tasks.reduce((acc, t) => { (acc[t.job_id] = acc[t.job_id] || []).push(t); return acc }, {})

  // recalculate job total_value from tasks and persist to DB, then update local jobs state
  const recalcJobTotal = async (jobId) => {
    try {
      const { data: taskRows, error: taskErr } = await supabase.from('tasks').select('value').eq('job_id', jobId)
      if (taskErr) throw taskErr
      const sum = (taskRows || []).reduce((s, r) => s + (Number(r.value) || 0), 0)
      const { data: jobData, error: jobErr } = await supabase.from('jobs').update({ total_value: sum }).eq('id', jobId).select()
      if (jobErr) throw jobErr
      const updatedJob = jobData && jobData[0]
      if (updatedJob) setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j))
      return sum
    } catch (err) {
      console.warn('Could not recalc job total', err)
      return null
    }
  }

  // sanitize numeric text inputs: allow digits and one decimal separator (accept comma as decimal by converting to dot)
  const sanitizeNumberInput = (val) => {
    if (val === undefined || val === null) return ''
    let s = String(val)
    // accept comma as decimal separator (common in Romanian), convert to dot
    s = s.replace(/,/g, '.')
    // remove any character that is not digit or dot
    s = s.replace(/[^0-9.]/g, '')
    if (s === '') return ''
    const parts = s.split('.')
    if (parts.length <= 1) return parts[0]
    const integer = parts.shift()
    const decimal = parts.join('') // join remaining parts (remove extra dots)
    return integer + '.' + decimal
  }

  // display helper for completed/assigned users: prefer email, then profile name, then id
  const displayUserLabel = (value) => {
    if (!value && value !== 0) return '—'
    const s = String(value)
    // if looks like email, return it
    if (s.includes('@')) return s
    // try find profile by email, id or user_id
    const p = profiles.find(x => String(x.email) === s || String(x.id) === s || String(x.user_id) === s)
    if (p) return p.email || p.full_name || p.name || String(p.id)
    return s
  }

  const startEdit = (task) => {
    setEditingTaskId(task.id)
    setTaskEdits({ name: task.name || '', value: task.value != null ? String(task.value) : '', status: task.status || 'todo', estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : '', assigned_to_email: task.assigned_to_email || task.assigned_to || '' })
  }
  const cancelEdit = () => { setEditingTaskId(null); setTaskEdits({}) }
  const handleTaskChange = (field, val) => setTaskEdits(prev => ({ ...prev, [field]: val }))

  const saveTask = async (taskId) => {
    setLoading(true); setError(null)
    try {
      const updates = {}
      if (taskEdits.name !== undefined) updates.name = taskEdits.name
  if (taskEdits.status !== undefined) updates.status = taskEdits.status
      if (taskEdits.value !== undefined) updates.value = taskEdits.value === '' ? null : parseFloat(taskEdits.value)
      if (taskEdits.estimated_hours !== undefined) updates.estimated_hours = taskEdits.estimated_hours === '' ? null : parseFloat(taskEdits.estimated_hours)
  if (taskEdits.assigned_to_email !== undefined) updates.assigned_to_email = taskEdits.assigned_to_email === '' ? null : taskEdits.assigned_to_email

      // if status changed to completed, record who and when; if switched back to todo, clear those fields
      if (taskEdits.status !== undefined) {
        if (taskEdits.status === 'completed') {
          const { data: userData, error: userErr } = await supabase.auth.getUser()
          if (userErr) throw userErr
          const user = userData?.user
          if (user) {
            // store email in completed_by as requested
            updates.completed_by = user.email || user.id
            updates.completed_at = new Date().toISOString()
          }
        } else {
          updates.completed_by = null
          updates.completed_at = null
          
        }
      }

      const { data, error: updErr } = await supabase.from('tasks').update(updates).eq('id', taskId).select()
      if (updErr) throw updErr
      setTasks(prev => prev.map(t => (t.id === taskId ? data[0] : t)))
      setEditingTaskId(null); setTaskEdits({})
      // if value changed, recalc job total
      try {
        const jobId = data[0]?.job_id
        if (jobId != null && taskEdits.value !== undefined) await recalcJobTotal(jobId)
      } catch (e) { console.warn('recalc after saveTask failed', e) }
    } catch (err) {
      console.error(err); setError(err.message || 'Eroare la update task')
    } finally { setLoading(false) }
  }

  const toggleComplete = async (task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    setLoading(true); setError(null)
    try {
      // include completed_by/completed_at/email when marking completed
      let updatePayload = { status: newStatus }
      if (newStatus === 'completed') {
        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        const user = userData?.user
        if (user) {
          // store the email in completed_by as requested
          updatePayload.completed_by = user.email || user.id
          updatePayload.completed_at = new Date().toISOString()
        }
      } else {
        updatePayload.completed_by = null
        updatePayload.completed_at = null
      }

      const { data, error: updErr } = await supabase.from('tasks').update(updatePayload).eq('id', task.id).select()
      if (updErr) throw updErr
      setTasks(prev => prev.map(t => (t.id === task.id ? data[0] : t)))
    } catch (err) { 
      console.error('Toggle complete error', err)
      setError(err.message || 'Eroare la modificare status')
    } finally { setLoading(false) }
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Ștergi acest task?')) return
    setLoading(true); setError(null)
    try {
      // find job id before deletion so we can recalc afterwards
      const taskRow = tasks.find(t => t.id === taskId)
      const jobId = taskRow ? taskRow.job_id : null
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
      if (delErr) throw delErr
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (jobId != null) await recalcJobTotal(jobId)
    } catch (err) { console.error(err); setError(err.message || 'Eroare la ștergere task') } finally { setLoading(false) }
  }

  const deleteJob = async (jobId) => {
    if (!window.confirm('Ștergi jobul și taskurile sale?')) return
    setLoading(true); setError(null)
    try {
      const { error: delErr } = await supabase.from('jobs').delete().eq('id', jobId)
      if (delErr) throw delErr
      setJobs(prev => prev.filter(j => j.id !== jobId))
      setTasks(prev => prev.filter(t => t.job_id !== jobId))
    } catch (err) { console.error(err); setError(err.message || 'Eroare la ștergere job') } finally { setLoading(false) }
  }

  const toggleCompleteJob = async (job) => {
    const newStatus = job.status === 'completed' ? 'open' : 'completed'
    setLoading(true); setError(null)
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userData?.user

      const updatePayload = { status: newStatus }
      if (newStatus === 'completed') {
        if (user) {
          // store email when possible (if DB expects text); fallback to id if email missing
          updatePayload.completed_by = user.email || user.id
          updatePayload.completed_at = new Date().toISOString()
        }
      } else {
        updatePayload.completed_by = null
        updatePayload.completed_at = null
      }

      // try update, if DB rejects completed_by due to FK/type, retry without it
      try {
        const { data, error: updErr } = await supabase.from('jobs').update(updatePayload).eq('id', job.id).select()
        if (updErr) throw updErr
        setJobs(prev => prev.map(j => (j.id === job.id ? data[0] : j)))
      } catch (err) {
        const msg = String(err?.message || err?.details || '')
        if (msg.toLowerCase().includes('completed_by') || msg.toLowerCase().includes('column') || msg.toLowerCase().includes('constraint')) {
          const safe = { ...updatePayload }
          delete safe.completed_by
          const { data, error: updErr2 } = await supabase.from('jobs').update(safe).eq('id', job.id).select()
          if (updErr2) throw updErr2
          setJobs(prev => prev.map(j => (j.id === job.id ? data[0] : j)))
        } else {
          throw err
        }
      }
    } catch (err) {
      console.error('Toggle job complete error', err)
      setError(err.message || 'Eroare la modificare status job')
    } finally { setLoading(false) }
  }

  // add task handlers
  const startAddTask = (jobId) => {
    setAddingTaskFor(jobId)
    setNewTaskFields({ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' })
  }
  const cancelAddTask = () => { setAddingTaskFor(null); setNewTaskFields({ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' }) }
  const handleNewTaskChange = (field, val) => setNewTaskFields(prev => ({ ...prev, [field]: val }))

  const submitAddTask = async (jobId) => {
    setLoading(true); setError(null)
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userData?.user
      if (!user) { setError('Trebuie să fii autentificat'); setLoading(false); return }

      if (!newTaskFields.name) { setError('Taskul trebuie să aibă un nume'); setLoading(false); return }

      // validate numeric value if provided
      if (newTaskFields.value !== '' && (isNaN(Number(newTaskFields.value)) || Number(newTaskFields.value) < 0)) {
        setError('Valoarea taskului trebuie să fie un număr >= 0')
        setLoading(false)
        return
      }

      const payload = {
        job_id: jobId,
        name: newTaskFields.name,
        description: newTaskFields.description || null,
        value: newTaskFields.value === '' ? null : parseFloat(newTaskFields.value),
        assigned_to_email: newTaskFields.assigned_to_email || null,
        estimated_hours: newTaskFields.estimated_hours === '' ? null : parseFloat(newTaskFields.estimated_hours),
        created_by: user.id
      }

      const { data, error: insErr } = await supabase.from('tasks').insert([payload]).select()
      if (insErr) throw insErr

      // add to local tasks
      setTasks(prev => [data[0], ...prev])

  // recalc and persist job total after adding task
  await recalcJobTotal(jobId)

  setAddingTaskFor(null)
  setNewTaskFields({ name: '', description: '', value: '', estimated_hours: '', assigned_to_email: '' })
    } catch (err) {
      console.error('Add task error', err)
      setError(err.message || 'Eroare la adăugare task')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>CEO Dashboard</h1>

      <section style={{ marginBottom: 20 }}>
        <h3>Creare job</h3>
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <button onClick={() => setShowCreateWithTasks(s => !s)}>{showCreateWithTasks ? 'Închide formular' : 'Creează job + taskuri'}</button>
              <div style={{ fontSize: 12, color: '#444' }}>Profiles: {profiles.length}</div>
              <button onClick={fetchProfiles} style={{ fontSize: 12 }}>Reîmprospătează profile</button>
            </div>

          {showCreateWithTasks && (
            <form onSubmit={handleCreateJob}>
              <div>
                <input placeholder="Job Name" value={jobname} onChange={e => setJobname(e.target.value)} required />
                <input placeholder="Client Name" value={clientname} onChange={e => setClientname(e.target.value)} required />
                <input type="email" placeholder="Client Email" value={clientemail} onChange={e => setClientemail(e.target.value)} />
                <div style={{ fontSize: 12, color: '#666' }}>Total: (calculated din taskuri)</div>
              </div>

              <div style={{ marginTop: 8, borderTop: '1px dashed #ddd', paddingTop: 8 }}>
                <h4>Taskuri pentru job</h4>
                {newJobTasks.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input placeholder="Nume task" value={t.name} onChange={e => updateNewJobTaskField(i, 'name', e.target.value)} required />
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input placeholder="Valoare" value={t.value} onChange={e => updateNewJobTaskField(i, 'value', sanitizeNumberInput(e.target.value))} style={{ width: 120 }} />
                      <span style={{ marginLeft: 6 }}>lei</span>
                    </div>
                    <input placeholder="Ore estimate" value={t.estimated_hours} onChange={e => updateNewJobTaskField(i, 'estimated_hours', sanitizeNumberInput(e.target.value))} style={{ width: 120 }} />
                    <input placeholder="Descriere" value={t.description} onChange={e => updateNewJobTaskField(i, 'description', e.target.value)} />
                    <select value={t.assigned_to_email || ''} onChange={e => updateNewJobTaskField(i, 'assigned_to_email', e.target.value)}>
                      <option value="">-- Asignează (email) --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.email}>{formatProfileLabel(p)}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeNewJobTaskRow(i)}>Șterge</button>
                  </div>
                ))}
                <div>
                  <button type="button" onClick={addNewJobTaskRow}>+ Adaugă task</button>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <button type="submit" disabled={loading}>{loading ? 'Se salvează...' : 'Creează job și taskuri'}</button>
              </div>
            </form>
          )}
        </div>
        {message && <p style={{ color: 'green' }}>{message}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </section>

      <section>
        <h3>Toate joburile</h3>
        {loading && <p>Loading...</p>}
        {!loading && jobs.length === 0 && <p>Nu există joburi.</p>}

        {jobs.map(job => (
          <div key={job.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{job.name}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>Client: {job.client_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>Total: {job.total_value != null ? `${job.total_value} lei` : '—'}</div>
                {job.status === 'completed' && (
                  <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                    Completed by: {displayUserLabel(job.completed_by)} at {job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}
                  </div>
                )}
              </div>
              <div>
                <button onClick={() => deleteJob(job.id)}>Șterge Job</button>
                <button onClick={() => toggleCompleteJob(job)} style={{ marginLeft: 8 }}>{job.status === 'completed' ? 'Reopen Job' : 'Complete Job'}</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>Taskuri</h4>
                <div>
                  <button onClick={() => startAddTask(job.id)}>+ Adaugă task</button>
                </div>
              </div>

              {/* add-task inline form */}
              {addingTaskFor === job.id && (
                <div style={{ marginTop: 8, padding: 8, border: '1px dashed #ccc' }}>
                  <div>
                    <input placeholder="Nume task" value={newTaskFields.name} onChange={e => handleNewTaskChange('name', e.target.value)} />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <input placeholder="Descriere" value={newTaskFields.description} onChange={e => handleNewTaskChange('description', e.target.value)} />
                  </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input placeholder="Valoare" value={newTaskFields.value} onChange={e => handleNewTaskChange('value', sanitizeNumberInput(e.target.value))} />
                      <span style={{ marginLeft: 6 }}>lei</span>
                      <input placeholder="Ore estimate" value={newTaskFields.estimated_hours} onChange={e => handleNewTaskChange('estimated_hours', sanitizeNumberInput(e.target.value))} style={{ marginLeft: 8 }} />
                      <select value={newTaskFields.assigned_to_email || ''} onChange={e => handleNewTaskChange('assigned_to_email', e.target.value)} style={{ marginLeft: 8 }}>
                        <option value="">-- Asignează (email) --</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.email}>{formatProfileLabel(p)}</option>
                        ))}
                      </select>
                      {profiles.length === 0 && (
                        <div style={{ fontSize: 12, color: '#a00', marginLeft: 8 }}>
                          Nu există profile. <button onClick={fetchProfiles} style={{ fontSize: 12, marginLeft: 6 }}>Reîmprospătează</button>
                        </div>
                      )}
                    </div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => submitAddTask(job.id)} disabled={loading}>Adaugă</button>
                    <button onClick={cancelAddTask} style={{ marginLeft: 8 }}>Anulează</button>
                  </div>
                </div>
              )}

              {(tasksByJob[job.id] || []).length === 0 && <div style={{ fontStyle: 'italic' }}>Niciun task</div>}
              {(tasksByJob[job.id] || []).map(task => (
                <div key={task.id} style={{ borderTop: '1px solid #eee', paddingTop: 8, paddingBottom: 8 }}>
                  {editingTaskId === task.id ? (
                    <div>
                      <input value={taskEdits.name} onChange={e => handleTaskChange('name', e.target.value)} />
                        <input value={taskEdits.value} placeholder="Value" onChange={e => handleTaskChange('value', sanitizeNumberInput(e.target.value))} style={{ marginLeft: 8 }} />
                        <input value={taskEdits.estimated_hours} placeholder="Estimated hours" onChange={e => handleTaskChange('estimated_hours', sanitizeNumberInput(e.target.value))} style={{ marginLeft: 8 }} />
                      <div style={{ marginTop: 6 }}>
                        <select value={taskEdits.status} onChange={e => handleTaskChange('status', e.target.value)}>
                          <option value="todo">todo</option>
                          <option value="completed">completed</option>
                        </select>
                        <select value={taskEdits.assigned_to_email || ''} onChange={e => handleTaskChange('assigned_to_email', e.target.value)} style={{ marginLeft: 8 }}>
                          <option value="">-- Asignează (email) --</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.email}>{formatProfileLabel(p)}</option>
                          ))}
                        </select>
                          {profiles.length === 0 && (
                            <div style={{ fontSize: 12, color: '#a00', marginLeft: 8 }}>
                              Nu există profile. <button onClick={fetchProfiles} style={{ fontSize: 12, marginLeft: 6 }}>Reîmprospătează</button>
                            </div>
                          )}
                        <button onClick={() => saveTask(task.id)} disabled={loading} style={{ marginLeft: 8 }}>Save</button>
                        <button onClick={cancelEdit} style={{ marginLeft: 8 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div><strong>{task.name}</strong></div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                        Value: {task.value != null ? `${task.value} lei` : '—'} • Status: {task.status}
                        {(task.assigned_to_email || task.assigned_to) && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#444' }}>
                            Assigned: {displayUserLabel(task.assigned_to_email || task.assigned_to)}
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#444' }}>
                            <span>
                              Done by: {task.completed_by ? displayUserLabel(task.completed_by) : (task.created_by ? displayUserLabel(task.created_by) : '—')} at {task.completed_at ? new Date(task.completed_at).toLocaleString() : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                      </div>
                        <div>
                          <label style={{ marginRight: 8 }}>
                            <input type="checkbox" checked={task.status === 'completed'} onChange={() => toggleComplete(task)} /> Done
                          </label>
                          <button onClick={() => startEdit(task)}>Editează</button>
                          <button onClick={() => deleteTask(task.id)} style={{ marginLeft: 8 }}>Șterge</button>
                        </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
