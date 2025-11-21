import React, { useEffect, useState } from 'react'
import supabase from '../supabase-client'
import { sendJobCompletionEmail, sendTaskCompletionEmail, areAllTasksCompleted } from '../emailService'
import './AdminDashboard.css'

export default function CEODashboard() {
  const [user, setUser] = useState(null)
  const [jobs, setJobs] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // Create job + tasks state
  const [showCreateWithTasks, setShowCreateWithTasks] = useState(false)
  const [jobname, setJobname] = useState('')
  const [clientname, setClientname] = useState('')
  const [clientemail, setClientemail] = useState('')
  const [jobPriority, setJobPriority] = useState('normal')
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName, setClientLastName] = useState('')
  const [clientIdSeries, setClientIdSeries] = useState('')
  const [clientCNP, setClientCNP] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [jobValue, setJobValue] = useState('')
  const [newJobTasks, setNewJobTasks] = useState([{ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' }])

  // Job/task UI state
  const [expandedJob, setExpandedJob] = useState(null)
  const [editingJobId, setEditingJobId] = useState(null)
  const [jobEdits, setJobEdits] = useState({})
  const [expandedTask, setExpandedTask] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskEdits, setTaskEdits] = useState({})
  const [addingTaskToJob, setAddingTaskToJob] = useState(null)
  const [newTaskData, setNewTaskData] = useState({ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' })

  // Employee management
  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState(null)
  const [profileEdits, setProfileEdits] = useState({})

  // Calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)
  const [reportMonth, setReportMonth] = useState(new Date())

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

      setJobs(jobsRes.data || [])
      setTasks(tasksRes.data || [])
      setProfiles(profilesRes.data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la încărcare date')
    } finally {
      setLoading(false)
    }
  }

  // Recalculate and update job total_value from tasks in DB
  const recalcJobTotal = async (jobId) => {
    try {
      const { data: jobTasks, error } = await supabase.from('tasks').select('value').eq('job_id', jobId)
      if (error) {
        console.error('Error fetching tasks for total calc', error)
        return
      }
      const total = (jobTasks || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
      const { error: updErr } = await supabase.from('jobs').update({ total_value: total }).eq('id', jobId)
      if (updErr) console.error('Error updating job total', updErr)
      // refresh local data for job
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, total_value: total } : j))
    } catch (err) {
      console.error('recalcJobTotal error', err)
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

  // Create job with tasks
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
        created_by: user?.id || null,
        total_value: jobValue ? parseFloat(jobValue) : 0
      }]).select()
      if (jobErr) throw jobErr

      const jobId = newJob[0].id
      const tasksToInsert = newJobTasks
        .filter(t => t.name && t.name.trim())
        .map(t => ({
          job_id: jobId,
          name: t.name,
          description: t.description || null,
          status: 'todo',
          assigned_to: Array.isArray(t.assigned_to) ? (t.assigned_to.length > 0 ? t.assigned_to : null) : (t.assigned_to ? [t.assigned_to] : null),
          assigned_to_emails: null,
          estimated_hours: t.estimated_hours ? parseFloat(t.estimated_hours) : null,
          value: t.value ? parseFloat(t.value) : null,
          created_by: user?.id || null
        }))

      if (tasksToInsert.length > 0) {
        // Safe insert with retry when DB still has scalar `assigned_to`.
        const attemptInsertTasks = async (rows) => {
          try {
            const { data, error } = await supabase.from('tasks').insert(rows)
            if (error) throw error
            return data
          } catch (err) {
            if (err?.message && err.message.includes('invalid input syntax for type uuid')) {
              const transformed = rows.map(r => ({ ...r, assigned_to: Array.isArray(r.assigned_to) && r.assigned_to.length > 0 ? r.assigned_to[0] : r.assigned_to }))
              const { data: retried, error: retryErr } = await supabase.from('tasks').insert(transformed)
              if (retryErr) throw retryErr
              return retried
            }
            throw err
          }
        }

        await attemptInsertTasks(tasksToInsert)
      }

      // If job value wasn't provided, set it to the sum of created tasks' values
      if (!jobValue || jobValue === '') {
        const sumTasks = (tasksToInsert || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
        if (sumTasks > 0) {
          await supabase.from('jobs').update({ total_value: sumTasks }).eq('id', jobId)
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, total_value: sumTasks } : j))
        }
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
      setJobValue('')
      setNewJobTasks([{ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' }])
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

  const addNewJobTask = () => setNewJobTasks(prev => [...prev, { name: '', description: '', assigned_to: [], estimated_hours: '', value: '' }])
  const removeNewJobTask = (idx) => setNewJobTasks(prev => prev.filter((_, i) => i !== idx))

  // Edit job
  const startEditJob = (job) => {
    setEditingJobId(job.id)
    setJobEdits({
      name: job.name,
      priority: job.priority || 'normal',
      client_name: job.client_name,
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
      if (jobEdits.total_value !== undefined) {
        updates.total_value = jobEdits.total_value !== '' && jobEdits.total_value != null ? parseFloat(jobEdits.total_value) : 0
      }
      if (jobEdits.client_first_name !== undefined) updates.client_first_name = jobEdits.client_first_name || null
      if (jobEdits.client_last_name !== undefined) updates.client_last_name = jobEdits.client_last_name || null
      if (jobEdits.priority !== undefined) updates.priority = jobEdits.priority || 'normal'
      if (jobEdits.client_id_series !== undefined) updates.client_id_series = jobEdits.client_id_series || null
      if (jobEdits.client_cnp !== undefined) updates.client_cnp = jobEdits.client_cnp || null
      if (jobEdits.client_address !== undefined) updates.client_address = jobEdits.client_address || null

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

  // Edit task
  const startEditTask = (task) => {
    setEditingTaskId(task.id)
    setTaskEdits({
      name: task.name,
      description: task.description || '',
      status: task.status,
      assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to : task.assigned_to ? [task.assigned_to] : [],
      estimated_hours: task.estimated_hours || '',
      value: task.value || ''
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
      if (taskEdits.assigned_to !== undefined) {
        updates.assigned_to = Array.isArray(taskEdits.assigned_to) ? (taskEdits.assigned_to.length > 0 ? taskEdits.assigned_to : null) : (taskEdits.assigned_to ? [taskEdits.assigned_to] : null)
        // keep scalar `assigned_to_email` for RLS/backward compatibility: use first assignee's email
        updates.assigned_to_email = updates.assigned_to && updates.assigned_to.length > 0 ? profiles.find(p => p.id === updates.assigned_to[0])?.email : null
      }
      if (taskEdits.estimated_hours !== undefined) {
        updates.estimated_hours = taskEdits.estimated_hours ? parseFloat(taskEdits.estimated_hours) : null
      }
      if (taskEdits.value !== undefined) {
        updates.value = taskEdits.value ? parseFloat(taskEdits.value) : null
      }

      // Try update; if DB rejects array for uuid, retry using first assignee
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
      setTasks(prev => prev.map(t => t.id === taskId ? data[0] : t))
      setEditingTaskId(null)
      setTaskEdits({})
      setMessage('✅ Task actualizat!')
      setTimeout(() => setMessage(null), 3000)
      // recalculate job total in case task.value changed
      if (data && data[0] && data[0].job_id) {
        recalcJobTotal(data[0].job_id)
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
      // capture job id before deletion
      const task = tasks.find(t => t.id === taskId)
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
      if (delErr) throw delErr
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setMessage('✅ Task șters!')
      setTimeout(() => setMessage(null), 3000)
      if (task && task.job_id) recalcJobTotal(task.job_id)
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
      completed_by: newStatus === 'completed' ? user?.email : null,
      completed_by_email: newStatus === 'completed' ? user?.email : null,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('tasks').update(updates).eq('id', task.id).select()
      if (err) throw err

      const updatedTasks = tasks.map(t => t.id === task.id ? data[0] : t)
      setTasks(updatedTasks)

      if (newStatus === 'completed') {
        // send job-completion email only when all tasks for the job are completed
        const job = jobs.find(j => j.id === task.job_id)
        if (job && job.client_email) {
          const allCompleted = areAllTasksCompleted(updatedTasks, task.job_id)
          if (allCompleted) {
            const jobTasks = updatedTasks.filter(t => t.job_id === task.job_id)
            const totalValue = (jobTasks || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
            const completedAt = new Date().toISOString()
            try {
              const { data: updatedJobArr, error: jobUpdErr } = await supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('id', job.id).select()
              if (jobUpdErr) throw jobUpdErr
              const updatedJob = (updatedJobArr && updatedJobArr[0]) ? updatedJobArr[0] : job
              const receptionNumber = updatedJob.reception_number || updatedJob.receptionNumber || null
              await sendJobCompletionEmail({
                to: job.client_email,
                clientName: job.client_name,
                jobName: job.name,
                tasks: jobTasks,
                totalValue,
                completedAt,
                clientFirstName: job.client_first_name,
                clientLastName: job.client_last_name,
                clientCNP: job.client_cnp,
                clientSeries: job.client_id_series,
                clientAddress: job.client_address,
                receptionNumber
              })
            } catch (err) {
              console.error('Failed to update job or send email', err)
            }
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare status')
    } finally {
      setLoading(false)
    }
  }

  // Add task to existing job
  const startAddTaskToJob = (jobId) => {
    setAddingTaskToJob(jobId)
    setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' })
  }

  const cancelAddTask = () => {
    setAddingTaskToJob(null)
    setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' })
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
        description: newTaskData.description || null,
        status: 'todo',
        assigned_to: assignedArr.length > 0 ? assignedArr : null,
        assigned_to_emails: null,
        estimated_hours: newTaskData.estimated_hours ? parseFloat(newTaskData.estimated_hours) : null,
        value: newTaskData.value ? parseFloat(newTaskData.value) : null,
        created_by: user?.id || null
      }
      const { error: addErr } = await supabase.from('tasks').insert([taskToInsert])
      if (addErr) throw addErr

      setNewTaskData({ name: '', description: '', assigned_to: [], estimated_hours: '', value: '' })
      setAddingTaskToJob(null)
      setMessage('✅ Task adăugat!')
      setTimeout(() => setMessage(null), 3000)
      // refresh data and recalc job total
      fetchData()
      recalcJobTotal(addingTaskToJob)
    } catch (err) {
      console.error('Add task error', err)
      setError(err.message || 'Eroare la adăugare task')
    } finally {
      setLoading(false)
    }
  }

  // Profiles management
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

      setProfiles(prev => prev.map(p => p.id === profileId ? (data && data[0]) || p : p))
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

  const setProfileRole = async (profileId, newRole) => {
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) return
    if (profile.email === 'overviewview8@gmail.com') {
      setError('❌ Nu poți schimba rolul contului CEO principal!')
      setTimeout(() => setError(null), 3000)
      return
    }
    if (!window.confirm(`Schimbi rolul lui ${profile.full_name || profile.email} la ${newRole}?`)) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: updErr } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId).select()
      if (updErr) {
        console.error('Supabase update error', updErr)
        throw updErr
      }

      if (data && data.length > 0) {
        setProfiles(prev => prev.map(p => p.id === profileId ? data[0] : p))
      } else {
        // fallback: re-fetch profiles to ensure UI shows server state
        await fetchProfiles()
      }

      setMessage('✅ Rol actualizat!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Error updating role:', err)
      if (err?.message && err.message.toLowerCase().includes('permission')) {
        setError('Eroare: permisiuni insuficiente. Folosește SQL Editor sau service_role key.')
      } else {
        setError(err.message || 'Eroare la actualizare rol')
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteProfile = async (profileId) => {
    const profile = profiles.find(p => p.id === profileId)
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

  // Calendar helpers
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

  const hasEventsOnDate = (date) => getTasksForDate(date).length > 0 || getJobsForDate(date).length > 0

  const navigateMonth = (direction) => setCurrentMonth(prev => { const newDate = new Date(prev); newDate.setMonth(newDate.getMonth() + direction); return newDate })

  const navigateReportMonth = (direction) => setReportMonth(prev => { const newDate = new Date(prev); newDate.setMonth(newDate.getMonth() + direction); return newDate })

  const computeMonthlyReport = (monthDate) => {
    const month = monthDate.getMonth()
    const year = monthDate.getFullYear()
    // Filter tasks completed in the given month
    const completedTasks = tasks.filter(t => t.completed_at).filter(t => {
      const d = new Date(t.completed_at)
      return d.getMonth() === month && d.getFullYear() === year
    })

    // Group by assigned_to. If a task has multiple assignees, count it under each assignee.
    const grouped = {}
    completedTasks.forEach(t => {
      const v = parseFloat(t.value) || 0
      if (Array.isArray(t.assigned_to) && t.assigned_to.length > 0) {
        t.assigned_to.forEach(pid => {
          if (!grouped[pid]) grouped[pid] = { tasks: [], totalValue: 0 }
          grouped[pid].tasks.push(t)
          grouped[pid].totalValue += v
        })
      } else if (t.assigned_to) {
        const key = t.assigned_to
        if (!grouped[key]) grouped[key] = { tasks: [], totalValue: 0 }
        grouped[key].tasks.push(t)
        grouped[key].totalValue += v
      } else {
        if (!grouped['unassigned']) grouped['unassigned'] = { tasks: [], totalValue: 0 }
        grouped['unassigned'].tasks.push(t)
        grouped['unassigned'].totalValue += v
      }
    })

    // Map to array with profile info
    const rows = Object.keys(grouped).map(key => {
      const profile = profiles.find(p => p.id === key)
      return {
        assigned_to: key === 'unassigned' ? null : key,
        profile: profile || null,
        tasks: grouped[key].tasks,
        totalValue: grouped[key].totalValue,
        count: grouped[key].tasks.length
      }
    })

    // Sort by totalValue desc
    rows.sort((a, b) => b.totalValue - a.totalValue)
    return { rows, overallTotal: rows.reduce((s, r) => s + r.totalValue, 0), totalTasks: completedTasks.length }
  }

  const renderMonthlyReport = () => {
    const monthNames = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
    const report = computeMonthlyReport(reportMonth)

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
        <div style={{ backgroundColor: 'white', border: '3px solid #2196F3', borderRadius: 12, padding: 20, width: '90%', maxWidth: 1000, maxHeight: '90vh', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => navigateReportMonth(-1)} style={{ fontSize: 18 }}>◀</button>
              <h2 style={{ margin: 0 }}>{monthNames[reportMonth.getMonth()]} {reportMonth.getFullYear()}</h2>
              <button onClick={() => navigateReportMonth(1)} style={{ fontSize: 18 }}>▶</button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 14 }}>Total taskuri finalizate: <strong>{report.totalTasks}</strong></div>
              <div style={{ fontSize: 14 }}>Valoare totală (lei): <strong>{report.overallTotal.toFixed(2)}</strong></div>
              <button onClick={() => { setShowMonthlyReport(false); setReportMonth(new Date()) }} style={{ background: '#f44336', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 6 }}> Închide </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {report.rows.length === 0 && (<div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>Nu s-au găsit taskuri finalizate în luna selectată.</div>)}
            {report.rows.map(row => (
              <div key={row.assigned_to || 'unassigned'} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{row.profile ? displayUserLabel(row.profile) : '(Neasignat)'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{row.count} taskuri finalizate</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.totalValue.toFixed(2)} lei</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #eee', paddingTop: 8 }}>
                  {row.tasks.map(t => {
                    const job = jobs.find(j => j.id === t.job_id)
                    return (
                      <div key={t.id} style={{ marginBottom: 8, fontSize: 13 }}>
                        <div><strong>{t.name}</strong> {job && (<span style={{ color: '#666' }}>— {job.name}</span>)}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>Valoare: { (parseFloat(t.value) || 0).toFixed(2) } lei • Finalizat: {new Date(t.completed_at).toLocaleString('ro-RO')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
    const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} style={{ padding: 8 }}></div>)
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
            <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, backgroundColor: '#ff9800', borderRadius: '50%' }}></div>
          )}
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
        <div style={{ backgroundColor: 'white', border: '3px solid #2196F3', borderRadius: 12, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxWidth: 600, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => navigateMonth(-1)} style={{ fontSize: 20, padding: '8px 16px' }}>◀ Prev</button>
            <h2 style={{ margin: 0, fontSize: 24, color: '#2196F3' }}>{monthNames[month]} {year}</h2>
            <button onClick={() => navigateMonth(1)} style={{ fontSize: 20, padding: '8px 16px' }}>Next ▶</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
            {dayNames.map(name => (<div key={name} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, padding: 8, color: '#666' }}>{name}</div>))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>{days}</div>

          {selectedDate && (
            <div style={{ marginTop: 24, borderTop: '2px solid #ddd', paddingTop: 20 }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#2196F3', fontSize: 18 }}>📅 {selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              {getJobsForDate(selectedDate).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: 16 }}>📋 Jobs ({getJobsForDate(selectedDate).length}):</strong>
                  {getJobsForDate(selectedDate).map(job => (<div key={job.id} style={{ fontSize: 14, marginLeft: 12, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 6, marginTop: 6, border: '1px solid #ddd' }}>• {job.name} - {job.client_name}</div>))}
                </div>
              )}

              {getTasksForDate(selectedDate).length > 0 && (
                <div>
                  <strong style={{ fontSize: 16 }}>✅ Tasks ({getTasksForDate(selectedDate).length}):</strong>
                  {getTasksForDate(selectedDate).map(task => { const job = jobs.find(j => j.id === task.job_id); return (<div key={task.id} style={{ fontSize: 14, marginLeft: 12, padding: 8, backgroundColor: task.status === 'completed' ? '#e8f5e9' : '#fff3e0', borderRadius: 6, marginTop: 6, border: '1px solid #ddd' }}>• {task.name} {job && `(${job.name})`} - <strong>{task.status}</strong></div>) })}
                </div>
              )}

              {getJobsForDate(selectedDate).length === 0 && getTasksForDate(selectedDate).length === 0 && (<p style={{ fontSize: 14, color: '#999', margin: 0, fontStyle: 'italic' }}>Nu sunt evenimente în această zi.</p>)}
            </div>
          )}

          <button onClick={() => { setShowCalendar(false); setSelectedDate(null) }} style={{ marginTop: 24, width: '100%', padding: '12px', fontSize: 16, backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>❌ Închide Calendar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0 }}>CEO Dashboard</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowCalendar(s => !s)} className="btn btn-primary" style={{ padding: '8px 12px', borderRadius: 6 }}>📅 Calendar</button>
          <button onClick={() => setShowMonthlyReport(s => !s)} className="btn btn-primary" style={{ padding: '8px 12px', borderRadius: 6 }}>📊 Raport lunar</button>
        </div>

        {showCalendar && renderCalendar()}
        {showMonthlyReport && renderMonthlyReport()}
      </div>

      <section style={{ marginBottom: 20 }}>
        <h3>Creare job</h3>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button onClick={() => setShowCreateWithTasks(s => !s)}>{showCreateWithTasks ? 'Închide formular' : 'Creează job + taskuri'}</button>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: profiles.length > 0 ? 'green' : 'red' }}>👥 Profiles: {profiles.length}</div>
            <button onClick={fetchProfiles} style={{ fontSize: 12 }}>🔄 Reîmprospătează profile</button>
            <button onClick={() => setShowEmployeeManagement(s => !s)} style={{ fontSize: 12, marginLeft: 'auto' }}>👥 {showEmployeeManagement ? 'Ascunde' : 'Gestionează'} Angajați</button>
            {profiles.length === 0 && (<span style={{ fontSize: 12, color: '#c00', marginLeft: 8 }}>⚠️ Nu sunt profile! Asigură-te că ai utilizatori înregistrați.</span>)}
          </div>

          {showEmployeeManagement && (
            <div style={{ marginTop: 16, padding: 16, border: '2px solid #4CAF50', borderRadius: 8, backgroundColor: '#f0f8f0' }}>
              <h3 style={{ marginTop: 0 }}>👥 Gestionare Angajați</h3>
              {profiles.length === 0 ? (<p style={{ color: '#c00' }}>Nu sunt angajați în baza de date.</p>) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(profiles || []).map(profile => (
                    <div key={profile?.id} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, backgroundColor: 'white' }}>
                      {editingProfileId === profile.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input type="email" placeholder="Email" value={profileEdits.email || ''} onChange={e => setProfileEdits(prev => ({ ...prev, email: e.target.value }))} style={{ flex: '1 1 200px', padding: 4 }} />
                          <input placeholder="Nume Complet" value={profileEdits.full_name || ''} onChange={e => setProfileEdits(prev => ({ ...prev, full_name: e.target.value }))} style={{ flex: '1 1 200px', padding: 4 }} />
                          <select value={profileEdits.role || 'employee'} onChange={e => setProfileEdits(prev => ({ ...prev, role: e.target.value }))} style={{ padding: 4 }}>
                            <option value="employee">Employee</option>
                            <option value="ceo">CEO</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => saveProfile(profile.id)} style={{ fontSize: 12, backgroundColor: '#4CAF50', color: 'white' }}>💾 Salvează</button>
                          <button onClick={cancelEditProfile} style={{ fontSize: 12, backgroundColor: '#999', color: 'white' }}>❌ Anulează</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{profile.full_name || '(Fără nume)'}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{profile.email}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>Rol: <span style={{ fontWeight: 'bold' }}>{profile.role}</span></div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEditProfile(profile)} style={{ fontSize: 12, backgroundColor: '#2196F3', color: 'white' }}>✏️ Editează</button>
                            {profile.email !== 'overviewview8@gmail.com' && (
                              <>
                                <button
                                  onClick={() => setProfileRole(profile.id, profile.role === 'admin' ? 'employee' : 'admin')}
                                  style={{ fontSize: 12, backgroundColor: profile.role === 'admin' ? '#FFA000' : '#4CAF50', color: 'white' }}
                                  title={profile.role === 'admin' ? 'Setează rol employee' : 'Promovează la admin'}
                                  disabled={loading}
                                >
                                  {profile.role === 'admin' ? '⬇️ Setează Angajat' : '⬆️ Promovează Admin'}
                                </button>
                                <button onClick={() => deleteProfile(profile.id)} style={{ fontSize: 12, backgroundColor: '#f44336', color: 'white' }}>🗑️ Șterge</button>
                              </>
                            )}
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
                  <input placeholder="Job Name" value={jobname} onChange={e => setJobname(e.target.value)} required style={{ flex: '1 1 auto' }} />
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
                <input type="number" placeholder="Valoare job (lei)" value={jobValue} onChange={e => setJobValue(e.target.value)} step="0.01" min="0" />
              </div>

              <div style={{ marginTop: 8, borderTop: '1px dashed #ddd', paddingTop: 8 }}>
                <h4>Taskuri pentru job</h4>
                        {newJobTasks.map((t, i) => (
                          <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', border: '1px solid #eee', padding: 8, borderRadius: 6, background: 'white' }}>
                            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
                              <input placeholder="Nume task" value={t.name} onChange={e => updateNewJobTaskField(i, 'name', e.target.value)} required style={{ width: '100%', marginBottom: 6, padding: 8 }} />
                              <textarea placeholder="Descriere" value={t.description || ''} onChange={e => updateNewJobTaskField(i, 'description', e.target.value)} style={{ width: '100%', marginBottom: 6, minHeight: 80, padding: 8 }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 12 }}>Ore:</label>
                                <input type="number" placeholder="Ore" value={t.estimated_hours} onChange={e => updateNewJobTaskField(i, 'estimated_hours', e.target.value)} style={{ width: 96, padding: 6 }} step="0.5" min="0" />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 12 }}>Valoare (lei):</label>
                                <input type="number" placeholder="Valoare" value={t.value} onChange={e => updateNewJobTaskField(i, 'value', e.target.value)} style={{ width: 120, padding: 6 }} step="0.01" min="0" />
                              </div>
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

              <div style={{ marginTop: 8 }}><button type="submit">Creează Job</button></div>
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
                  <input placeholder="Nume Job" value={jobEdits.name || ''} onChange={e => setJobEdits(prev => ({ ...prev, name: e.target.value }))} style={{ marginRight: 8 }} />
                  <input placeholder="Nume Client (full)" value={jobEdits.client_name || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_name: e.target.value }))} style={{ marginRight: 8 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input placeholder="Client Prenume" value={jobEdits.client_first_name || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_first_name: e.target.value }))} style={{ flex: '1 1 150px' }} />
                    <input placeholder="Client Nume" value={jobEdits.client_last_name || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_last_name: e.target.value }))} style={{ flex: '1 1 150px' }} />
                  </div>
                  <input placeholder="Serie buletin" value={jobEdits.client_id_series || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_id_series: e.target.value }))} style={{ marginTop: 6 }} />
                  <input placeholder="CNP" value={jobEdits.client_cnp || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_cnp: e.target.value }))} style={{ marginTop: 6 }} />
                  <input placeholder="Adresa" value={jobEdits.client_address || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_address: e.target.value }))} style={{ marginTop: 6 }} />
                  <input type="email" placeholder="Email Client" value={jobEdits.client_email || ''} onChange={e => setJobEdits(prev => ({ ...prev, client_email: e.target.value }))} style={{ marginRight: 8, marginTop: 6 }} />
                  <select value={jobEdits.priority || 'normal'} onChange={e => setJobEdits(prev => ({ ...prev, priority: e.target.value }))} style={{ marginRight: 8, marginTop: 6, padding: 6 }}>
                    <option value="normal">Normal</option>
                    <option value="repede">Repede</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input type="number" placeholder="Valoare job (lei)" value={jobEdits.total_value || ''} onChange={e => setJobEdits(prev => ({ ...prev, total_value: e.target.value }))} style={{ marginRight: 8, marginTop: 6 }} step="0.01" min="0" />
                  <select value={jobEdits.status || 'todo'} onChange={e => setJobEdits(prev => ({ ...prev, status: e.target.value }))} style={{ marginRight: 8, marginTop: 6 }}>
                    <option value="todo">Todo</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={() => saveJob(job.id)} style={{ marginRight: 4, fontSize: 12 }}>💾 Salvează</button>
                  <button onClick={cancelEditJob} style={{ fontSize: 12 }}>❌ Anulează</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{job.name}</strong>
                        <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, color: 'white', textTransform: 'capitalize', backgroundColor: job.priority === 'urgent' ? '#f44336' : job.priority === 'repede' ? '#FF9800' : '#607D8B' }}>{job.priority || 'normal'}</span>
                        <span style={{ color: '#666' }}> - {job.client_name} ({job.status})</span>
                      </div>
                    
                      <div style={{ fontSize: 12, color: '#333' }}>💰 Valoare job: {job.total_value != null ? parseFloat(job.total_value).toFixed(2) + ' lei' : 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>⏱️ Timp estimat: <strong>{formatDuration(totalHours)}</strong>{totalHours > 0 && ` → Estimare finalizare: ${formatEstimatedDate(totalHours)}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} style={{ fontSize: 12 }}>{isExpanded ? '🔼 Ascunde' : '🔽 Detalii'}</button>
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
                            <input placeholder="Nume Task" value={taskEdits.name || ''} onChange={e => setTaskEdits(prev => ({ ...prev, name: e.target.value }))} style={{ marginBottom: 4, width: '100%' }} />
                            <textarea placeholder="Descriere" value={taskEdits.description || ''} onChange={e => setTaskEdits(prev => ({ ...prev, description: e.target.value }))} style={{ marginBottom: 4, width: '100%' }} />
                            <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                              <label style={{ fontSize: 12 }}>Ore:</label>
                              <input type="number" placeholder="Ore estimate" value={taskEdits.estimated_hours || ''} onChange={e => setTaskEdits(prev => ({ ...prev, estimated_hours: e.target.value }))} style={{ width: 100 }} step="0.5" min="0" />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                              <label style={{ fontSize: 12 }}>Valoare (lei):</label>
                              <input type="number" placeholder="Valoare" value={taskEdits.value || ''} onChange={e => setTaskEdits(prev => ({ ...prev, value: e.target.value }))} style={{ width: 120 }} step="0.01" min="0" />
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 320px', minWidth: 220 }}>
                                <strong>{task.name}</strong> <span style={{ color: '#666' }}>({task.status})</span>
                                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                                  <div>Asignat: {assignedProfiles.length > 0 ? assignedProfiles.map(p => displayUserLabel(p)).join(', ') : '(Neasignat)'}</div>
                                  {task.estimated_hours && (<div>⏱️ {formatDuration(task.estimated_hours)} → {formatEstimatedDate(task.estimated_hours)}</div>)}
                                  {(task.value || task.value === 0) && (<div>💰 {task.value} lei</div>)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button onClick={() => setExpandedTask(isTaskExpanded ? null : task.id)} style={{ fontSize: 11 }}>{isTaskExpanded ? '🔼' : '🔽'}</button>
                                <button onClick={() => toggleComplete(task)} style={{ fontSize: 11 }}>{task.status === 'completed' ? '↩️ Undo' : '✅ Done'}</button>
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
                      <input placeholder="Nume task nou" value={newTaskData.name} onChange={e => setNewTaskData(prev => ({ ...prev, name: e.target.value }))} required style={{ marginBottom: 4, width: '100%' }} />
                      <textarea placeholder="Descriere" value={newTaskData.description || ''} onChange={e => setNewTaskData(prev => ({ ...prev, description: e.target.value }))} style={{ marginBottom: 8, width: '100%', minHeight: 80, padding: 8 }} />
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 12 }}>Ore:</label>
                          <input type="number" placeholder="Ore estimate" value={newTaskData.estimated_hours} onChange={e => setNewTaskData(prev => ({ ...prev, estimated_hours: e.target.value }))} style={{ width: 100, padding: 6 }} step="0.5" min="0" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 12 }}>Valoare (lei):</label>
                          <input type="number" placeholder="Valoare" value={newTaskData.value} onChange={e => setNewTaskData(prev => ({ ...prev, value: e.target.value }))} style={{ width: 120, padding: 6 }} step="0.01" min="0" />
                        </div>
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
