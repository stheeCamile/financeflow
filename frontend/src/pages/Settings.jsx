import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Check } from 'lucide-react';
import { settingsApi, whatsappApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const CATEGORIES_EXPENSE = ['alimentacao','transporte','saude','lazer','educacao','casa','roupas','outros'];
const CATEGORY_LABELS = { alimentacao:'Alimentação', transporte:'Transporte', saude:'Saúde', lazer:'Lazer', educacao:'Educação', casa:'Casa', roupas:'Roupas', juros:'Juros/Taxas', outros:'Outros' };

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function Settings() {
  const [settings, setSettings]   = useState({});
  const [form, setForm]           = useState({ monthly_limit_global: '', monthly_limit_per_card: 'false', gemini_api_key: '', groq_api_key: '', ai_daily_enabled: 'true', ai_user_profile: '' });
  const [loading, setLoading]     = useState(true);
  const [testingAi, setTestingAi] = useState(false);
  const [saved, setSaved]         = useState(false);
  const toast = useToast();

  useEffect(() => {
    settingsApi.getAll().then(s => {
      setSettings(s);
      setForm({ 
        monthly_limit_global: s.monthly_limit_global || '', 
        monthly_limit_per_card: s.monthly_limit_per_card || 'false',
        gemini_api_key: s.gemini_api_key || '',
        groq_api_key: s.groq_api_key || '',
        ai_daily_enabled: s.ai_daily_enabled || 'true',
        ai_user_profile: s.ai_user_profile || ''
      });
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await settingsApi.update(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Configurações salvas!');
    } catch (e) { toast.error(e.message); }
  };

  async function handleTestAi() {
    setTestingAi(true);
    try {
      await whatsappApi.testAi();
      toast.success('Análise solicitada! Verifique o seu WhatsApp em instantes.');
    } catch (e) {
      toast.error(e.message || 'Erro ao testar a IA.');
    } finally {
      setTestingAi(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Personalize o comportamento do FinanceFlow</p>
        </div>
        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`} onClick={handleSave}>
          {saved ? <><Check size={16} /> Salvo!</> : <><Save size={16} /> Salvar</>}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="chart-title">Limite Mensal</div>

          <div className="form-group">
            <label className="form-label">Limite mensal global (R$)</label>
            <div className="form-input-prefix">
              <span className="prefix">R$</span>
              <input className="form-input" type="number" min="0" step="100" placeholder="3000"
                value={form.monthly_limit_global}
                onChange={e => setForm(p => ({ ...p, monthly_limit_global: e.target.value }))} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              O dashboard irá mostrar um alerta quando você se aproximar desse valor.
            </p>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox"
                checked={form.monthly_limit_per_card === 'true'}
                onChange={e => setForm(p => ({ ...p, monthly_limit_per_card: e.target.checked ? 'true' : 'false' }))}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Mostrar limite por cartão</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Exibe progresso individual para cada cartão</div>
              </div>
            </label>
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤖</span> Inteligência Artificial (Gemini)
          </div>

          <div className="form-group">
            <label className="form-label">Chave de API do Google Gemini (Primária)</label>
            <input className="form-input" type="password" placeholder="AIzaSy..."
              value={form.gemini_api_key}
              onChange={e => setForm(p => ({ ...p, gemini_api_key: e.target.value }))} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Necessária para receber análises de gastos e conselhos financeiros no WhatsApp. Obtenha a sua gratuitamente no Google AI Studio.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Chave de API da Groq (Reserva/Alternativa)</label>
            <input className="form-input" type="password" placeholder="gsk_..."
              value={form.groq_api_key || ''}
              onChange={e => setForm(p => ({ ...p, groq_api_key: e.target.value }))} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Se o Gemini estiver com o servidor lotado, usaremos a Groq (Llama 3) automaticamente como plano B. Grátis em console.groq.com.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Seu Perfil e Objetivos (Para a IA)</label>
            <textarea className="form-input" placeholder="Ex: Tenho 25 anos, quero juntar dinheiro para comprar um carro. Gosto de investir em Renda Fixa..." rows="3"
              value={form.ai_user_profile}
              onChange={e => setForm(p => ({ ...p, ai_user_profile: e.target.value }))} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Descreva quem você é, seus objetivos financeiros e preferências de investimento para receber conselhos mais personalizados.
            </p>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox"
                checked={form.ai_daily_enabled === 'true'}
                onChange={e => setForm(p => ({ ...p, ai_daily_enabled: e.target.checked ? 'true' : 'false' }))}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Receber Análise Diária via WhatsApp</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>A IA vai te mandar um resumo dos seus gastos diários todas as noites.</div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 24, padding: '16px', background: 'rgba(124,58,237,0.1)', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>Testar Integração IA</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Gera uma análise instantânea e envia para o seu WhatsApp agora mesmo.
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleTestAi} 
                disabled={testingAi}
                style={{ background: 'var(--primary)', minWidth: 120 }}
              >
                {testingAi ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Testar Agora'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
