const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, { method = 'GET', token, body, params } = {}) {
  let url = `${API_URL}${path}`;

  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  // Only set Content-Type when an actual body is being sent — Fastify's
  // JSON body parser rejects a request that declares application/json but
  // sends no body at all (FST_ERR_CTP_EMPTY_JSON_BODY), which is exactly
  // what a bodyless action like approve() was triggering.
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
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

// Binary GET download (docx previews) — same blob + Content-Disposition
// filename pattern as downloads.export below, but for simple GET endpoints.
async function downloadFile(path, { token, fallbackName = 'download.docx' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { headers });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message || `Download failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match ? match[1] : fallbackName;
  const blob = await res.blob();

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
    reopen: (token, id, note) =>
      request(`/tasks/${id}/reopen`, { method: 'POST', token, body: { note: note || null } }),

    getById: (token, id) => request(`/tasks/${id}`, { token }),
    submitById: (token, id, data) => request(`/tasks/${id}`, { method: 'PUT', token, body: data }),

    getByAccessToken: (accessToken) => request(`/tasks/token/${accessToken}`),
    submitByAccessToken: (accessToken, data) =>
      request(`/tasks/token/${accessToken}`, { method: 'PUT', body: data }),

    previewDocxById: (token, id) => downloadFile(`/tasks/${id}/preview.docx`, { token }),
    previewDocxByToken: (accessToken) => downloadFile(`/tasks/token/${accessToken}/preview.docx`),

    getReview: (token, accessToken) => request(`/tasks/token/${accessToken}/review`, { token }),
    approveByAccessToken: (token, accessToken) =>
      request(`/tasks/token/${accessToken}/approve`, { method: 'POST', token }),
    rejectByAccessToken: (token, accessToken, revisionNotes) =>
      request(`/tasks/token/${accessToken}/reject`, { method: 'POST', token, body: { revisionNotes } }),
    reopenByAccessToken: (token, accessToken, note) =>
      request(`/tasks/token/${accessToken}/reopen`, { method: 'POST', token, body: { note: note || null } }),
  },

  admin: {
    dashboard: (token) => request('/admin/dashboard', { token }),
    reorderDepartments: (token, departmentIds) =>
      request('/admin/departments/reorder', { method: 'PATCH', token, body: { departmentIds } }),
    reorderCourses: (token, courseIds) =>
      request('/admin/courses/reorder', { method: 'PATCH', token, body: { courseIds } }),
    departmentCourses: (token, departmentId) => request(`/admin/departments/${departmentId}/courses`, { token }),
    tasks: (token, params) => request('/admin/tasks', { token, params }),
    reassignTask: (token, id, data) => request(`/admin/tasks/${id}/reassign`, { method: 'POST', token, body: data }),
    forceApprove: (token, id) => request(`/admin/tasks/${id}/approve`, { method: 'POST', token }),
    forceReject: (token, id, revisionNotes) =>
      request(`/admin/tasks/${id}/reject`, { method: 'POST', token, body: { revisionNotes } }),
  },

  downloads: {
    courses: (token, params) => request('/downloads/courses', { token, params }),
    history: (token) => request('/downloads/history', { token }),
    // Binary response (docx/pdf), not JSON — bypasses the shared `request()`
    // helper and triggers a normal browser file-save via a temporary link.
    export: async (token, body) => {
      const res = await fetch(`${API_URL}/downloads/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.message || `Export failed with status ${res.status}`;
        const error = new Error(message);
        error.status = res.status;
        throw error;
      }

      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match ? match[1] : `export.${body.format}`;
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  },
};

export default api;
