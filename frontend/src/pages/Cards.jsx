import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronRight, CreditCard, ArrowLeft, X, Check, Lock, UploadCloud } from 'lucide-react';
import { cardsApi, expensesApi, invoicesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/shared/Modal';
import ImportInvoiceModal from '../components/ImportInvoiceModal';

const BRANDS = ['Nubank', 'Itaú', 'Bradesco', 'Santander', 'Caixa', 'Banco do Brasil', 'Inter', 'C6 Bank', 'XP', 'Next', 'Outro'];
const COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#6366f1','#84cc16','#f97316', '#eab308', '#facc15'];
const CATEGORIES = ['alimentacao','transporte','saude','lazer','educacao','casa','roupas','juros','outros'];
const CATEGORY_LABELS = { alimentacao:'Alimentação', transporte:'Transporte', saude:'Saúde', lazer:'Lazer', educacao:'Educação', casa:'Casa', roupas:'Roupas', juros:'Juros/Taxas', outros:'Outros' };
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function CardVisual({ card }) {
  return (
    <div
      className="credit-card-visual"
      style={{ background: `linear-gradient(135deg, ${card.color}dd, ${card.color}88)`, color: '#fff' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="card-brand-badge">{card.brand}</div>
          <div className="card-chip" />
        </div>
        <div style={{ textAlign: 'right', zIndex: 1, position: 'relative' }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{card.type === 'credit' ? 'Limite' : 'Saldo Atual'}</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(card.type === 'credit' ? card.limit_amount : card.balance)}</div>
        </div>
      </div>
      <div className="card-number">
        •••• •••• •••• {card.last_four_digits || '••••'}
      </div>
      <div className="card-footer" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <div className="card-holder-label">
            {card.type === 'account' ? 'Conta Bancária' : `Cartão (${card.type === 'debit' ? 'Débito' : 'Crédito'})`}
          </div>
          <div className="card-holder-name">{card.name}</div>
        </div>
        {card.type === 'credit' && (
          <div style={{ textAlign: 'right' }}>
            <div className="card-holder-label">Fecha dia</div>
            <div className="card-holder-name">{card.closing_day}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de criar/editar cartão
function CardFormModal({ isOpen, onClose, onSave, onDelete, card: editCard }) {
  const [form, setForm] = useState({
    name: '', brand: 'Nubank', color: COLORS[0], type: 'credit',
    limit_amount: '', closing_day: '', due_day: '', last_four_digits: '', balance: ''
  });

  useEffect(() => {
    if (editCard) setForm({ ...editCard, limit_amount: editCard.limit_amount, type: editCard.type || 'credit', balance: editCard.balance || '' });
    else setForm({ name: '', brand: 'Nubank', color: COLORS[0], type: 'credit', limit_amount: '', closing_day: '', due_day: '', last_four_digits: '', balance: '' });
  }, [editCard, isOpen]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editCard ? 'Editar Cartão' : 'Novo Cartão'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="form-group">
          <label className="form-label">Nome do cartão</label>
          <input className="form-input" placeholder="Ex: Nubank Pessoal" required value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-input" required value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="credit">Cartão de Crédito</option>
              <option value="debit">Cartão de Débito</option>
              <option value="account">Conta Bancária / Pix</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Instituição / Bandeira</label>
            <select className="form-input" required value={form.brand} onChange={e => set('brand', e.target.value)}>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Últimos 4 dígitos</label>
          <input className="form-input" maxLength={4} placeholder="0000" value={form.last_four_digits} onChange={e => set('last_four_digits', e.target.value)} />
        </div>
        <div className="form-row">
          {form.type === 'credit' && (
            <div className="form-group">
              <label className="form-label">Limite Mensal (R$)</label>
              <div className="form-input-prefix">
                <span className="prefix">R$</span>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="5000.00" required
                  value={form.limit_amount} onChange={e => set('limit_amount', e.target.value)} />
              </div>
            </div>
          )}
          {(form.type === 'debit' || form.type === 'account') && (
            <div className="form-group">
              <label className="form-label">Saldo Atual (R$)</label>
              <div className="form-input-prefix">
                <span className="prefix">R$</span>
                <input className="form-input" type="number" step="0.01" placeholder="1000.00" required
                  value={form.balance} onChange={e => set('balance', e.target.value)} />
              </div>
            </div>
          )}
        </div>
        {form.type === 'credit' && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dia de fechamento</label>
              <input className="form-input" type="number" min="1" max="31" placeholder="20" required
                value={form.closing_day} onChange={e => set('closing_day', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Dia de vencimento</label>
              <input className="form-input" type="number" min="1" max="31" placeholder="10" required
                value={form.due_day} onChange={e => set('due_day', e.target.value)} />
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Cor do cartão</label>
          <div className="color-options">
            {COLORS.map(c => (
              <div key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                style={{ background: c }} onClick={() => set('color', c)} />
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: editCard ? 'space-between' : 'flex-end' }}>
          {editCard && (
            <button type="button" className="btn btn-danger" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(editCard.id); }}>Excluir</button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} /> {editCard ? 'Salvar' : 'Criar Cartão'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// Modal de adicionar gasto
function ExpenseFormModal({ isOpen, onClose, onSave, cards }) {
  const [form, setForm] = useState({
    card_id: '', description: '', category: 'outros', amount: '',
    installment_total: 1, purchase_date: new Date().toISOString().split('T')[0], notes: ''
  });

  useEffect(() => {
    if (isOpen && cards.length > 0) setForm(p => ({ ...p, card_id: cards[0].id }));
  }, [isOpen, cards]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Gasto">
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="form-group">
          <label className="form-label">Cartão</label>
          <select className="form-input" required value={form.card_id} onChange={e => set('card_id', e.target.value)}>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input className="form-input" placeholder="Ex: Mercado, Netflix, Gasolina..." required value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <div className="form-input-prefix">
              <span className="prefix">R$</span>
              <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0,00" required
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Parcelas</label>
            <select className="form-input" required value={form.installment_total} onChange={e => set('installment_total', e.target.value)}>
              {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" required value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data da compra</label>
            <input className="form-input" type="date" required value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <input className="form-input" placeholder="Detalhes adicionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">
            <Check size={16} /> Registrar Gasto
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Detalhe de fatura
function InvoiceDetail({ invoiceId, onBack, onDeleteExpense }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editExpense, setEditExpense] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const toast = useToast();

  const fetchInvoiceDetails = () => {
    invoicesApi.getById(invoiceId).then(setInvoice).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!invoice) return null;

  const statusLabel = { open: 'Aberta', closed: 'Fechada', paid: 'Paga' };
  const handlePay = async () => {
    try {
      await invoicesApi.pay(invoiceId);
      toast.success('Fatura marcada como paga!');
      const updated = await invoicesApi.getById(invoiceId);
      setInvoice(updated);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>
            Fatura {invoice.card_name} — {MONTHS[invoice.month - 1]}/{invoice.year}
          </h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <span className={`badge badge-${invoice.status}`}>{statusLabel[invoice.status]}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Fecha: {invoice.closing_date ? new Date(invoice.closing_date).toLocaleDateString('pt-BR') : 'N/A'} •
              Vence: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-BR') : 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-light)' }}>{formatCurrency(invoice.total_amount)}</div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Importar Fatura
            </button>
            {invoice.status !== 'paid' && (
              <button className="btn btn-primary btn-sm" onClick={handlePay}>
                <Check size={14} /> Marcar como Paga
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Data</th>
              <th>Parcela</th>
              <th>Valor</th>
              <th>Origem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoice.expenses?.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Nenhuma compra nesta fatura</td></tr>
            )}
            {invoice.expenses?.map(exp => (
              <tr key={exp.id}>
                <td style={{ fontWeight: 500 }}>{exp.description}</td>
                <td><span className="category-pill">{CATEGORY_LABELS[exp.category] || exp.category}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{new Date(exp.purchase_date).toLocaleDateString('pt-BR')}</td>
                <td>
                  {exp.installment_total > 1
                    ? <span className="installment-badge">{exp.installment_current}/{exp.installment_total}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>À vista</span>
                  }
                </td>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(exp.amount)}</td>
                <td>
                  <span style={{ fontSize: 12, color: exp.source === 'whatsapp' ? 'var(--green)' : 'var(--text-muted)' }}>
                    {exp.source === 'whatsapp' ? '📱 WhatsApp' : '✏️ Manual'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', height: 'auto' }} onClick={() => setEditExpense(exp)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
        onDelete={() => {
          onDeleteExpense(editExpense.id);
          setEditExpense(null);
        }}
        onSave={async (data) => {
          try {
            await expensesApi.update(editExpense.id, data);
            toast.success('Gasto atualizado!');
            const updated = await invoicesApi.getById(invoiceId);
            setInvoice(updated);
            setEditExpense(null);
          } catch (e) { toast.error(e.message); }
        }}
      />

      {showImport && (
        <ImportInvoiceModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          cardId={invoice.card_id}
          onImportSuccess={fetchInvoiceDetails}
        />
      )}
    </div>
  );
}

function EditExpenseModal({ isOpen, onClose, onSave, onDelete, expense }) {
  const [form, setForm] = useState({ 
    description: '', category: 'outros', amount: '', purchase_date: '',
    installment_current: 1, installment_total: 1 
  });

  useEffect(() => {
    if (expense) {
      setForm({ 
        description: expense.description, 
        category: expense.category, 
        amount: expense.amount,
        purchase_date: expense.purchase_date ? new Date(expense.purchase_date).toISOString().split('T')[0] : '',
        installment_current: expense.installment_current || 1,
        installment_total: expense.installment_total || 1
      });
    }
  }, [expense]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Gasto">
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input className="form-input" required value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <div className="form-input-prefix">
              <span className="prefix">R$</span>
              <input className="form-input" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" required value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Parcela Atual</label>
            <input className="form-input" type="number" min="1" required value={form.installment_current} onChange={e => set('installment_current', parseInt(e.target.value) || 1)} />
          </div>
          <div className="form-group">
            <label className="form-label">Total de Parcelas</label>
            <input className="form-input" type="number" min="1" required value={form.installment_total} onChange={e => set('installment_total', parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Data da compra</label>
          <input className="form-input" type="date" required value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-danger" onClick={onDelete}>Excluir</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar Alterações</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function Cards() {
  const [cards, setCards]         = useState([]);
  const [invoices, setInvoices]   = useState({});
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editCard, setEditCard]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const toast = useToast();

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    setLoading(true);
    try { setCards(await cardsApi.getAll()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function loadInvoices(cardId) {
    try {
      const data = await cardsApi.getInvoices(cardId);
      setInvoices(p => ({ ...p, [cardId]: data }));
    } catch (e) { toast.error(e.message); }
  }

  const handleCardClick = async (card) => {
    setSelectedCard(card);
    setSelectedInvoice(null);
    await loadInvoices(card.id);
  };

  const handleSaveCard = async (form) => {
    try {
      if (editCard) {
        await cardsApi.update(editCard.id, form);
        toast.success('Cartão atualizado!');
      } else {
        await cardsApi.create(form);
        toast.success('Cartão criado!');
      }
      setShowCardModal(false);
      setEditCard(null);
      await loadCards();
    } catch (e) { toast.error(e.message); }
  };

  const handleSaveExpense = async (form) => {
    try {
      await expensesApi.create(form);
      toast.success('Gasto registrado!');
      setShowExpenseModal(false);
      if (selectedCard) await loadInvoices(selectedCard.id);
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteCard = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conta/cartão? Isso removerá o histórico atrelado a ele.')) return;
    try {
      await cardsApi.remove(id);
      toast.success('Cartão/Conta excluído com sucesso!');
      setShowCardModal(false);
      setEditCard(null);
      if (selectedCard && selectedCard.id === id) setSelectedCard(null);
      await loadCards();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este gasto?')) return;
    try {
      await expensesApi.delete(id);
      toast.success('Gasto excluído!');
      if (selectedCard) await loadInvoices(selectedCard.id);
    } catch (e) { toast.error(e.message); }
  };

  if (selectedInvoice) {
    return (
      <div className="page-container">
        <InvoiceDetail 
          invoiceId={selectedInvoice} 
          onBack={() => setSelectedInvoice(null)} 
          onDeleteExpense={handleDeleteExpense} 
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        {selectedCard ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost" onClick={() => setSelectedCard(null)}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="page-title">{selectedCard.name}</h1>
              <p className="page-subtitle">Faturas e histórico</p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="page-title">Contas e Cartões</h1>
            <p className="page-subtitle">Gerencie suas contas, saldos e cartões</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {selectedCard && (
            <button className="btn btn-secondary" onClick={() => setShowExpenseModal(true)}>
              <Plus size={16} /> Novo Gasto
            </button>
          )}
          {!selectedCard && (
            <button className="btn btn-primary" onClick={() => { setEditCard(null); setShowCardModal(true); }}>
              <Plus size={16} /> Nova Conta / Cartão
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : !selectedCard ? (
        // Lista de cartões
        cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">Nenhum cartão cadastrado</div>
            <div className="empty-state-text">Clique em "Novo Cartão" para começar</div>
          </div>
        ) : (
          <div className="grid-3">
            {cards.map((card, i) => (
              <motion.div key={card.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handleCardClick(card)}
                style={{ cursor: 'pointer' }}
              >
                <CardVisual card={card} />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Gasto este mês
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(card.current_month_spent)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditCard(card); setShowCardModal(true); }}>
                    Editar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        // Lista de faturas do cartão selecionado
        <div>
          <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CardVisual card={selectedCard} />
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setShowImportModal(true)}>
              <UploadCloud size={16} /> Importar Fatura (IA)
            </button>
          </div>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Faturas</h3>
          {!invoices[selectedCard.id] || invoices[selectedCard.id].length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <div className="empty-state-title">Nenhuma fatura ainda</div>
              <div className="empty-state-text">Adicione um gasto para criar a primeira fatura</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invoices[selectedCard.id].map(inv => {
                const statusLabel = { open: 'Aberta', closed: 'Fechada', paid: 'Paga' };
                return (
                  <motion.div key={inv.id}
                    className="card card-sm"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    whileHover={{ x: 4 }}
                    onClick={() => setSelectedInvoice(inv.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-light)' }}>
                        {inv.status === 'paid' ? <Lock size={16} /> : <CreditCard size={16} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{MONTHS[inv.month - 1]}/{inv.year}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {inv.expense_count} compra{inv.expense_count !== '1' ? 's' : ''} •
                          Vence {inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', align: 'center', gap: 12 }}>
                      <span className={`badge badge-${inv.status}`}>{statusLabel[inv.status]}</span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(inv.total_amount)}</span>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CardFormModal
        isOpen={showCardModal}
        onClose={() => { setShowCardModal(false); setEditCard(null); }}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        card={editCard}
      />
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleSaveExpense}
        cards={cards}
      />

      {showImportModal && (
        <ImportInvoiceModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          cardId={selectedCard?.id}
          onImportSuccess={() => loadInvoices(selectedCard?.id)}
        />
      )}
    </div>
  );
}
