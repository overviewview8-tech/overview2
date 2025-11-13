import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase-client';

const ProtectedRoute = ({ children, allowedRole }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Pas 1: Verifică dacă e cineva logat
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          // Nimeni logat → înapoi la Login
          navigate('/');
          return;
        }

        // Pas 2: Ia rolul din profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        // Pas 3: Verifică dacă rolul corespunde
        if (profile && profile.role === allowedRole) {
          setIsAuthorized(true);
        } else {
          // Rolul nu corespunde → înapoi la Login
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, allowedRole]);

  // Arată loading în timp ce verifică
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Arată componenta doar dacă e autorizat
  return isAuthorized ? children : null;
};

export default ProtectedRoute;
