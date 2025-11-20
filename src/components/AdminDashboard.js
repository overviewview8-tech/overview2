import React, { useEffect, useState } from 'react'
import supabase from '../supabase-client'
import { sendJobCompletionEmail, sendTaskCompletionEmail, areAllTasksCompleted } from '../emailService'
import './AdminDashboard.css'

const AdminDashboard = () => {
  const [user, setUser] = useState(null)
  const [jobs, setJobs] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // Stare pentru creare job + taskuri
  const [showCreateWithTasks, setShowCreateWithTasks] = useState(false)
  const [jobname, setJobname] = useState('')
  const [clientname, setClientname] = useState('')
  const [clientemail, setClientemail] = useState('')
  const [jobPriority, setJobPriority] = useState('normal')
  const [jobValue, setJobValue] = useState('')
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName, setClientLastName] = useState('')
  const [clientIdSeries, setClientIdSeries] = useState('')
  const [clientCNP, setClientCNP] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [newJobTasks, setNewJobTasks] = useState([{ name: '', description: '', assigned_to: [], estimated_hours: '' }])

  // Stare pentru job expandat
  const [expandedJob, setExpandedJob] = useState(null)
  const [editingJobId, setEditingJobId] = useState(null)
  const [jobEdits, setJobEdits] = useState({})

  // Stare pentru task expandat și editare
  const [expandedTask, setExpandedTask] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskEdits, setTaskEdits] = useState({})

  // Stare pentru adăugare task la job existent
  const [addingTaskToJob, setAddingTaskToJob] = useState(null)
  const [newTaskData, setNewTaskData] = useState({ name: '', description: '', assigned_to: [], estimated_hours: '' })

  // Stare gestionare angajați
  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState(null)
  const [profileEdits, setProfileEdits] = useState({})

  // Stare calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
    }
    getUser()
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobsRes, tasksRes, profilesRes] = await Promise.all([
        supabase.from('jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, email, full_name, role, created_at')
      ])
      if (jobsRes.error) throw jobsRes.error
      if (tasksRes.error) throw tasksRes.error
      if (profilesRes.error) throw profilesRes.error

      const profilesData = profilesRes.data || []

      // Normalize assigned_to to always be an array (DB might have scalar or array)
      const tasksNormalized = (tasksRes.data || []).map(t => {
        let assigned = []
        if (Array.isArray(t.assigned_to)) assigned = t.assigned_to
        else if (t.assigned_to) assigned = [t.assigned_to]
        const assignedEmails = Array.isArray(t.assigned_to_emails) ? t.assigned_to_emails : (t.assigned_to_email ? [t.assigned_to_email] : assigned.map(pid => (profilesData.find(p => p.id === pid) || {}).email).filter(Boolean))
        return { ...t, assigned_to: assigned, assigned_to_emails: assignedEmails }
      })

      setJobs(jobsRes.data || [])
      setTasks(tasksNormalized)
      setProfiles(profilesData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la încărcare date')
    } finally {
      setLoading(false)
    }
  }

  const fetchProfiles = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('profiles').select('id, email, full_name, role, created_at')
      if (err) throw err
      setProfiles(data || [])
      setMessage('✅ Profile reîmprospătate!')
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la încărcare profile')
    } finally {
      setLoading(false)
    }
  }

  // Helper pentru formatare utilizator
  const displayUserLabel = (profile) => {
    if (!profile) return '(Neasignat)'
    return profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email
  }

  // Multi-assign selector (checkbox list) to allow easy multi-selection
  const MultiAssignSelector = ({ profiles, selectedIds = [], onChange }) => {
    const toggle = (id) => {
      const curr = Array.isArray(selectedIds) ? [...selectedIds] : []
      const idx = curr.indexOf(id)
      if (idx === -1) curr.push(id)
      else curr.splice(idx, 1)
      onChange(curr)
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
        {(profiles || []).map(p => (
          <label key={p?.id} style={{ fontSize: 13 }}>
            <input type="checkbox" checked={Array.isArray(selectedIds) && selectedIds.includes(p.id)} onChange={() => toggle(p.id)} />{' '}
            {displayUserLabel(p)}
          </label>
        ))}
      </div>
    )
  }

  // Helper pentru durata estimată
  const formatDuration = (hours) => {
    if (!hours || hours <= 0) return '0h'
    const days = Math.floor(hours / 8)
    const remainingHours = hours % 8
    const minutes = Math.round((remainingHours % 1) * 60)
    const wholeHours = Math.floor(remainingHours)
    
    let result = ''
    if (days > 0) result += `${days}z `
    if (wholeHours > 0) result += `${wholeHours}h `
    if (minutes > 0) result += `${minutes}m`
    return result.trim() || '0h'
  }

  const calculateEstimatedDate = (hours) => {
    if (!hours || hours <= 0) return null
    const now = new Date()
    let workingHours = hours
    let currentDate = new Date(now)
    
    while (workingHours > 0) {
      const dayOfWeek = currentDate.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingHours -= 8
      }
      if (workingHours > 0) {
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    return currentDate
  }

  const formatEstimatedDate = (hours) => {
    const date = calculateEstimatedDate(hours)
    if (!date) return ''
    return date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Creare job cu taskuri
  const handleCreateJob = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const fullClientName = (clientFirstName || clientLastName) ? `${clientFirstName || ''} ${clientLastName || ''}`.trim() : clientname

      const { data: newJob, error: jobErr } = await supabase.from('jobs').insert([{
        name: jobname,
        priority: jobPriority || 'normal',
        client_name: fullClientName,
        client_first_name: clientFirstName || null,
        client_last_name: clientLastName || null,
        client_id_series: clientIdSeries || null,
        client_cnp: clientCNP || null,
        client_address: clientAddress || null,
        client_email: clientemail || null,
        status: 'todo',
        creator_id: user.id,
        total_value: 0
      }]).select()
      if (jobErr) throw jobErr

      const jobId = newJob[0].id
      const filteredTasks = newJobTasks.filter(t => t.name && t.name.trim())
      const tasksToInsert = filteredTasks.map(t => ({
        job_id: jobId,
        name: t.name,
        description: t.description || null,
        status: 'todo',
        // write assigned_to as array (Admin selects multiple)
        assigned_to: Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []),
        // keep assigned_to_emails null for DB (can be populated by a trigger or later job)
        assigned_to_emails: null,
        estimated_hours: t.estimated_hours ? parseFloat(t.estimated_hours) : null,
        value: null,
        creator_id: user.id
      }))

      // Safe insert: try inserting as-is (with arrays). If the DB still
      // has a scalar `assigned_to` column, Postgres may return a 22P02
      // invalid-input error (array sent to uuid). In that case, retry
      // by sending only the first assignee (backwards-compatible).
      const attemptInsertTasks = async (rows) => {
        try {
          const { data: insertedTasks, error: tasksErr } = await supabase.from('tasks').insert(rows).select()
          if (tasksErr) throw tasksErr
          return insertedTasks
        } catch (err) {
          // detect Postgres UUID array mismatch error
          if (err?.message && err.message.includes('invalid input syntax for type uuid')) {
            const transformed = rows.map(r => ({ ...r, assigned_to: Array.isArray(r.assigned_to) && r.assigned_to.length > 0 ? r.assigned_to[0] : r.assigned_to }))
            const { data: retried, error: retryErr } = await supabase.from('tasks').insert(transformed).select()
            if (retryErr) throw retryErr
            return retried
          }
          throw err
        }
      }

      if (tasksToInsert.length > 0) {
        await attemptInsertTasks(tasksToInsert)
      }

      setJobname('')
      setClientname('')
      setJobPriority('normal')
      setClientFirstName('')
      setClientLastName('')
      setClientIdSeries('')
      setClientCNP('')
      setClientAddress('')
      setClientemail('')
      setNewJobTasks([{ name: '', description: '', assigned_to: [], estimated_hours: '' }])
      setShowCreateWithTasks(false)
      setMessage('✅ Job și taskuri create!')
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la creare job')
    } finally {
      setLoading(false)
    }
  }

  const updateNewJobTaskField = (idx, field, value) => {
    setNewJobTasks(prev => {
      const copy = [...prev]
      copy[idx][field] = value
      return copy
    })
  }

  const addNewJobTask = () => {
    setNewJobTasks(prev => [...prev, { name: '', description: '', assigned_to: [], estimated_hours: '' }])
  }

  const removeNewJobTask = (idx) => {
    setNewJobTasks(prev => prev.filter((_, i) => i !== idx))
  }

  // Editare job
  const startEditJob = (job) => {
    setEditingJobId(job.id)
    setJobEdits({
      name: job.name,
      priority: job.priority || 'normal',
      client_name: job.client_name || '',
      client_first_name: job.client_first_name || '',
      client_last_name: job.client_last_name || '',
      client_id_series: job.client_id_series || '',
      client_cnp: job.client_cnp || '',
      client_address: job.client_address || '',
      client_email: job.client_email || '',
      status: job.status,
      total_value: job.total_value != null ? job.total_value : ''
    })
  }

  const cancelEditJob = () => {
    setEditingJobId(null)
    setJobEdits({})
  }

  const saveJob = async (jobId) => {
    setLoading(true)
    setError(null)
    try {
      const updates = {}
      if (jobEdits.name !== undefined) updates.name = jobEdits.name
      if (jobEdits.client_name !== undefined) updates.client_name = jobEdits.client_name
      if (jobEdits.client_email !== undefined) updates.client_email = jobEdits.client_email || null
      if (jobEdits.status !== undefined) updates.status = jobEdits.status
      /* Admin is not allowed to manually edit job total here; total_value is
         calculated from task values and updated automatically. */
      if (jobEdits.client_first_name !== undefined) updates.client_first_name = jobEdits.client_first_name || null
      if (jobEdits.client_last_name !== undefined) updates.client_last_name = jobEdits.client_last_name || null
      if (jobEdits.priority !== undefined) updates.priority = jobEdits.priority || 'normal'
      if (jobEdits.client_id_series !== undefined) updates.client_id_series = jobEdits.client_id_series || null
      if (jobEdits.client_cnp !== undefined) updates.client_cnp = jobEdits.client_cnp || null
      if (jobEdits.client_address !== undefined) updates.client_address = jobEdits.client_address || null
      // job-level description removed; task-level descriptions are used instead

      const { data, error: updErr } = await supabase.from('jobs').update(updates).eq('id', jobId).select()
      if (updErr) throw updErr
      setJobs(prev => prev.map(j => j.id === jobId ? data[0] : j))
      setEditingJobId(null)
      setJobEdits({})
      setMessage('✅ Job actualizat!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare job')
    } finally {
      setLoading(false)
    }
  }

  const deleteJob = async (jobId) => {
    if (!window.confirm('Sigur vrei să ștergi acest job? Toate taskurile asociate vor fi șterse!')) return
    setLoading(true)
    setError(null)
    try {
      await supabase.from('tasks').delete().eq('job_id', jobId)
      const { error: delErr } = await supabase.from('jobs').delete().eq('id', jobId)
      if (delErr) throw delErr
      setJobs(prev => prev.filter(j => j.id !== jobId))
      setTasks(prev => prev.filter(t => t.job_id !== jobId))
      setMessage('✅ Job șters!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la ștergere job')
    } finally {
      setLoading(false)
    }
  }

  // Editare task
  const startEditTask = (task) => {
    setEditingTaskId(task.id)
    setTaskEdits({
      name: task.name,
      description: task.description || '',
      status: task.status,
      assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to : task.assigned_to ? [task.assigned_to] : [],
      estimated_hours: task.estimated_hours || ''
    })
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setTaskEdits({})
  }

  const saveTask = async (taskId) => {
    setLoading(true)
    setError(null)
    try {
      const updates = {}
      if (taskEdits.name !== undefined) updates.name = taskEdits.name
      if (taskEdits.description !== undefined) updates.description = taskEdits.description
      if (taskEdits.status !== undefined) updates.status = taskEdits.status
      // assignments are stored in tasks.assigned_to array column; include them in updates
      if (taskEdits.assigned_to !== undefined) {
        updates.assigned_to = Array.isArray(taskEdits.assigned_to) ? taskEdits.assigned_to : taskEdits.assigned_to ? [taskEdits.assigned_to] : []
      }
      if (taskEdits.estimated_hours !== undefined) {
        updates.estimated_hours = taskEdits.estimated_hours ? parseFloat(taskEdits.estimated_hours) : null
      }

      // Try update, if DB expects scalar uuid for `assigned_to` and errors,
      // retry with first element to remain compatible until migration runs.
      let data
      try {
        const res = await supabase.from('tasks').update(updates).eq('id', taskId).select()
        if (res.error) throw res.error
        data = res.data
      } catch (err) {
        if (err?.message && err.message.includes('invalid input syntax for type uuid')) {
          const backCompat = { ...updates }
          if (Array.isArray(backCompat.assigned_to)) backCompat.assigned_to = backCompat.assigned_to.length > 0 ? backCompat.assigned_to[0] : null
          const res2 = await supabase.from('tasks').update(backCompat).eq('id', taskId).select()
          if (res2.error) throw res2.error
          data = res2.data
        } else {
          throw err
        }
      }
      const { data: refreshedArr, error: refErr } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      if (refErr) throw refErr
      const refreshedTask = refreshedArr
      const assignedIds = Array.isArray(refreshedTask.assigned_to) ? refreshedTask.assigned_to : (refreshedTask.assigned_to ? [refreshedTask.assigned_to] : [])
      const assignedEmails = assignedIds.map(pid => (profiles.find(p => p.id === pid) || {}).email).filter(Boolean)
      const newTaskObj = { ...refreshedTask, assigned_to: assignedIds, assigned_to_emails: assignedEmails }
      setTasks(prev => prev.map(t => t.id === taskId ? newTaskObj : t))
      setEditingTaskId(null)
      setTaskEdits({})
      setMessage('✅ Task actualizat!')
      setTimeout(() => setMessage(null), 3000)
      // recalc job total in case task value changed
      if (data && data[0] && data[0].job_id) {
        const jobId = data[0].job_id
        const { data: jobTasks, error } = await supabase.from('tasks').select('value').eq('job_id', jobId)
        if (!error) {
          const total = (jobTasks || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
          await supabase.from('jobs').update({ total_value: total }).eq('id', jobId)
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, total_value: total } : j))
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare task')
    } finally {
      setLoading(false)
    }
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Sigur vrei să ștergi acest task?')) return
    setLoading(true)
    setError(null)
    try {
      const task = tasks.find(t => t.id === taskId)
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
      if (delErr) throw delErr
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setMessage('✅ Task șters!')
      setTimeout(() => setMessage(null), 3000)
      if (task && task.job_id) {
        // recalc job total
        const { data: jobTasks, error } = await supabase.from('tasks').select('value').eq('job_id', task.job_id)
        if (!error) {
          const total = (jobTasks || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
          await supabase.from('jobs').update({ total_value: total }).eq('id', task.job_id)
          setJobs(prev => prev.map(j => j.id === task.job_id ? { ...j, total_value: total } : j))
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la ștergere task')
    } finally {
      setLoading(false)
    }
  }

  const toggleComplete = async (task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    const updates = {
      status: newStatus,
      completed_by: newStatus === 'completed' ? user.email : null,
      completed_by_email: newStatus === 'completed' ? user.email : null,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('tasks').update(updates).eq('id', task.id).select()
      if (err) throw err
      
      // Actualizează lista de task-uri
      const updatedTasks = tasks.map(t => t.id === task.id ? data[0] : t)
      setTasks(updatedTasks)
      
      // Dacă e completat, trimite email single-task către client (dacă există)
      if (newStatus === 'completed') {
        const job = jobs.find(j => j.id === task.job_id)
        if (job && job.client_email) {
          const updatedTask = updatedTasks.find(t => t.id === task.id) || task
          sendTaskCompletionEmail({
            to: job.client_email,
            clientName: job.client_name,
            jobName: job.name,
            taskName: updatedTask.name,
            taskDescription: updatedTask.description,
            taskValue: updatedTask.value,
            completedAt: updatedTask.completed_at || new Date().toISOString()
          }).then(res => {
            if (res && !res.ok) console.warn('⚠️ Task email failed', res)
          }).catch(err => console.error('Task email error', err))
        }

        // NOTE: Only single-task completion email is sent. Sending a
        // job-completion email as well produced duplicate notifications
        // for clients — keep it simple and send only the per-task email.
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare status')
    } finally {
      setLoading(false)
    }
  }

  // Adăugare task la job existent
  const startAddTaskToJob = (jobId) => {
    setAddingTaskToJob(jobId)
    setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '' })
  }

  const cancelAddTask = () => {
    setAddingTaskToJob(null)
    setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '' })
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const assignedArr = Array.isArray(newTaskData.assigned_to) ? newTaskData.assigned_to : newTaskData.assigned_to ? [newTaskData.assigned_to] : []
      const taskToInsert = {
        job_id: addingTaskToJob,
        name: newTaskData.name,
        status: 'todo',
        description: newTaskData.description || null,
        assigned_to: assignedArr.length > 0 ? assignedArr : null,
        assigned_to_emails: null,
        estimated_hours: newTaskData.estimated_hours ? parseFloat(newTaskData.estimated_hours) : null,
        value: null,
        creator_id: user.id
      }
      // Insert with same safe-retry logic as bulk insert
      try {
        const { data: inserted, error: addErr } = await supabase.from('tasks').insert([taskToInsert]).select()
        if (addErr) throw addErr
      } catch (err) {
        if (err?.message && err.message.includes('invalid input syntax for type uuid')) {
          const transformed = { ...taskToInsert, assigned_to: Array.isArray(taskToInsert.assigned_to) && taskToInsert.assigned_to.length > 0 ? taskToInsert.assigned_to[0] : taskToInsert.assigned_to }
          const { data: retried, error: retryErr } = await supabase.from('tasks').insert([transformed]).select()
          if (retryErr) throw retryErr
        } else {
          throw err
        }
      }

      setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '' })
      setAddingTaskToJob(null)
      setMessage('✅ Task adăugat!')
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (err) {
      console.error('Add task error', err)
      setError(err.message || 'Eroare la adăugare task')
    } finally {
      setLoading(false)
    }
  }

  // Gestionare angajați (profiles)
  const startEditProfile = (profile) => {
    setEditingProfileId(profile.id)
    setProfileEdits({
      email: profile.email || '',
      full_name: profile.full_name || '',
      role: profile.role || 'employee'
    })
  }

  const cancelEditProfile = () => {
    setEditingProfileId(null)
    setProfileEdits({})
  }

  const saveProfile = async (profileId) => {
    setLoading(true)
    setError(null)
    try {
      const updates = {}
      if (profileEdits.email !== undefined) updates.email = profileEdits.email
      if (profileEdits.full_name !== undefined) updates.full_name = profileEdits.full_name
      if (profileEdits.role !== undefined) updates.role = profileEdits.role

      const { data, error: updErr } = await supabase.from('profiles').update(updates).eq('id', profileId).select()
      if (updErr) throw updErr

      setProfiles(prev => prev.map(p => p.id === profileId ? data[0] : p))
      setEditingProfileId(null)
      setProfileEdits({})
      setMessage('✅ Profil actualizat cu succes!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare profil')
    } finally {
      setLoading(false)
    }
  }

  const deleteProfile = async (profileId) => {
    const profile = profiles.find(p => p.id === profileId)

    // Protejează contul CEO principal
    if (profile?.email === 'overviewview8@gmail.com') {
      setError('❌ Nu poți șterge contul CEO principal!')
      setTimeout(() => setError(null), 3000)
      return
    }

    if (!window.confirm('Sigur vrei să ștergi acest angajat? Această acțiune este ireversibilă!')) return

    setLoading(true)
    setError(null)
    try {
      const { error: delErr } = await supabase.from('profiles').delete().eq('id', profileId)
      if (delErr) throw delErr

      setProfiles(prev => prev.filter(p => p.id !== profileId))
      setMessage('✅ Angajat șters cu succes!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la ștergere angajat')
    } finally {
      setLoading(false)
    }
  }

  // Funcții calendar
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getTasksForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return tasks.filter(task => {
      if (task.completed_at) {
        const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
        if (completedDate === dateStr) return true
      }
      if (task.created_at) {
        const createdDate = new Date(task.created_at).toISOString().split('T')[0]
        if (createdDate === dateStr) return true
      }
      if (task.estimated_hours) {
        const estimatedDate = calculateEstimatedDate(task.estimated_hours)
        if (estimatedDate && estimatedDate.toISOString().split('T')[0] === dateStr) return true
      }
      return false
    })
  }

  const getJobsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return jobs.filter(job => {
      if (job.completed_at) {
        const completedDate = new Date(job.completed_at).toISOString().split('T')[0]
        if (completedDate === dateStr) return true
      }
      if (job.created_at) {
        const createdDate = new Date(job.created_at).toISOString().split('T')[0]
        if (createdDate === dateStr) return true
      }
      return false
    })
  }

  const hasEventsOnDate = (date) => {
    return getTasksForDate(date).length > 0 || getJobsForDate(date).length > 0
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + direction)
      return newDate
    })
  }

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
    const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
    
    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: 8 }}></div>)
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const hasEvents = hasEventsOnDate(date)
      const isToday = new Date().toDateString() === date.toDateString()
      const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString()
      
      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          style={{
            padding: 16,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#2196F3' : isToday ? '#e3f2fd' : hasEvents ? '#fff3e0' : 'transparent',
            color: isSelected ? 'white' : isToday ? '#1976d2' : 'black',
            fontWeight: isToday || hasEvents ? 'bold' : 'normal',
            fontSize: 16,
            borderRadius: 8,
            position: 'relative',
            border: hasEvents ? '3px solid #ff9800' : isToday ? '3px solid #2196F3' : '1px solid #eee',
            minHeight: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {day}
          {hasEvents && !isSelected && (
            <div style={{
              position: 'absolute',
              bottom: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 8,
              height: 8,
              backgroundColor: '#ff9800',
              borderRadius: '50%'
            }}></div>
          )}
        </div>
      )
    }
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '3px solid #2196F3',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => navigateMonth(-1)} style={{ fontSize: 20, padding: '8px 16px' }}>◀ Prev</button>
            <h2 style={{ margin: 0, fontSize: 24, color: '#2196F3' }}>{monthNames[month]} {year}</h2>
            <button onClick={() => navigateMonth(1)} style={{ fontSize: 20, padding: '8px 16px' }}>Next ▶</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
            {dayNames.map(name => (
              <div key={name} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, padding: 8, color: '#666' }}>
                {name}
              </div>
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {days}
          </div>
          
          {selectedDate && (
            <div style={{ marginTop: 24, borderTop: '2px solid #ddd', paddingTop: 20 }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#2196F3', fontSize: 18 }}>
                📅 {selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              
              {getJobsForDate(selectedDate).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: 16 }}>📋 Jobs ({getJobsForDate(selectedDate).length}):</strong>
                  {getJobsForDate(selectedDate).map(job => (
                    <div key={job.id} style={{ fontSize: 14, marginLeft: 12, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 6, marginTop: 6, border: '1px solid #ddd' }}>
                      • {job.name} - {job.client_name}
                    </div>
                  ))}
                </div>
              )}
              
              {getTasksForDate(selectedDate).length > 0 && (
                <div>
                  <strong style={{ fontSize: 16 }}>✅ Tasks ({getTasksForDate(selectedDate).length}):</strong>
                  {getTasksForDate(selectedDate).map(task => {
                    const job = jobs.find(j => j.id === task.job_id)
                    return (
                      <div key={task.id} style={{ fontSize: 14, marginLeft: 12, padding: 8, backgroundColor: task.status === 'completed' ? '#e8f5e9' : '#fff3e0', borderRadius: 6, marginTop: 6, border: '1px solid #ddd' }}>
                        • {task.name} {job && `(${job.name})`} - <strong>{task.status}</strong>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {getJobsForDate(selectedDate).length === 0 && getTasksForDate(selectedDate).length === 0 && (
                <p style={{ fontSize: 14, color: '#999', margin: 0, fontStyle: 'italic' }}>Nu sunt evenimente în această zi.</p>
              )}
            </div>
          )}
          
          <button 
            onClick={() => { setShowCalendar(false); setSelectedDate(null) }} 
            style={{ 
              marginTop: 24, 
              width: '100%', 
              padding: '12px', 
              fontSize: 16, 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ❌ Închide Calendar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
        </div>
        <button onClick={() => setShowCalendar(s => !s)} className="btn btn-primary">
          📅 Calendar
        </button>
        {showCalendar && renderCalendar()}
      </div>

      <section style={{ marginBottom: 20 }}>
        <h3>Creare job</h3>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button onClick={() => setShowCreateWithTasks(s => !s)}>{showCreateWithTasks ? 'Închide formular' : 'Creează job + taskuri'}</button>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: profiles.length > 0 ? 'green' : 'red' }}>
              👥 Profiles: {profiles.length}
            </div>
            <button onClick={fetchProfiles} style={{ fontSize: 12 }}>🔄 Reîmprospătează profile</button>
            <button onClick={() => setShowEmployeeManagement(s => !s)} style={{ fontSize: 12, marginLeft: 'auto' }}>
              👥 {showEmployeeManagement ? 'Ascunde' : 'Gestionează'} Angajați
            </button>
            {profiles.length === 0 && (
              <span style={{ fontSize: 12, color: '#c00', marginLeft: 8 }}>
                ⚠️ Nu sunt profile! Asigură-te că ai utilizatori înregistrați.
              </span>
            )}
          </div>

          {showEmployeeManagement && (
            <div style={{
              marginTop: 16,
              padding: 16,
              border: '2px solid #4CAF50',
              borderRadius: 8,
              backgroundColor: '#f0f8f0'
            }}>
              <h3 style={{ marginTop: 0 }}>👥 Gestionare Angajați</h3>
              {profiles.length === 0 ? (
                <p style={{ color: '#c00' }}>Nu sunt angajați în baza de date.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {profiles.map(profile => (
                    <div key={profile.id} style={{
                      padding: 12,
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      backgroundColor: 'white'
                    }}>
                      {editingProfileId === profile.id ? (
                        // Mod editare
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="email"
                            placeholder="Email"
                            value={profileEdits.email || ''}
                            onChange={e => setProfileEdits(prev => ({ ...prev, email: e.target.value }))}
                            style={{ flex: '1 1 200px', padding: 4 }}
                          />
                          <input
                            placeholder="Nume Complet"
                            value={profileEdits.full_name || ''}
                            onChange={e => setProfileEdits(prev => ({ ...prev, full_name: e.target.value }))}
                            style={{ flex: '1 1 200px', padding: 4 }}
                          />
                          <select
                            value={profileEdits.role || 'employee'}
                            onChange={e => setProfileEdits(prev => ({ ...prev, role: e.target.value }))}
                            style={{ padding: 4 }}
                          >
                            <option value="employee">Employee</option>
                            <option value="ceo">CEO</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => saveProfile(profile.id)} style={{ fontSize: 12, backgroundColor: '#4CAF50', color: 'white' }}>
                            💾 Salvează
                          </button>
                          <button onClick={cancelEditProfile} style={{ fontSize: 12, backgroundColor: '#999', color: 'white' }}>
                            ❌ Anulează
                          </button>
                        </div>
                      ) : (
                        // Mod afișare
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{profile.full_name || '(Fără nume)'}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{profile.email}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              Rol: <span style={{ fontWeight: 'bold' }}>{profile.role}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEditProfile(profile)} style={{ fontSize: 12, backgroundColor: '#2196F3', color: 'white' }}>
                              ✏️ Editează
                            </button>
                            <button onClick={() => deleteProfile(profile.id)} style={{ fontSize: 12, backgroundColor: '#f44336', color: 'white' }}>
                              🗑️ Șterge
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showCreateWithTasks && (
            <form onSubmit={handleCreateJob}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Job Name" value={jobname} onChange={e => setJobname(e.target.value)} required />
                  <select value={jobPriority} onChange={e => setJobPriority(e.target.value)} style={{ padding: 6 }}>
                    <option value="normal">Normal</option>
                    <option value="repede">Repede</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input placeholder="Client Name (full)" value={clientname} onChange={e => setClientname(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input placeholder="Client Prenume" value={clientFirstName} onChange={e => setClientFirstName(e.target.value)} style={{ flex: '1 1 150px' }} />
                  <input placeholder="Client Nume" value={clientLastName} onChange={e => setClientLastName(e.target.value)} style={{ flex: '1 1 150px' }} />
                </div>
                <input placeholder="Serie buletin" value={clientIdSeries} onChange={e => setClientIdSeries(e.target.value)} style={{ marginTop: 6 }} />
                <input placeholder="CNP" value={clientCNP} onChange={e => setClientCNP(e.target.value)} style={{ marginTop: 6 }} />
                <input placeholder="Adresa" value={clientAddress} onChange={e => setClientAddress(e.target.value)} style={{ marginTop: 6 }} />
                <input type="email" placeholder="Client Email" value={clientemail} onChange={e => setClientemail(e.target.value)} />
                {/* Job value is managed automatically from task values; hidden in Admin UI */}
              </div>

              <div style={{ marginTop: 8, borderTop: '1px dashed #ddd', paddingTop: 8 }}>
                <h4>Taskuri pentru job</h4>
                {newJobTasks.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', border: '1px solid #eee', padding: 8, borderRadius: 6, background: 'white' }}>
                    <div style={{ flex: '1 1 320px', minWidth: 260 }}>
                      <input placeholder="Nume task" value={t.name} onChange={e => updateNewJobTaskField(i, 'name', e.target.value)} required style={{ width: '100%', marginBottom: 6, padding: 8 }} />
                      <textarea placeholder="Descriere" value={t.description || ''} onChange={e => updateNewJobTaskField(i, 'description', e.target.value)} style={{ width: '100%', marginBottom: 6, minHeight: 80, padding: 8 }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 12 }}>Ore:</label>
                        <input type="number" placeholder="Ore" value={t.estimated_hours} onChange={e => updateNewJobTaskField(i, 'estimated_hours', e.target.value)} style={{ width: 96, padding: 6 }} step="0.5" min="0" />
                      </div>
                      {/* Admin should not set task value; values are managed from CEO or task calculations */}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                      <MultiAssignSelector profiles={profiles} selectedIds={t.assigned_to || []} onChange={v => updateNewJobTaskField(i, 'assigned_to', v)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => removeNewJobTask(i)} style={{ fontSize: 12, color: 'red' }}>Șterge</button>
                        <button type="button" onClick={addNewJobTask} style={{ fontSize: 12 }}>+ Adaugă task</button>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addNewJobTask} style={{ fontSize: 12 }}>+ Adaugă task</button>
              </div>

              <div style={{ marginTop: 8 }}>
                <button type="submit">Creează Job</button>
              </div>
            </form>
          )}
        </div>
      </section>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <section>
        <h3>Joburi ({jobs.length})</h3>
        {jobs.map(job => {
          const jobTasks = tasks.filter(t => t.job_id === job.id)
          const totalHours = jobTasks.reduce((sum, t) => sum + (parseFloat(t.estimated_hours) || 0), 0)
          const isExpanded = expandedJob === job.id
          const isEditing = editingJobId === job.id

          return (
            <div key={job.id} style={{ marginBottom: 16, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}>
              {isEditing ? (
                <div style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Nume Job"
                    value={jobEdits.name || ''}
                    onChange={e => setJobEdits(prev => ({ ...prev, name: e.target.value }))}
                    style={{ marginRight: 8 }}
                  />
                  <input
                    placeholder="Nume Client (full)"
                    value={jobEdits.client_name || ''}
                    onChange={e => setJobEdits(prev => ({ ...prev, client_name: e.target.value }))}
                    style={{ marginRight: 8 }}
                  />
                  
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input placeholder="Client Prenume" value={jobEdits.client_first_name || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_first_name: e.target.value }))} style={{ flex: '1 1 150px' }} />
                    <input placeholder="Client Nume" value={jobEdits.client_last_name || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_last_name: e.target.value }))} style={{ flex: '1 1 150px' }} />
                  </div>
                  <input placeholder="Serie buletin" value={jobEdits.client_id_series || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_id_series: e.target.value }))} style={{ marginTop: 6 }} />
                  <input placeholder="CNP" value={jobEdits.client_cnp || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_cnp: e.target.value }))} style={{ marginTop: 6 }} />
                  <input placeholder="Adresa" value={jobEdits.client_address || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_address: e.target.value }))} style={{ marginTop: 6 }} />
                  <input
                    type="email"
                    placeholder="Email Client"
                    value={jobEdits.client_email || ''}
                    onChange={e => setJobEdits(prev => ({ ...prev, client_email: e.target.value }))}
                    style={{ marginRight: 8 }}
                  />
                  <select value={jobEdits.priority || 'normal'} onChange={e => setJobEdits(prev => ({ ...prev, priority: e.target.value }))} style={{ marginRight: 8 }}>
                    <option value="normal">Normal</option>
                    <option value="repede">Repede</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  {/* Admin cannot manually edit job total; it's calculated from task values */}
                  <select value={jobEdits.status || 'todo'} onChange={e => setJobEdits(prev => ({ ...prev, status: e.target.value }))} style={{ marginRight: 8 }}>
                    <option value="todo">Todo</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={() => saveJob(job.id)} style={{ marginRight: 4, fontSize: 12 }}>💾 Salvează</button>
                  <button onClick={cancelEditJob} style={{ fontSize: 12 }}>❌ Anulează</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong>{job.name}</strong> - {job.client_name} ({job.status})
                    
                    <div style={{ fontSize: 11, color: '#666' }}>
                      ⏱️ Timp estimat: <strong>{formatDuration(totalHours)}</strong>
                      {totalHours > 0 && ` → Estimare finalizare: ${formatEstimatedDate(totalHours)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} style={{ fontSize: 12 }}>
                      {isExpanded ? '🔼 Ascunde' : '🔽 Detalii'}
                    </button>
                    <button onClick={() => startEditJob(job)} style={{ fontSize: 12 }}>✏️ Editează</button>
                    <button onClick={() => deleteJob(job.id)} style={{ fontSize: 12, color: 'red' }}>🗑️ Șterge</button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: '3px solid #4CAF50' }}>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                    <div>Client Email: {job.client_email || 'N/A'}</div>
                    <div>Created at: {new Date(job.created_at).toLocaleString('ro-RO')}</div>
                  </div>

                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Taskuri ({jobTasks.length})</h4>
                  {jobTasks.map(task => {
                    const isTaskExpanded = expandedTask === task.id
                    const isTaskEditing = editingTaskId === task.id
                    const assignedProfiles = (profiles || []).filter(p => Array.isArray(task.assigned_to) ? task.assigned_to.includes(p.id) : task.assigned_to === p.id)

                    return (
                      <div key={task.id} style={{ marginBottom: 8, padding: 8, border: '1px solid #ddd', borderRadius: 4, backgroundColor: task.status === 'completed' ? '#e8f5e9' : 'white' }}>
                        {isTaskEditing ? (
                          <div>
                            <input
                              placeholder="Nume Task"
                              value={taskEdits.name || ''}
                              onChange={e => setTaskEdits(prev => ({ ...prev, name: e.target.value }))}
                              style={{ marginBottom: 4, width: '100%' }}
                            />
                            <textarea
                              placeholder="Descriere"
                              value={taskEdits.description || ''}
                              onChange={e => setTaskEdits(prev => ({ ...prev, description: e.target.value }))}
                              style={{ marginBottom: 4, width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                              <label style={{ fontSize: 12 }}>Ore:</label>
                              <input
                                type="number"
                                placeholder="Ore estimate"
                                value={taskEdits.estimated_hours || ''}
                                onChange={e => setTaskEdits(prev => ({ ...prev, estimated_hours: e.target.value }))}
                                style={{ width: 100 }}
                                step="0.5"
                                min="0"
                              />
                            </div>
                            <select value={taskEdits.status || 'todo'} onChange={e => setTaskEdits(prev => ({ ...prev, status: e.target.value }))} style={{ marginRight: 8 }}>
                              <option value="todo">Todo</option>
                              <option value="completed">Completed</option>
                            </select>
                            <div style={{ marginRight: 8 }}>
                              <MultiAssignSelector profiles={profiles} selectedIds={taskEdits.assigned_to || []} onChange={v => setTaskEdits(prev => ({ ...prev, assigned_to: v }))} />
                            </div>
                            <button onClick={() => saveTask(task.id)} style={{ fontSize: 11, marginRight: 4 }}>💾 Salvează</button>
                            <button onClick={cancelEditTask} style={{ fontSize: 11 }}>❌ Anulează</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong>{task.name}</strong> ({task.status})
                                <div style={{ fontSize: 11, color: '#666' }}>
                                  Asignat: {assignedProfiles.length > 0 ? assignedProfiles.map(p => displayUserLabel(p)).join(', ') : '(Neasignat)'}
                                  {task.estimated_hours && (
                                    <span> | ⏱️ {formatDuration(task.estimated_hours)} → {formatEstimatedDate(task.estimated_hours)}</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => setExpandedTask(isTaskExpanded ? null : task.id)} style={{ fontSize: 11 }}>
                                  {isTaskExpanded ? '🔼' : '🔽'}
                                </button>
                                <button onClick={() => toggleComplete(task)} style={{ fontSize: 11 }}>
                                  {task.status === 'completed' ? '↩️ Undo' : '✅ Done'}
                                </button>
                                <button onClick={() => startEditTask(task)} style={{ fontSize: 11 }}>✏️</button>
                                <button onClick={() => deleteTask(task.id)} style={{ fontSize: 11, color: 'red' }}>🗑️</button>
                              </div>
                            </div>

                            {isTaskExpanded && (
                              <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                                <div>Descriere: {task.description || 'N/A'}</div>
                                {task.completed_by && <div>Done by: {task.completed_by}</div>}
                                {task.completed_at && <div>Completed at: {new Date(task.completed_at).toLocaleString('ro-RO')}</div>}
                                <div>Created at: {new Date(task.created_at).toLocaleString('ro-RO')}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {addingTaskToJob === job.id ? (
                    <form onSubmit={handleAddTask} style={{ marginTop: 8, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                      <input
                        placeholder="Nume task nou"
                        value={newTaskData.name}
                        onChange={e => setNewTaskData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        style={{ marginBottom: 4, width: '100%' }}
                      />
                      <textarea placeholder="Descriere" value={newTaskData.description || ''} onChange={e => setNewTaskData(prev => ({ ...prev, description: e.target.value }))} style={{ marginBottom: 8, width: '100%', minHeight: 80, padding: 8 }} />
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 12 }}>Ore:</label>
                          <input type="number" placeholder="Ore estimate" value={newTaskData.estimated_hours} onChange={e => setNewTaskData(prev => ({ ...prev, estimated_hours: e.target.value }))} style={{ width: 100, padding: 6 }} step="0.5" min="0" />
                        </div>
                        {/* Admin cannot set task value here */}
                        <div>
                              <MultiAssignSelector profiles={profiles} selectedIds={newTaskData.assigned_to || []} onChange={v => setNewTaskData(prev => ({ ...prev, assigned_to: v }))} />
                        </div>
                      </div>
                      <button type="submit" style={{ fontSize: 11, marginRight: 4 }}>➕ Adaugă</button>
                      <button type="button" onClick={cancelAddTask} style={{ fontSize: 11 }}>Anulează</button>
                    </form>
                  ) : (
                    <button onClick={() => startAddTaskToJob(job.id)} style={{ fontSize: 11, marginTop: 8 }}>➕ Adaugă task nou</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

export default AdminDashboard
