import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, RefreshCw, Unlink, Check } from 'lucide-react';
import { whatsappApi, settingsApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const EXAMPLE_MESSAGES = [
  'gastei 150 com mercado no nubank',
  'paguei 89,90 de gasolina no itau em 3x',
  'gastei 250 ifood nubank',
  'recebi 3000 salário',
  'paguei 1200 de aluguel no bradesco em 6x',
];

const STATUS_CONFIG = {
  disconnected: { label: 'Desconectado', color: 'var(--red)',    dot: 'var(--red)' },
  connecting:   { label: 'Conectando…',  color: 'var(--amber)',  dot: 'var(--amber)' },
  qr_ready:     { label: 'Aguardando QR', color: 'var(--amber)', dot: 'var(--amber)' },
  connected:    { label: 'Conectado',    color: 'var(--green)',   dot: 'var(--green)' },
};

export default function WhatsApp() {
  const [status, setStatus]     = useState('disconnected');
  const [qrCode, setQrCode]     = useState(null);
  const [number, setNumber]     = useState('');
  const [savedNumber, setSavedNumber] = useState('');
  const [loading, setLoading]   = useState(false);
  const [polling, setPolling]   = useState(false);
  const pollRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    checkStatus();
    loadSettings();
    return () => clearInterval(pollRef.current);
  }, []);

  async function loadSettings() {
    try {
      const settings = await settingsApi.getAll();
      const n = settings.whatsapp_number || '';
      setNumber(n); setSavedNumber(n);
    } catch {}
  }

  async function checkStatus() {
    try {
      const { status: st } = await whatsappApi.getStatus();
      setStatus(st);
    } catch {}
  }

  async function handleConnect() {
    setLoading(true);
    setQrCode(null);
    try {
      await whatsappApi.connect();
      // Poll para pegar QR Code e status
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const { status: st, qr } = await whatsappApi.getQRCode();
          setStatus(st);
          if (qr) setQrCode(qr);
          if (st === 'connected') {
            clearInterval(pollRef.current);
            setPolling(false);
            setQrCode(null);
            toast.success('WhatsApp conectado com sucesso! 🎉');
          }
        } catch {}
      }, 2000);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      clearInterval(pollRef.current);
      await whatsappApi.disconnect();
      setStatus('disconnected');
      setQrCode(null);
      toast.info('WhatsApp desconectado');
    } catch (e) { toast.error(e.message); }
  }

  async function handleSaveNumber() {
    try {
      await whatsappApi.setNumber(number);
      setSavedNumber(number);
      toast.success('Número autorizado salvo!');
    } catch (e) { toast.error(e.message); }
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Bot</h1>
          <p className="page-subtitle">Registre gastos e receitas enviando mensagens pelo WhatsApp</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Status e Conexão */}
        <div>
          <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div className="chart-title" style={{ marginBottom: 0 }}>Status da Conexão</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              </div>
            </div>

            {status === 'connected' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)', marginBottom: 8 }}>Bot Ativo!</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Envie mensagens para o número conectado e o bot irá responder automaticamente.
                </div>
                <button className="btn btn-danger" onClick={handleDisconnect}>
                  <Unlink size={16} /> Desconectar
                </button>
              </div>
            ) : qrCode ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho → Escaneie o QR Code abaixo:
                </p>
                <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', marginBottom: 16 }}>
                  <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 220, height: 220, display: 'block' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--amber)', fontSize: 13 }}>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Aguardando scan…
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Conecte seu WhatsApp para registrar gastos enviando mensagens de texto simples.
                </p>
                <button className="btn btn-primary btn-lg" onClick={handleConnect} disabled={loading || polling}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <MessageCircle size={18} />}
                  {loading ? 'Iniciando…' : 'Conectar WhatsApp'}
                </button>
              </div>
            )}
          </motion.div>

          {/* Número autorizado */}
          <motion.div className="card" style={{ marginTop: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="chart-title">Número Autorizado</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Defina qual número pode enviar comandos ao bot (deixe em branco para aceitar qualquer número).
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }}
                  placeholder="5511999998888 (com DDI)"
                  value={number} onChange={e => setNumber(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={handleSaveNumber}>
                <Check size={16} /> Salvar
              </button>
            </div>
            {savedNumber && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--green)' }}>
                ✅ Número ativo: +{savedNumber}
              </div>
            )}
          </motion.div>
        </div>

        {/* Como usar */}
        <div>
          <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="chart-title">Como usar</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Envie mensagens em linguagem natural para o número do WhatsApp conectado:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {EXAMPLE_MESSAGES.map((msg, i) => (
                <div key={i} style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: 'var(--primary-light)', flexShrink: 0 }}>→</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{msg}</span>
                </div>
              ))}
            </div>

            {/* Resposta exemplo */}
            <div className="chart-title" style={{ fontSize: 14, marginBottom: 12 }}>Resposta automática:</div>
            <div style={{ background: '#0d1117', borderRadius: 10, padding: 16, border: '1px solid var(--bg-border)', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ color: 'var(--green)' }}>✅ Gasto registrado!</div>
              <div style={{ color: 'var(--text-primary)' }}>📦 Mercado — R$ 150,00 (Nubank)</div>
              <div>&nbsp;</div>
              <div style={{ color: 'var(--text-secondary)' }}>📊 <strong style={{ color: 'var(--text-primary)' }}>Limite mensal:</strong></div>
              <div style={{ color: 'var(--text-secondary)' }}>   Usado: R$ 1.430,00 de R$ 3.000,00 (47%)</div>
              <div style={{ color: 'var(--primary-light)' }}>   ████████░░░░░░░░░░░░ 47%</div>
              <div>&nbsp;</div>
              <div style={{ color: 'var(--text-secondary)' }}>🧾 <strong style={{ color: 'var(--text-primary)' }}>Fatura Nubank (Jul/2026):</strong></div>
              <div style={{ color: 'var(--text-secondary)' }}>   Total: R$ 890,00</div>
              <div style={{ color: 'var(--amber)' }}>   Vence em: 10 dias (15/07)</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
