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

export const actionsApi = {
  list: (q = "", source = "all") =>
    api.get("/actions", { params: { q, source } }).then((r) => r.data),
  create: (a) => api.post("/actions", a).then((r) => r.data),
  update: (id, a) => api.put(`/actions/${id}`, a).then((r) => r.data),
  remove: (id) => api.delete(`/actions/${id}`).then((r) => r.data),
  extract: () => api.post("/actions/extract").then((r) => r.data),
  route: (query, limit = 3) =>
    api.post("/ai/route", { query, limit }).then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get("/settings").then((r) => r.data),
  update: (s) => api.post("/settings", s).then((r) => r.data),
};
