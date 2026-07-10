import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
});

// Injetar token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ff_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tratar erros globais
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado/inválido — limpar e recarregar
      localStorage.removeItem('ff_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.error || error.message || 'Erro desconhecido';
    return Promise.reject(new Error(message));
  }
);

// ── Cards ────────────────────────────────────────────────────
export const cardsApi = {
  getAll:      ()      => api.get('/cards'),
  getById:     (id)    => api.get(`/cards/${id}`),
  create:      (data)  => api.post('/cards', data),
  update:      (id, d) => api.put(`/cards/${id}`, d),
  remove:      (id)    => api.delete(`/cards/${id}`),
  getInvoices: (id)    => api.get(`/cards/${id}/invoices`),
};

// ── Invoices ──────────────────────────────────────────────────
export const invoicesApi = {
  getById: (id) => api.get(`/invoices/${id}`),
  create:  (d)  => api.post('/invoices', d),
  close:   (id) => api.post(`/invoices/${id}/close`),
  pay:     (id) => api.post(`/invoices/${id}/pay`),
};

// ── Expenses ──────────────────────────────────────────────────
export const expensesApi = {
  getAll: (filters) => api.get('/expenses', { params: filters }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getInstallments: () => api.get('/expenses/installments'),
};

// ── Subscriptions ─────────────────────────────────────────────
export const subscriptionsApi = {
  getAll: () => api.get('/subscriptions'),
  create: (data) => api.post('/subscriptions', data),
  update: (id, data) => api.put(`/subscriptions/${id}`, data),
  delete: (id) => api.delete(`/subscriptions/${id}`),
};

// ── Budgets ───────────────────────────────────────────────────
export const budgetsApi = {
  getAll: () => api.get('/budgets'),
  updateAll: (budgets) => api.put('/budgets', { budgets }),
};

// ── Revenues ──────────────────────────────────────────────────
export const revenuesApi = {
  getAll: (params) => api.get('/revenues', { params }),
  create: (data)   => api.post('/revenues', data),
  update: (id, d)  => api.put(`/revenues/${id}`, d),
  remove: (id)     => api.delete(`/revenues/${id}`),
};

// ── Goals ─────────────────────────────────────────────────────
export const goalsApi = {
  getAll:     ()      => api.get('/goals'),
  getById:    (id)    => api.get(`/goals/${id}`),
  create:     (data)  => api.post('/goals', data),
  update:     (id, d) => api.put(`/goals/${id}`, d),
  remove:     (id)    => api.delete(`/goals/${id}`),
  contribute: (id, d) => api.post(`/goals/${id}/contribute`, d),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  getSummary:   (params) => api.get('/dashboard/summary', { params }),
  getEvolution: ()       => api.get('/dashboard/evolution'),
  getAiSummary: (params) => api.get('/dashboard/ai-summary', { params }),
};

// ── Settings ──────────────────────────────────────────────────
export const settingsApi = {
  getAll: ()     => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// ── WhatsApp ──────────────────────────────────────────────────
export const whatsappApi = {
  getStatus:  ()  => api.get('/whatsapp/status'),
  getQRCode:  ()  => api.get('/whatsapp/qrcode'),
  connect:    ()  => api.post('/whatsapp/connect'),
  disconnect: ()  => api.post('/whatsapp/disconnect'),
  setNumber:  (n) => api.put('/whatsapp/number', { number: n }),
  testAi:     ()  => api.post('/whatsapp/test-ai', {}, { timeout: 60000 }),
};

export default api;
