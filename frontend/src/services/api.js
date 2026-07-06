const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, { method = 'GET', token, body, params } = {}) {
  let url = `${API_URL}${path}`;

  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: (token) => request('/auth/me', { token }),
  },

  departments: {
    list: (token) => request('/departments', { token }),
    create: (token, data) => request('/departments', { method: 'POST', token, body: data }),
    update: (token, id, data) => request(`/departments/${id}`, { method: 'PUT', token, body: data }),
    remove: (token, id) => request(`/departments/${id}`, { method: 'DELETE', token }),
  },

  users: {
    list: (token, params) => request('/users', { token, params }),
    create: (token, data) => request('/users', { method: 'POST', token, body: data }),
    update: (token, id, data) => request(`/users/${id}`, { method: 'PUT', token, body: data }),
    remove: (token, id) => request(`/users/${id}`, { method: 'DELETE', token }),
  },

  courses: {
    list: (token, params) => request('/courses', { token, params }),
    get: (token, id) => request(`/courses/${id}`, { token }),
    create: (token, data) => request('/courses', { method: 'POST', token, body: data }),
    update: (token, id, data) => request(`/courses/${id}`, { method: 'PUT', token, body: data }),
    remove: (token, id) => request(`/courses/${id}`, { method: 'DELETE', token }),
  },

  tasks: {
    list: (token) => request('/tasks', { token }),
    create: (token, data) => request('/tasks', { method: 'POST', token, body: data }),
    approve: (token, id) => request(`/tasks/${id}/approve`, { method: 'POST', token }),
    reject: (token, id, revisionNotes) =>
      request(`/tasks/${id}/reject`, { method: 'POST', token, body: { revisionNotes } }),

    getById: (token, id) => request(`/tasks/${id}`, { token }),
    submitById: (token, id, data) => request(`/tasks/${id}`, { method: 'PUT', token, body: data }),

    getByAccessToken: (accessToken) => request(`/tasks/token/${accessToken}`),
    submitByAccessToken: (accessToken, data) =>
      request(`/tasks/token/${accessToken}`, { method: 'PUT', body: data }),

    getReview: (token, accessToken) => request(`/tasks/token/${accessToken}/review`, { token }),
    approveByAccessToken: (token, accessToken) =>
      request(`/tasks/token/${accessToken}/approve`, { method: 'POST', token }),
    rejectByAccessToken: (token, accessToken, revisionNotes) =>
      request(`/tasks/token/${accessToken}/reject`, { method: 'POST', token, body: { revisionNotes } }),
  },

  admin: {
    dashboard: (token) => request('/admin/dashboard', { token }),
    tasks: (token, params) => request('/admin/tasks', { token, params }),
    reassignTask: (token, id, data) => request(`/admin/tasks/${id}/reassign`, { method: 'POST', token, body: data }),
    forceApprove: (token, id) => request(`/admin/tasks/${id}/approve`, { method: 'POST', token }),
    forceReject: (token, id, revisionNotes) =>
      request(`/admin/tasks/${id}/reject`, { method: 'POST', token, body: { revisionNotes } }),
  },
};

export default api;
