import axios from "axios";

let accessToken = localStorage.getItem("autoshorts_access_token") || null;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("autoshorts_access_token", token);
  } else {
    localStorage.removeItem("autoshorts_access_token");
  }
};

export const getAccessToken = () => accessToken;

const api = axios.create({
  baseURL: "",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthExclude = originalRequest.url?.includes("/api/auth/login") ||
                          originalRequest.url?.includes("/api/auth/register") ||
                          originalRequest.url?.includes("/api/auth/signup") ||
                          originalRequest.url?.includes("/api/auth/refresh") ||
                          originalRequest.url?.includes("/api/auth/logout") ||
                          originalRequest.url?.includes("/api/auth/google");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthExclude) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          "/api/auth/refresh",
          {},
          { withCredentials: true }
        );
        const newAccessToken = refreshResponse.data?.data?.accessToken;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          processQueue(new Error("Refresh failed"), null);
          setAccessToken(null);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
