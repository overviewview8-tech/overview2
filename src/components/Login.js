import React from 'react'
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase-client';


const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();  // Oprește refresh-ul paginii
  
  try {
    // Pas 1: Autentifică user-ul
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;  // Dacă e eroare, sare la catch
    
    // Pas 2: Ia rolul din profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    
    // Pas 3: Redirecționează pe baza rolului
    if (profile.role === 'ceo') {
      navigate('/CEODashboard');
    } else if (profile.role === 'admin') {
      navigate('/AdminDashboard');
    } else if (profile.role === 'employee') {
      navigate('/EmployeeDashboard');
    }
    
  } catch (error) {
    setError(error.message);  // Afișează eroarea
  }
};

  return (
    <>
    <div>
      <h2>Login Component</h2>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
    <form onSubmit={handleLogin}>
      <input 
        type="email"
        value={email}                    // Ce afișează input-ul
        onChange={(e) => setEmail(e.target.value)}  // Când scrie userul
      />
      
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      
      <button type="submit">Login</button>
    </form>
    <button onClick={() => navigate('/Signup')}>Click Me</button>
    </>
  )
}

export default Login
