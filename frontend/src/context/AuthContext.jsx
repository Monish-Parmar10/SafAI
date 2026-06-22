import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('safai_token');
    const savedUser = localStorage.getItem('safai_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, userToken) => {
    // Clear any previous user's cached data before setting new user
    localStorage.removeItem('safai_user_notifications');
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('safai_token', userToken);
    localStorage.setItem('safai_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('safai_token');
    localStorage.removeItem('safai_user');
    localStorage.removeItem('safai_user_notifications');
    localStorage.removeItem('safai_notifications_enabled');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
