import React from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../supabase-client'
import './Minimal.css'

const Signup = () => {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState(null)
  const [success, setSuccess] = React.useState(null)
  const [loading, setLoading] = React.useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validare password match
    if (password !== confirmPassword) {
      setError('Passwords do not match!')
      return
    }

    // Validare lungime password
    if (password.length < 6) {
      setError('Password must be at least 6 characters long!')
      return
    }

    setLoading(true)

    try {
      const result = await supabase.auth.signUp({
        email: email,
        password: password
      })

      if (result.error) {
        setError(result.error.message)
      } else {
        setSuccess("Account created successfully! Check your email for verification.")
        setTimeout(() => {
          navigate('/')
        }, 2000)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h2>Create Account</h2>
          <p>Join Overview and start managing your projects!</p>
        </div>

        {error && (
          <div className="auth-message error">
            {error}
          </div>
        )}

        {success && (
          <div className="auth-message success">
            {success}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSignUp}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input 
              id="email"
              className="form-input"
              type="email" 
              placeholder="your.email@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input 
              id="password"
              className="form-input"
              type="password" 
              placeholder="Minimum 6 characters" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input 
              id="confirmPassword"
              className="form-input"
              type="password" 
              placeholder="Re-enter your password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              disabled={loading}
            />
          </div>

          <button 
            className="auth-submit-btn" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account?</p>
          <button 
            className="auth-link-btn" 
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Login Here
          </button>
        </div>
      </div>
    </div>
  )
}

export default Signup
