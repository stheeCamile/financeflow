import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Repeat, Play, Pause, Trash2 } from 'lucide-react';
import { subscriptionsApi, cardsApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const CATEGORIES = [
  'alimentacao', 'transporte', 'saude', 'lazer', 'educacao', 'casa', 'roupas', 'outros'
];
const CATEGORY_LABELS = {
  alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde',
  lazer: 'Lazer', educacao: 'Educação', casa: 'Casa', roupas: 'Roupas', outros: 'Outros'
};

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    description: '', amount: '', category: 'outros', card_id: '', billing_day: '1'
  });

  const loadData = async () => {
    try {
      const [subsData, cardsData] = await Promise.all([
        subscriptionsApi.getAll(),
        cardsApi.getAll()
      ]);
      setSubscriptions(subsData);
      setCards(cardsData);
      if (cardsData.length > 0) {
        setForm(prev => ({ ...prev, card_id: cardsData[0].id }));
      }
    } catch (e) {
      toast.error('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalMonthly = subscriptions
    .filter(s => s.is_active)
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.card_id || !form.billing_day) {
      return toast.error('Preencha os campos obrigatórios');
    }
    try {
      await subscriptionsApi.create({
        ...form,
        amount: parseFloat(form.amount.replace(',', '.')),
        billing_day: parseInt(form.billing_day, 10)
      });
      toast.success('Assinatura criada!');
      setShowForm(false);
      setForm({ description: '', amount: '', category: 'outros', card_id: cards[0]?.id || '', billing_day: '1' });
      loadData();
    } catch (err) {
      toast.error('Erro ao criar assinatura');
    }
  };

  const toggleActive = async (sub) => {
    try {
      await subscriptionsApi.update(sub.id, { is_active: !sub.is_active });
      toast.success(sub.is_active ? 'Assinatura pausada!' : 'Assinatura reativada!');
      loadData();
    } catch (err) {
      toast.error('Erro ao atualizar assinatura');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta assinatura permanentemente?')) return;
    try {
      await subscriptionsApi.delete(id);
      toast.success('Excluída com sucesso');
      loadData();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assinaturas e Despesas Fixas</h1>
          <p className="page-subtitle">Cobranças lançadas automaticamente no seu extrato</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Nova Assinatura
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="stat-header">
            <h3 className="stat-title">Custo Fixo Mensal</h3>
            <div className="stat-icon-wrapper" style={{ background: 'var(--red-light)', color: 'var(--red)' }}>
              <Repeat size={20} />
            </div>
          </div>
          <p className="stat-value" style={{ color: 'var(--red)' }}>{formatCurrency(totalMonthly)}</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card"
            style={{ marginBottom: 32, overflow: 'hidden' }}
            onSubmit={handleSubmit}
          >
            <div className="chart-title">Adicionar Nova Assinatura</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Nome (Ex: Netflix, Luz)</label>
                <input className="form-input" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" required className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cartão / Conta</label>
                <select className="form-input" required value={form.card_id} onChange={e => setForm({ ...form, card_id: e.target.value })}>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dia de Cobrança (1 a 31)</label>
                <input type="number" min="1" max="31" required className="form-input" value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary"><Check size={16} /> Salvar</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="card">
        <div className="chart-title">Minhas Assinaturas</div>
        {subscriptions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhuma assinatura cadastrada ainda.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Nome</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Cartão</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Dia</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--bg-border)', opacity: s.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                        backgroundColor: s.is_active ? 'var(--green-light)' : 'var(--bg-secondary)',
                        color: s.is_active ? 'var(--green)' : 'var(--text-secondary)'
                      }}>
                        {s.is_active ? 'Ativa' : 'Pausada'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.description}</td>
                    <td style={{ padding: '12px 16px' }}>{s.card_name}</td>
                    <td style={{ padding: '12px 16px' }}>Todo dia {s.billing_day}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>
                      {formatCurrency(s.amount)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: 6 }}
                          onClick={() => toggleActive(s)}
                          title={s.is_active ? 'Pausar' : 'Reativar'}
                        >
                          {s.is_active ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: 6, color: 'var(--red)' }}
                          onClick={() => handleDelete(s.id)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
