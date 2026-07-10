import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Trash2 } from 'lucide-react';
import { goalsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';

const COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#6366f1'];
const EMOJIS = ['🎯','✈️','🏠','🚗','📱','💻','🎓','💍','🏋️','🌴','🛍️','💰','🎮','📚','🏥'];

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function GoalFormModal({ isOpen, onClose, onSave, goal: edit }) {
  const [form, setForm] = useState({
    name: '', description: '', target_amount: '', deadline: '',
    color: COLORS[0], emoji: EMOJIS[0]
  });

  useEffect(() => {
    if (edit) setForm({ ...edit, target_amount: edit.target_amount });
    else setForm({ name: '', description: '', target_amount: '', deadline: '', color: COLORS[0], emoji: EMOJIS[0] });
  }, [edit, isOpen]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={edit ? 'Editar Meta' : 'Nova Meta'}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
        <div>
          <label className="form-label">Emoji</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 200 }}>
            {EMOJIS.map(e => (
              <button key={e}
                style={{ fontSize: 20, padding: 4, borderRadius: 6, background: form.emoji === e ? 'var(--primary-dim)' : 'transparent', cursor: 'pointer', border: form.emoji === e ? '1px solid var(--primary)' : '1px solid transparent' }}
                onClick={() => set('emoji', e)}>{e}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Nome da meta</label>
        <input className="form-input" placeholder="Ex: Viagem para Europa, Reserva de emergência..." value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Descrição (opcional)</label>
        <input className="form-input" placeholder="Detalhes da meta..." value={form.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor alvo (R$)</label>
          <div className="form-input-prefix">
            <span className="prefix">R$</span>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="10000.00"
              value={form.target_amount} onChange={e => set('target_amount', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Prazo (opcional)</label>
          <input className="form-input" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cor</label>
        <div className="color-options">
          {COLORS.map(c => (
            <div key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`}
              style={{ background: c }} onClick={() => set('color', c)} />
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}>
          <Check size={16} /> {edit ? 'Salvar' : 'Criar Meta'}
        </button>
      </div>
    </Modal>
  );
}

function ContributeModal({ isOpen, onClose, onSave, goal }) {
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');

  useEffect(() => { setAmount(''); setNote(''); }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adicionar aporte — ${goal?.name}`}>
      <div className="form-group">
        <label className="form-label">Valor do aporte (R$)</label>
        <div className="form-input-prefix">
          <span className="prefix">R$</span>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
            value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Observação (opcional)</label>
        <input className="form-input" placeholder="Ex: Sobra de salário de julho..." value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave({ amount, note })}>
          <Check size={16} /> Confirmar Aporte
        </button>
      </div>
    </Modal>
  );
}

export default function Goals() {
  const [goals, setGoals]              = useState([]);
  const [loading, setLoading]          = useState(true);
  const [showModal, setShowModal]      = useState(false);
  const [editGoal, setEditGoal]        = useState(null);
  const [contributeGoal, setContributeGoal] = useState(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setGoals(await goalsApi.getAll()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const handleSave = async (form) => {
    try {
      if (editGoal) { await goalsApi.update(editGoal.id, form); toast.success('Meta atualizada!'); }
      else { await goalsApi.create(form); toast.success('Meta criada!'); }
      setShowModal(false); setEditGoal(null); await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleContribute = async ({ amount, note }) => {
    try {
      await goalsApi.contribute(contributeGoal.id, { amount, note });
      toast.success(`Aporte de ${formatCurrency(amount)} adicionado!`);
      setContributeGoal(null); await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta meta?')) return;
    try { await goalsApi.remove(id); toast.success('Meta removida'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const active    = goals.filter(g => !g.is_completed);
  const completed = goals.filter(g => g.is_completed);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Metas de Poupança</h1>
          <p className="page-subtitle">Defina e acompanhe seus objetivos financeiros</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditGoal(null); setShowModal(true); }}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">Nenhuma meta criada</div>
          <div className="empty-state-text">Defina seus objetivos financeiros e acompanhe o progresso</div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>Em andamento</h3>
              <div className="grid-3" style={{ marginBottom: 32 }}>
                {active.map((g, i) => {
                  const pct = Math.min(parseFloat(g.progress_percent || 0), 100);
                  const remaining = parseFloat(g.target_amount) - parseFloat(g.current_amount);
                  const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <motion.div key={g.id} className="goal-card"
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                      <span className="goal-emoji">{g.emoji}</span>
                      <div className="goal-name">{g.name}</div>
                      {g.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{g.description}</div>}
                      <div className="goal-values">
                        {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                        {daysLeft !== null && <span> • {daysLeft > 0 ? `${daysLeft} dias` : 'Prazo vencido'}</span>}
                      </div>

                      <div className="progress-track" style={{ height: 8, marginBottom: 8 }}>
                        <div className="progress-fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(135deg, ${g.color}, ${g.color}aa)` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Faltam {formatCurrency(remaining)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{pct.toFixed(0)}%</span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setContributeGoal(g)}>
                          + Aportar
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditGoal(g); setShowModal(true); }}>✏️</button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {completed.length > 0 && (
            <>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--green)' }}>✅ Concluídas</h3>
              <div className="grid-3">
                {completed.map((g, i) => (
                  <motion.div key={g.id} className="goal-card" style={{ opacity: 0.7 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: i * 0.08 }}>
                    <span className="goal-emoji">{g.emoji}</span>
                    <div className="goal-name" style={{ textDecoration: 'line-through' }}>{g.name}</div>
                    <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>
                      ✅ {formatCurrency(g.target_amount)} alcançado!
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <GoalFormModal isOpen={showModal} onClose={() => { setShowModal(false); setEditGoal(null); }} onSave={handleSave} goal={editGoal} />
      <ContributeModal isOpen={!!contributeGoal} onClose={() => setContributeGoal(null)} onSave={handleContribute} goal={contributeGoal} />
    </div>
  );
}
