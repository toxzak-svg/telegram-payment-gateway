import axios from 'axios';

// Detect if we're in GitHub Codespaces and construct the API URL accordingly
function getApiBaseUrl(): string {
  // If explicitly set via env, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're in GitHub Codespaces forwarded URL
  const hostname = window.location.hostname;
  if (hostname.includes('.app.github.dev')) {
    // Replace the port in the hostname (5173 -> 3000)
    const apiHostname = hostname.replace('-5173.', '-3000.');
    return `${window.location.protocol}//${apiHostname}/api/v1`;
  }

  // Default to localhost
  return 'http://localhost:3000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('apiKey');
    if (token) {
      config.headers['x-api-key'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('apiKey');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
