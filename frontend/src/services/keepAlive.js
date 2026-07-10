// Serviço de keep-alive para o backend (Render free tier)
// Faz ping a cada 10 minutos para evitar que o servidor "durma"

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

let pingTimer = null;

async function pingBackend() {
  try {
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')
      .replace('/api', '');
    const resp = await fetch(`${baseUrl}/health`, { method: 'GET' });
    if (resp.ok) {
      console.log('[KeepAlive] ✅ Backend respondeu:', new Date().toLocaleTimeString('pt-BR'));
    }
  } catch {
    // Silencioso — não queremos erros visíveis ao usuário
  }
}

export function startKeepAlive() {
  if (pingTimer) return; // já está rodando
  pingBackend(); // ping imediato ao iniciar
  pingTimer = setInterval(pingBackend, PING_INTERVAL_MS);
  console.log('[KeepAlive] Iniciado — ping a cada 10 minutos');
}

export function stopKeepAlive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}
