import axios from 'axios';

// Foolproof URL parsing: handles whether you put /api at the end or not, trailing slashes, etc.
const rawEnvUrl = import.meta.env.VITE_API_URL || '';
const ROOT_URL = rawEnvUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
const BASE_URL = ROOT_URL + '/api';

const API = axios.create();

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('safai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const registerUser = (data) => API.post(`${BASE_URL}/auth/register`, data);
export const loginUser = (data) => API.post(`${BASE_URL}/auth/login`, data);
export const getMe = () => API.get(`${BASE_URL}/auth/me`);
export const submitReport = (formData) => API.post(`${BASE_URL}/reports`, formData);
export const getAllReports = () => API.get(`${BASE_URL}/reports`);
export const getStats = () => API.get(`${BASE_URL}/reports/stats`);
export const completeReport = (id, formData) => API.patch(`${BASE_URL}/reports/${id}/complete`, formData);
export const acceptReport = (id) => API.patch(`${BASE_URL}/reports/${id}/accept`);
export const getWorkers = () => API.get(`${BASE_URL}/workers`);

export default API;
