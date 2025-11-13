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
  const [newJobTasks, setNewJobTasks] = useState([{ name: '', assigned_to: '', estimated_hours: '' }])

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
  const [newTaskData, setNewTaskData] = useState({ name: '', assigned_to: '', estimated_hours: '' })

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
      const { data: newJob, error: jobErr } = await supabase.from('jobs').insert([{
        name: jobname,
        client_name: clientname,
        client_email: clientemail || null,
        status: 'todo',
        created_by: user.id,
        total_value: 0
      }]).select()
      if (jobErr) throw jobErr

      const jobId = newJob[0].id
      const tasksToInsert = newJobTasks
        .filter(t => t.name.trim())
        .map(t => ({
          job_id: jobId,
          name: t.name,
          status: 'todo',
          assigned_to: t.assigned_to || null,
          assigned_to_email: t.assigned_to ? profiles.find(p => p.id === t.assigned_to)?.email : null,
          estimated_hours: t.estimated_hours ? parseFloat(t.estimated_hours) : null,
          created_by: user.id
        }))

      if (tasksToInsert.length > 0) {
        const { error: tasksErr } = await supabase.from('tasks').insert(tasksToInsert)
        if (tasksErr) throw tasksErr
      }

      setJobname('')
      setClientname('')
      setClientemail('')
      setNewJobTasks([{ name: '', assigned_to: '', estimated_hours: '' }])
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
    setNewJobTasks(prev => [...prev, { name: '', assigned_to: '', estimated_hours: '' }])
  }

  const removeNewJobTask = (idx) => {
    setNewJobTasks(prev => prev.filter((_, i) => i !== idx))
  }

  // Editare job
  const startEditJob = (job) => {
    setEditingJobId(job.id)
    setJobEdits({ name: job.name, client_name: job.client_name, client_email: job.client_email || '', status: job.status })
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
      assigned_to: task.assigned_to || '',
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
      if (taskEdits.assigned_to !== undefined) {
        updates.assigned_to = taskEdits.assigned_to || null
        updates.assigned_to_email = taskEdits.assigned_to ? profiles.find(p => p.id === taskEdits.assigned_to)?.email : null
      }
      if (taskEdits.estimated_hours !== undefined) {
        updates.estimated_hours = taskEdits.estimated_hours ? parseFloat(taskEdits.estimated_hours) : null
      }

      const { data, error: updErr } = await supabase.from('tasks').update(updates).eq('id', taskId).select()
      if (updErr) throw updErr
      setTasks(prev => prev.map(t => t.id === taskId ? data[0] : t))
      setEditingTaskId(null)
      setTaskEdits({})
      setMessage('✅ Task actualizat!')
      setTimeout(() => setMessage(null), 3000)
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
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
      if (delErr) throw delErr
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setMessage('✅ Task șters!')
      setTimeout(() => setMessage(null), 3000)
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
      
      // Verifică dacă toate task-urile job-ului sunt completate
      if (newStatus === 'completed') {
        // send single-task completion email to client (if present)
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

        // Verifică dacă toate task-urile job-ului sunt completate
        const allCompleted = areAllTasksCompleted(updatedTasks, task.job_id)
        if (allCompleted) {
          if (job && job.client_email) {
            console.log('🎉 Toate task-urile sunt completate! Trimit job-completion email...')
            const jobTasks = updatedTasks.filter(t => t.job_id === task.job_id)
            const emailData = {
              to: job.client_email,
              clientName: job.client_name,
              jobName: job.name,
              tasks: jobTasks,
              totalValue: job.total_value,
              completedAt: new Date().toISOString()
            }
            sendJobCompletionEmail(emailData).then(res => {
              if (res && !res.ok) console.warn('⚠️ Job completion email failed', res)
            }).catch(err => console.error('Job email error', err))
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

  // Adăugare task la job existent
  const startAddTaskToJob = (jobId) => {
    setAddingTaskToJob(jobId)
    setNewTaskData({ name: '', assigned_to: '', estimated_hours: '' })
  }

  const cancelAddTask = () => {
    setAddingTaskToJob(null)
    setNewTaskData({ name: '', assigned_to: '', estimated_hours: '' })
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const taskToInsert = {
        job_id: addingTaskToJob,
        name: newTaskData.name,
        status: 'todo',
        assigned_to: newTaskData.assigned_to || null,
        assigned_to_email: newTaskData.assigned_to ? profiles.find(p => p.id === newTaskData.assigned_to)?.email : null,
        estimated_hours: newTaskData.estimated_hours ? parseFloat(newTaskData.estimated_hours) : null,
        created_by: user.id
      }
      const { error: addErr } = await supabase.from('tasks').insert([taskToInsert])
      if (addErr) throw addErr

      setNewTaskData({ name: '', assigned_to: '', estimated_hours: '' })
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
                <input placeholder="Job Name" value={jobname} onChange={e => setJobname(e.target.value)} required />
                <input placeholder="Client Name" value={clientname} onChange={e => setClientname(e.target.value)} required />
                <input type="email" placeholder="Client Email" value={clientemail} onChange={e => setClientemail(e.target.value)} />
              </div>

              <div style={{ marginTop: 8, borderTop: '1px dashed #ddd', paddingTop: 8 }}>
                <h4>Taskuri pentru job</h4>
                {newJobTasks.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input placeholder="Nume task" value={t.name} onChange={e => updateNewJobTaskField(i, 'name', e.target.value)} required />
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ fontSize: 12, marginRight: 4 }}>Ore:</label>
                      <input
                        type="number"
                        placeholder="Ore"
                        value={t.estimated_hours}
                        onChange={e => updateNewJobTaskField(i, 'estimated_hours', e.target.value)}
                        style={{ width: 80 }}
                        step="0.5"
                        min="0"
                      />
                    </div>
                    <select value={t.assigned_to} onChange={e => updateNewJobTaskField(i, 'assigned_to', e.target.value)}>
                      <option value="">Neasignat</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{displayUserLabel(p)}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeNewJobTask(i)} style={{ fontSize: 12, color: 'red' }}>Șterge</button>
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
                    placeholder="Nume Client"
                    value={jobEdits.client_name || ''}
                    onChange={e => setJobEdits(prev => ({ ...prev, client_name: e.target.value }))}
                    style={{ marginRight: 8 }}
                  />
                  <input
                    type="email"
                    placeholder="Email Client"
                    value={jobEdits.client_email || ''}
                    onChange={e => setJobEdits(prev => ({ ...prev, client_email: e.target.value }))}
                    style={{ marginRight: 8 }}
                  />
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
                    const assignedProfile = profiles.find(p => p.id === task.assigned_to)

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
                            <select value={taskEdits.assigned_to || ''} onChange={e => setTaskEdits(prev => ({ ...prev, assigned_to: e.target.value }))} style={{ marginRight: 8 }}>
                              <option value="">Neasignat</option>
                              {profiles.map(p => (
                                <option key={p.id} value={p.id}>{displayUserLabel(p)}</option>
                              ))}
                            </select>
                            <button onClick={() => saveTask(task.id)} style={{ fontSize: 11, marginRight: 4 }}>💾 Salvează</button>
                            <button onClick={cancelEditTask} style={{ fontSize: 11 }}>❌ Anulează</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong>{task.name}</strong> ({task.status})
                                <div style={{ fontSize: 11, color: '#666' }}>
                                  Asignat: {displayUserLabel(assignedProfile)}
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
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                        <label style={{ fontSize: 12 }}>Ore:</label>
                        <input
                          type="number"
                          placeholder="Ore estimate"
                          value={newTaskData.estimated_hours}
                          onChange={e => setNewTaskData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                          style={{ width: 100 }}
                          step="0.5"
                          min="0"
                        />
                      </div>
                      <select value={newTaskData.assigned_to} onChange={e => setNewTaskData(prev => ({ ...prev, assigned_to: e.target.value }))} style={{ marginRight: 8 }}>
                        <option value="">Neasignat</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{displayUserLabel(p)}</option>
                        ))}
                      </select>
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
