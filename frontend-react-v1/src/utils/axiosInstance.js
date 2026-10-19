import axios from 'axios';

export const API_URL = import.meta.env.MODE === "development" 
    ? "http://localhost:4000/api" 
    : "/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Allows sending cookies along with requests
});

// Response interceptor for automatic token refresh
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If a 401 (Unauthorized) error occurs, attempt to refresh the token,
    // but only if we haven't already retried this request.
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // We use the plain axios here (not axiosInstance) to avoid looping interceptors.
        await axios.post(`${API_URL}/auth/refresh-token`, {}, { withCredentials: true });
        // Retry the original request after refreshing the token.
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed:", refreshError);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
