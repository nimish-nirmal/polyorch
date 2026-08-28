import axios from 'axios'

const runtimeConfig = (typeof window !== 'undefined' && (window as any).POLYORCH_CONFIG) || {}
const apiBase = runtimeConfig.apiUrl || import.meta.env.VITE_API_URL || ''
const wsBase = runtimeConfig.wsUrl || import.meta.env.VITE_WS_URL || ''

const isStaticHost = typeof window !== 'undefined' &&
  (window.location.hostname.includes('github.io') ||
   window.location.hostname.includes('netlify.app') ||
   window.location.hostname.includes('vercel.app'))

const isDemo = runtimeConfig.demo === true || (runtimeConfig.demo === undefined && !apiBase && isStaticHost)

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
      // Stay inside the SPA's base path (vite base: /polyorch/). Redirecting to
      // bare '/login' would land outside the router basename and render blank.
      window.location.href = `${import.meta.env.BASE_URL}login`
    }
    return Promise.reject(error)
  }
)

export const endpoints = {
  projects: '/projects',
  projectVersions: (id: string) => `/projects/${encodeURIComponent(id)}/versions`,
  runs: '/runs',
  runLogs: (id: string) => `/runs/${encodeURIComponent(id)}/logs`,
  versionFiles: (projectId: string, versionId: string) => `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/files`,
  versionFile: (projectId: string, versionId: string, filename: string) => `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/files/${filename.split('/').map(encodeURIComponent).join('/')}`,
  updateVersionFile: (projectId: string, versionId: string, filename: string) => `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/files/${filename.split('/').map(encodeURIComponent).join('/')}`,
} as const

export { apiBase, wsBase, isDemo }
