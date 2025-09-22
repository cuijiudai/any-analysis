import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.NODE_ENV === "production"
      ? `${
          process.env.REACT_APP_API_URL || "https://your-backend.railway.app"
        }/api`
      : "/api", // 在开发环境中使用代理
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
api.interceptors.request.use(
  config => {
    console.log("API请求:", config.method?.toUpperCase(), config.url);

    // 添加JWT token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    console.error("API错误:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
