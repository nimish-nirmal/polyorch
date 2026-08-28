// Runtime configuration for PolyOrch frontend.
// This file is loaded before the React app starts.
// Modify apiUrl/wsUrl to point to your backend, then rebuild:
//   cd web && npm run build

// Leave empty for same-origin (Docker deployment where frontend
// and API are served from the same Go backend).
window.POLYORCH_CONFIG = window.POLYORCH_CONFIG || {
  apiUrl: '',
  wsUrl: ''
};
