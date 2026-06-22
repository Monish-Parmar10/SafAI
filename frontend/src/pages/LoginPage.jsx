import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loginUser, registerUser } from '../services/api';

function LoginPage() {
  const { login } = useAuth();
  
  // States
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('user'); // 'user' | 'worker'
  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    phone: '',
    ward: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password rules validation
  const hasMinLength = form.password.length >= 6;
  const hasNumber = /\d/.test(form.password);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        // Login flow
        if (!form.phone || !form.password) {
          throw new Error('Phone number and password are required');
        }
        const response = await loginUser({
          phone: form.phone,
          password: form.password
        });

        if (response.data.success) {
          const { user, token } = response.data;
          login(user, token);
          if (user.role === 'worker' || user.role === 'admin') {
            window.location.href = '/worker';
          } else {
            window.location.href = '/';
          }
        } else {
          throw new Error(response.data.message || 'Login failed');
        }
      } else {
        // Register flow
        if (!form.name || !form.password || !form.phone) {
          throw new Error('Name, Phone number, and Password are required');
        }
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!hasMinLength || !hasNumber) {
          throw new Error('Password does not meet requirements');
        }
        if (role === 'worker' && !form.ward) {
          throw new Error('Ward is required for Nagar Nigam Workers');
        }

        let response;
        if (role === 'worker') {
          response = await registerUser({
            name: form.name,
            phone: form.phone,
            ward: form.ward,
            password: form.password,
            role: 'worker'
          });
        } else {
          response = await registerUser({
            name: form.name,
            phone: form.phone,
            password: form.password,
            role: 'user'
          });
        }

        if (response.data.success) {
          const { user, token } = response.data;
          login(user, token);
          if (user.role === 'worker' || user.role === 'admin') {
            window.location.href = '/worker';
          } else {
            window.location.href = '/';
          }
        } else {
          throw new Error(response.data.message || 'Registration failed');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    setError('');
    setForm({
      name: '',
      password: '',
      confirmPassword: '',
      phone: '',
      ward: ''
    });
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
    setForm({
      name: '',
      password: '',
      confirmPassword: '',
      phone: '',
      ward: ''
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #C1440E 0%, #7A2508 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* Styles for dynamic interactions */}
      <style>{`
        .login-card {
          width: 100%;
          max-width: 420px;
          background: #FFFFFF;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .form-label {
          font-size: 11px;
          font-weight: 600;
          color: #5C5C6E;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
          text-transform: uppercase;
          display: block;
        }
        .form-input {
          width: 100%;
          border: 1.5px solid #E8E8ED;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 15px;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          outline: none;
          color: #1A1A1A;
        }
        .form-input:focus {
          border-color: #C1440E;
          box-shadow: 0 0 0 3px rgba(193, 68, 14, 0.1);
        }
        .submit-btn {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #C1440E, #A03608);
          color: #FFFFFF;
          border: none;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(193, 68, 14, 0.4);
          transition: all 0.2s ease;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(193, 68, 14, 0.55);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        .submit-btn:disabled {
          background: #E8E8ED;
          color: #9999AA;
          box-shadow: none;
          cursor: not-allowed;
        }
        .password-container {
          position: relative;
          width: 100%;
        }
        .password-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: none;
          cursor: pointer;
          color: #9999AA;
          font-size: 18px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .password-toggle:hover {
          color: #5C5C6E;
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          color: #9999AA;
          transition: all 0.2s ease;
          text-align: center;
        }
        .tab-btn.active {
          border-bottom: 2px solid #C1440E;
          color: #C1440E;
          font-weight: 600;
        }
        .pill-btn {
          flex: 1;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .pill-btn.active {
          background-color: #C1440E;
          color: #FFFFFF;
        }
        .pill-btn.inactive {
          background-color: #F7F7F8;
          color: #5C5C6E;
        }
        .pill-btn.inactive:hover {
          background-color: #E8E8ED;
        }
      `}</style>

      <div className="login-card">
        {/* Logo Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#C1440E',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '24px'
          }}>
            S
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1A1A1A' }}>SafAI</h1>
            <span style={{ fontSize: '13px', color: '#9999AA', fontWeight: 500 }}>Smart Garbage Management</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E8ED' }}>
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => toggleMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => toggleMode('register')}
          >
            Register
          </button>
        </div>

        {/* Role Selection (Only in registration mode) */}
        {mode === 'register' && (
          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#F7F7F8', padding: '4px', borderRadius: '24px' }}>
            <button
              type="button"
              className={`pill-btn ${role === 'user' ? 'active' : 'inactive'}`}
              onClick={() => handleRoleChange('user')}
            >
              👤 Citizen
            </button>
            <button
              type="button"
              className={`pill-btn ${role === 'worker' ? 'active' : 'inactive'}`}
              onClick={() => handleRoleChange('worker')}
            >
              🏗️ Worker
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="new-password" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name Field (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="name"
                required
                autoComplete="off"
                className="form-input"
                placeholder="Enter your name"
                value={form.name}
                onChange={handleInputChange}
              />
            </div>
          )}

          {/* Phone Field */}
          <div>
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              required
              pattern="[0-9]{10}"
              title="Phone number must be exactly 10 digits"
              autoComplete="off"
              className="form-input"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={handleInputChange}
            />
          </div>

          {/* Ward Field (Register Worker only) */}
          {mode === 'register' && role === 'worker' && (
            <div>
              <label className="form-label">Ward Number / Zone</label>
              <input
                type="text"
                name="ward"
                required
                autoComplete="off"
                className="form-input"
                placeholder="e.g. Ward 15, Zone 4"
                value={form.ward}
                onChange={handleInputChange}
              />
            </div>
          )}

          {/* Password Field */}
          <div>
            <label className="form-label">Password</label>
            <div className="password-container">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="new-password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleInputChange}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Password checklist (Register mode only) */}
            {mode === 'register' && form.password.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: hasMinLength ? '#1E8C45' : '#CC2222', transition: 'color 0.2s' }}>
                  {hasMinLength ? '✓' : '✗'} At least 6 characters
                </span>
                <span style={{ fontSize: '11px', color: hasNumber ? '#1E8C45' : '#CC2222', transition: 'color 0.2s' }}>
                  {hasNumber ? '✓' : '✗'} Contains a number
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password Field (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                required
                autoComplete="new-password"
                className="form-input"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleInputChange}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: '#FFE8E8',
              color: '#CC2222',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              border: '1px solid #FFD3D3',
              textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="submit-btn"
          >
            {loading ? '⏳ Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        {/* Switch Link */}
        <div style={{ textAlign: 'center', fontSize: '14px', color: '#5C5C6E' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <span
                style={{ color: '#C1440E', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => toggleMode('register')}
              >
                Register
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span
                style={{ color: '#C1440E', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => toggleMode('login')}
              >
                Login
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
