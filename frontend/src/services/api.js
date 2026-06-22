import axios from 'axios';

// In production (Vercel), VITE_API_URL = https://your-app.onrender.com/api
// In development, falls back to '/api' which Vite proxies to localhost:5000
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const API = axios.create({ baseURL: BASE_URL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('safai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');
export const submitReport = (formData) => API.post('/reports', formData);
export const getAllReports = () => API.get('/reports');
export const getStats = () => API.get('/reports/stats');
export const completeReport = (id, formData) => API.patch(`/reports/${id}/complete`, formData);
export const acceptReport = (id) => API.patch(`/reports/${id}/accept`);
export const getWorkers = () => API.get('/workers');

export default API;
