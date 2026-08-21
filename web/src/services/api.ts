import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

export const api = axios.create({
  baseURL: `${apiBase}/api/v1`,
  timeout: 10000,
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('polyorch_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('polyorch_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const endpoints = {
  projects: '/projects',
  projectVersions: (id: string) => `/projects/${encodeURIComponent(id)}/versions`,
  runs: '/runs',
  runLogs: (id: string) => `/runs/${encodeURIComponent(id)}/logs`,
} as const

export { apiBase, wsBase }
