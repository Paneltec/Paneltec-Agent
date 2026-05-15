import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const indexApi = {
  stats: () => api.get("/index/stats").then((r) => r.data),
  sync: () => api.post("/index/sync").then((r) => r.data),
  job: (id) => api.get(`/index/job/${id}`).then((r) => r.data),
};

export const searchApi = {
  search: (q, category = "all", limit = 20) =>
    api
      .get("/search", { params: { q, category, limit } })
      .then((r) => r.data),
  ask: (query, sessionId = null, category = "all") =>
    api
      .post("/ai/ask", { query, session_id: sessionId, category })
      .then((r) => r.data),
};

export const filesApi = {
  list: (category = "all", q = "") =>
    api.get("/files/list", { params: { category, q } }).then((r) => r.data),
  get: (id) => api.get(`/files/${id}`).then((r) => r.data),
};
