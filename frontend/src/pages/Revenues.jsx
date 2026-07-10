import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Check, RefreshCw } from 'lucide-react';
import { revenuesApi, cardsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const CATEGORIES = [
  { value: 'salario',    label: '💼 Salário' },
  { value: 'freelance',  label: '💻 Freelance' },
  { value: 'aluguel',    label: '🏠 Aluguel' },
  { value: 'investimento', label: '📈 Investimento' },
  { value: 'bonus',      label: '🎁 Bônus' },
  { value: 'outros',     label: '💰 Outros' },
];

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function RevenueFormModal({ isOpen, onClose, onSave, revenue: edit, accounts }) {
  const [form, setForm] = useState({
    description: '', category: 'salario', amount: '',
    received_date: new Date().toISOString().split('T')[0],
    is_recurring: false, recurrence: 'monthly', notes: '', account_id: ''
  });

  useEffect(() => {
    if (edit) setForm({ ...edit, amount: edit.amount, account_id: edit.account_id || '' });
    else setForm({ description: '', category: 'salario', amount: '', received_date: new Date().toISOString().split('T')[0], is_recurring: false, recurrence: 'monthly', notes: '', account_id: '' });
  }, [edit, isOpen]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={edit ? 'Editar Receita' : 'Nova Receita'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input className="form-input" placeholder="Ex: Salário, Freelance cliente X..." required value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" required value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <div className="form-input-prefix">
              <span className="prefix">R$</span>
              <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0,00" required
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Conta de Destino (Opcional)</label>
          <select className="form-input" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">Nenhuma conta selecionada</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.brand})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Data de recebimento</label>
          <input className="form-input" type="date" required value={form.received_date} onChange={e => set('received_date', e.target.value)} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Receita recorrente</span>
          </label>
        </div>
        {form.is_recurring && (
          <div className="form-group">
            <label className="form-label">Recorrência</label>
            <select className="form-input" required value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
              <option value="monthly">Mensal</option>
              <option value="weekly">Semanal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <input className="form-input" placeholder="Detalhes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">
            <Check size={16} /> {edit ? 'Salvar' : 'Registrar Receita'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Revenues() {
  const now = new Date();
  const [revenues, setRevenues]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [accounts, setAccounts]   = useState([]);
  const toast = useToast();

  useEffect(() => { load(); }, [month, year]);

  async function load() {
    setLoading(true);
    try {
      const [revs, cardsRes] = await Promise.all([
        revenuesApi.getAll({ month, year }),
        cardsApi.getAll()
      ]);
      setRevenues(revs);
      setAccounts(cardsRes.filter(c => c.type === 'debit' || c.type === 'account'));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const handleSave = async (form) => {
    try {
      if (editItem) { await revenuesApi.update(editItem.id, form); toast.success('Receita atualizada!'); }
      else { await revenuesApi.create(form); toast.success('Receita registrada!'); }
      setShowModal(false); setEditItem(null); await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta receita?')) return;
    try { await revenuesApi.remove(id); toast.success('Receita removida'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const total = revenues.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receitas</h1>
          <p className="page-subtitle">Controle suas entradas de dinheiro</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus size={16} /> Nova Receita
        </button>
      </div>

      {/* Filtro de mês */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <select className="form-input" style={{ width: 160 }} value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" style={{ width: 100 }} value={year} onChange={e => setYear(e.target.value)}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', marginLeft: 'auto' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total do mês:</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(total)}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : revenues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <div className="empty-state-title">Nenhuma receita em {MONTHS[month - 1]}/{year}</div>
          <div className="empty-state-text">Clique em "Nova Receita" para registrar</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {revenues.map((r, i) => {
            const cat = CATEGORIES.find(c => c.value === r.category) || { label: '💰 Outros' };
            return (
              <motion.div key={r.id}
                className="card card-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{r.description}</span>
                    {r.is_recurring && (
                      <span title="Recorrente" style={{ color: 'var(--cyan)' }}><RefreshCw size={13} /></span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {cat.label} • {new Date(r.received_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--green)' }}>{formatCurrency(r.amount)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditItem(r); setShowModal(true); }}>✏️</button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <RevenueFormModal isOpen={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} onSave={handleSave} revenue={editItem} accounts={accounts} />
    </div>
  );
}
