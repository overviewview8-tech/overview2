import React, { useEffect, useState } from 'react'
import supabase from '../supabase-client'
import { sendJobCompletionEmail, sendTaskCompletionEmail, areAllTasksCompleted } from '../emailService'
import './EmployeeDashboard.css'

const EmployeeDashboard = () => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // Stare pentru job expandat
  const [expandedJob, setExpandedJob] = useState(null)

  // Stare pentru task expandat
  const [expandedTask, setExpandedTask] = useState(null)

  // Stare calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (u) {
        // Găsește profilul utilizatorului curent
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single()
        setUserProfile(profile)
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    if (userProfile) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobsRes, tasksRes, profilesRes] = await Promise.all([
        supabase.from('jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, email, full_name, role, created_at')
      ])
      
      console.log('🔧 Jobs Response:', jobsRes)
      console.log('🔧 Tasks Response:', tasksRes)
      
      if (jobsRes.error) {
        console.error('❌ Jobs Error:', jobsRes.error)
        throw jobsRes.error
      }
      if (tasksRes.error) {
        console.error('❌ Tasks Error:', tasksRes.error)
        throw tasksRes.error
      }
      if (profilesRes.error) {
        console.error('❌ Profiles Error:', profilesRes.error)
        throw profilesRes.error
      }

      console.log('👤 User Profile Email:', userProfile.email)
      console.log('📋 All Tasks:', tasksRes.data)
      console.log('🔍 Tasks assigned_to_email values:', tasksRes.data?.map(t => ({ id: t.id, name: t.name, assigned_to_email: t.assigned_to_email })))

      const profilesData = profilesRes.data || []

      // Normalize tasks: support both array columns and legacy scalar columns
      const allTasks = (tasksRes.data || []).map(t => {
        const assigned = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : [])
        const assignedEmails = Array.isArray(t.assigned_to_emails)
          ? t.assigned_to_emails
          : (t.assigned_to_email ? [t.assigned_to_email] : assigned.map(pid => (profilesData.find(p => p.id === pid) || {}).email).filter(Boolean))
        return { ...t, assigned_to: assigned, assigned_to_emails: assignedEmails }
      })

      // FILTRARE PENTRU EMPLOYEE:
      // 1. Găsește joburile unde are taskuri asignate SAU taskuri neasignate
      const myRelevantJobIds = [...new Set(
        allTasks
          .filter(t => (t.assigned_to_emails && t.assigned_to_emails.includes(userProfile.email)) || (t.assigned_to_emails && t.assigned_to_emails.length === 0))
          .map(t => t.job_id)
      )]
      
      console.log('🔑 My Relevant Job IDs:', myRelevantJobIds)
      
      // 2. Afișează acele joburi
      const myJobs = (jobsRes.data || []).filter(j => myRelevantJobIds.includes(j.id))
      
      // 3. Afișează TOATE taskurile din acele joburi (nu doar cele asignate lui)
      const myJobTasks = allTasks.filter(t => myRelevantJobIds.includes(t.job_id))
      
      console.log('📁 My Jobs:', myJobs.map(j => ({ id: j.id, name: j.name })))
      console.log('📋 All Tasks from DB:', allTasks.length)
      console.log('� Tasks in My Jobs:', myJobTasks.length)
      console.log('📋 Task details in My Jobs:', myJobTasks.map(t => ({ 
        name: t.name, 
        job_id: t.job_id, 
        assigned: t.assigned_to_email,
        isInRelevantJob: myRelevantJobIds.includes(t.job_id)
      })))

      setJobs(myJobs)
      setTasks(myJobTasks)
      setProfiles(profilesData || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la încărcare date')
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

  const toggleComplete = async (task) => {
    // Verifică dacă employee-ul poate completa acest task
    const assignedEmails = task.assigned_to_emails || []
    const canComplete = assignedEmails.length === 0 || assignedEmails.includes(userProfile.email)
    
    if (!canComplete) {
      setMessage('⚠️ Nu poți completa acest task - este asignat altcuiva!')
      setTimeout(() => setMessage(null), 3000)
      return
    }
    
    // Employee poate doar să marcheze ca completed, NU poate face undo
    if (task.status === 'completed') {
      return // Nu face nimic dacă task-ul e deja completat
    }

    const newStatus = 'completed'
    const updates = {
      status: newStatus,
      completed_by: user.email,
      completed_by_email: user.email,
      completed_at: new Date().toISOString()
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('tasks').update(updates).eq('id', task.id).select()
      if (err) throw err
      
      // Actualizează lista de task-uri
      const updatedTasks = tasks.map(t => t.id === task.id ? data[0] : t)
      setTasks(updatedTasks)

      // Decidează trimiterea email-ului: trimitem doar când toate taskurile
      // din job sunt completate (cerința: mailul se trimite numai la
      // finalizarea jobului, nu la fiecare task).
      const job = jobs.find(j => j.id === task.job_id)
      const jobTasks = updatedTasks.filter(t => t.job_id === task.job_id)
      const remainingTasks = jobTasks.filter(t => t.status !== 'completed').length

      if (remainingTasks === 0) {
        // Toate taskurile sunt completate — trimitem emailul de job
        if (job && job.client_email) {
          sendJobCompletionEmail({
            to: job.client_email,
            clientName: job.client_name,
            jobName: job.name,
            jobValue: job.total_value,
            completedAt: data[0].completed_at || new Date().toISOString(),
            clientFirstName: job.client_first_name,
            clientLastName: job.client_last_name,
            clientCNP: job.client_cnp,
            clientSeries: job.client_id_series,
            clientAddress: job.client_address
          }).then(res => {
            if (res && !res.ok) console.warn('⚠️ Job email failed', res)
          }).catch(err => console.error('Job email error', err))
        }
        // Mark job as completed in DB so UI and other roles see consistent state
        try {
          const completedAt = data[0].completed_at || new Date().toISOString()
          await supabase.from('jobs').update({ status: 'completed', completed_at: completedAt }).eq('id', job.id)
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', completed_at: completedAt } : j))
        } catch (updErr) {
          console.warn('Could not update job status to completed', updErr)
        }

        setMessage('✅ Task completat! 🎉 Jobul este finalizat!')
      } else {
        // Nu trimitem email la fiecare task — doar actualizăm mesajul UI
        setMessage(`✅ Task completat! (Mai sunt ${remainingTasks} task-uri în job)`)
      }
        setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Eroare la actualizare status')
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
    // Afișează TOATE taskurile din joburile relevante (unde are taskuri asignate sau neasignate)
    const myRelevantJobIds = [...new Set(
      tasks
        .filter(t => {
          const emails = Array.isArray(t.assigned_to_emails) ? t.assigned_to_emails : (t.assigned_to_email ? [t.assigned_to_email] : [])
          return emails.includes(userProfile?.email) || emails.length === 0
        })
        .map(t => t.job_id)
    )]
    
    return tasks.filter(task => {
      // Verifică dacă taskul este din joburile relevante
      if (!myRelevantJobIds.includes(task.job_id)) return false
      
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
    // Afișează doar joburile care au taskuri asignate utilizatorului sau neasignate
    const myRelevantJobIds = [...new Set(
      tasks
        .filter(t => {
          const emails = Array.isArray(t.assigned_to_emails) ? t.assigned_to_emails : (t.assigned_to_email ? [t.assigned_to_email] : [])
          return emails.includes(userProfile?.email) || emails.length === 0
        })
        .map(t => t.job_id)
    )]
    
    return jobs.filter(job => {
      // Verifică dacă jobul are taskuri relevante
      if (!myRelevantJobIds.includes(job.id)) return false
      
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

  const downloadPdfForJob = async (job) => {
    try {
      let assignedOrder = null
      try {
        const rpcRes = await supabase.rpc('assign_job_order', { p_job_id: job.id })
        if (rpcRes && rpcRes.data != null) {
          if (Array.isArray(rpcRes.data)) assignedOrder = rpcRes.data[0]
          else assignedOrder = rpcRes.data
        }
      } catch (rpcErr) {
        console.warn('assign_job_order RPC failed', rpcErr)
      }

      const jobTasks = tasks.filter(t => t.job_id === job.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const totalValue = (jobTasks || []).reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
      const pdfData = {
        template: 'blank',
        clientName: job.client_name,
        clientFirstName: job.client_first_name || null,
        clientLastName: job.client_last_name || null,
        clientCNP: job.client_cnp || null,
        clientSeries: job.client_id_series || null,
        clientAddress: job.client_address || null,
        clientEmail: job.client_email || null,
        jobName: job.name,
        tasks: jobTasks,
        totalValue,
        completedAt: job.completed_at || new Date().toISOString(),
        receptionNumber: job.reception_number || job.receptionNumber || null,
        orderNumber: assignedOrder != null ? assignedOrder : (job.order_number || null)
      }
      const { generateAndDownloadPdf } = await import('../utils/generatePdfClient')
      const res = await generateAndDownloadPdf(pdfData)
      if (!res || !res.ok) {
        setError(res && res.error ? res.error : 'Eroare generare PDF')
      }
    } catch (err) {
      console.error('downloadPdfForJob error', err)
      setError(err.message || 'Eroare la descarcare PDF')
    }
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Employee Dashboard</h1>
          <p>Bine ai venit, <strong>{userProfile?.full_name || userProfile?.email || 'Employee'}</strong>!</p>
        </div>
        <button onClick={() => setShowCalendar(s => !s)} className="btn btn-success">
          📅 Calendar
        </button>
        {showCalendar && renderCalendar()}
      </div>

      <div className="mb-16">
        <button onClick={fetchData} className="btn btn-secondary btn-small">🔄 Reîmprospătează taskuri</button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <section>
        <h3>Joburile mele ({jobs.length})</h3>
        {jobs.length === 0 ? (
          <p style={{ color: '#999' }}>Nu ai taskuri asignate momentan.</p>
        ) : (
          jobs.map((job, idx) => {
            const jobTasks = tasks.filter(t => t.job_id === job.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            console.log(`📊 Job "${job.name}" (${job.id}):`)
            console.log('  - Tasks in state:', tasks.length)
            console.log('  - Tasks for this job:', jobTasks.length)
            console.log('  - Task details:', jobTasks.map(t => ({ name: t.name, job_id: t.job_id, assigned: t.assigned_to_emails })))
            
            const totalHours = jobTasks.reduce((sum, t) => sum + (parseFloat(t.estimated_hours) || 0), 0)
            const isExpanded = expandedJob === job.id

            return (
              <div key={job.id} style={{ marginBottom: 16, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                        <strong>📁 {idx + 1}. {job.name}</strong> - {job.client_name} ({job.status})
                        
                        <div style={{ fontSize: 12, color: '#333' }}>💰 Valoare job: {job.total_value != null ? parseFloat(job.total_value).toFixed(2) + ' lei' : 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      ⏱️ Timp estimat: <strong>{formatDuration(totalHours)}</strong>
                      {totalHours > 0 && ` → Estimare finalizare: ${formatEstimatedDate(totalHours)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} style={{ fontSize: 12 }}>
                      {isExpanded ? '🔼 Ascunde' : '🔽 Detalii'}
                    </button>
                    {(job.status === 'completed' || areAllTasksCompleted(tasks, job.id)) && (
                      <button onClick={() => downloadPdfForJob(job)} style={{ fontSize: 12 }}>📄 Descarcă PDF</button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: '3px solid #4CAF50' }}>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                      <div>Client: {job.client_name}</div>
                      <div>Email Client: {job.client_email || 'N/A'}</div>
                      <div>Created at: {new Date(job.created_at).toLocaleString('ro-RO')}</div>
                    </div>

                    <h4 style={{ fontSize: 14, marginBottom: 8 }}>Taskuri ({jobTasks.length})</h4>
                    {jobTasks.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#999' }}>Nu sunt taskuri în acest job.</p>
                    ) : (
                      jobTasks.map(task => {
                      const isTaskExpanded = expandedTask === task.id
                      const assignedProfiles = (profiles || []).filter(p => Array.isArray(task.assigned_to) ? task.assigned_to.includes(p.id) : task.assigned_to === p.id)
                      const assignedLabels = assignedProfiles.length > 0 ? assignedProfiles.map(p => (p.full_name ? `${p.full_name} (${p.email})` : p.email)).join(', ') : '(Neasignat)'
                      const assignedEmails = task.assigned_to_emails || []
                      const canCompleteTask = assignedEmails.length === 0 || assignedEmails.includes(userProfile?.email)

                      return (
                        <div key={task.id} style={{ marginBottom: 8, padding: 8, border: '1px solid #ddd', borderRadius: 4, backgroundColor: task.status === 'completed' ? '#e8f5e9' : 'white' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: 13 }}>{task.name}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>
                                Status: <strong>{task.status}</strong> | Asignat: {assignedLabels}
                                {task.estimated_hours && (
                                  <span> | ⏱️ {formatDuration(task.estimated_hours)} → {formatEstimatedDate(task.estimated_hours)}</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setExpandedTask(isTaskExpanded ? null : task.id)} style={{ fontSize: 11 }}>
                                {isTaskExpanded ? '🔼' : '🔽'}
                              </button>
                              {task.status !== 'completed' && canCompleteTask && (
                                <button onClick={() => toggleComplete(task)} style={{ fontSize: 11 }}>
                                  ✅ Done
                                </button>
                              )}
                              {task.status !== 'completed' && !canCompleteTask && (
                                <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic', padding: '4px 8px' }}>
                                  🔒 Altcuiva
                                </span>
                              )}
                              {task.status === 'completed' && (
                                <span style={{ fontSize: 11, color: '#4CAF50', fontWeight: 'bold', padding: '4px 8px' }}>
                                  ✅ Completat
                                </span>
                              )}
                            </div>
                          </div>

                          {isTaskExpanded && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee', fontSize: 12, color: '#555' }}>
                              <div><strong>Descriere:</strong> {task.description || 'N/A'}</div>
                              {task.completed_by && (
                                <div style={{ marginTop: 4 }}>
                                  <strong>Completat de:</strong> {task.completed_by}
                                </div>
                              )}
                              {task.completed_at && (
                                <div style={{ marginTop: 4 }}>
                                  <strong>Completat la:</strong> {new Date(task.completed_at).toLocaleString('ro-RO')}
                                </div>
                              )}
                              <div style={{ marginTop: 4 }}>
                                <strong>Creat la:</strong> {new Date(task.created_at).toLocaleString('ro-RO')}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}

export default EmployeeDashboard
