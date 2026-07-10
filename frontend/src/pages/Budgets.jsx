import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Check, AlertTriangle } from 'lucide-react';
import { budgetsApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const CATEGORY_LABELS = {
  alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde',
  lazer: 'Lazer', educacao: 'Educação', casa: 'Casa', roupas: 'Roupas', outros: 'Outros'
};

const CATEGORY_ICONS = {
  alimentacao: '🍔', transporte: '🚗', saude: '🏥', lazer: '🎬',
  educacao: '📚', casa: '🏠', roupas: '👕', outros: '📦'
};

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    budgetsApi.getAll()
      .then(data => setBudgets(data))
      .catch(e => toast.error('Erro ao carregar orçamentos'))
      .finally(() => setLoading(false));
  }, []);

  const handleAmountChange = (category, val) => {
    setBudgets(prev => prev.map(b => 
      b.category === category ? { ...b, budget_amount: val } : b
    ));
  };

  const handleSave = async () => {
    try {
      const payload = budgets.map(b => ({
        category: b.category,
        amount: parseFloat(b.budget_amount) || 0
      }));
      await budgetsApi.updateAll(payload);
      setSaved(true);
      toast.success('Orçamentos salvos com sucesso!');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error('Erro ao salvar orçamentos');
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Orçamentos por Categoria</h1>
          <p className="page-subtitle">Defina limites para o mês e acompanhe seus gastos em tempo real</p>
        </div>
        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`} onClick={handleSave}>
          {saved ? <><Check size={16} /> Salvo!</> : <><Save size={16} /> Salvar Orçamentos</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, paddingBottom: 40 }}>
        {budgets.map((b, idx) => {
          const budget = parseFloat(b.budget_amount) || 0;
          const spent = parseFloat(b.spent_amount) || 0;
          
          let percentage = 0;
          if (budget > 0) percentage = Math.min(100, (spent / budget) * 100);
          
          const isOverLimit = budget > 0 && spent > budget;
          const isWarning = budget > 0 && spent > budget * 0.8 && !isOverLimit;

          let barColor = 'var(--primary)';
          if (isOverLimit) barColor = 'var(--red)';
          else if (isWarning) barColor = 'var(--orange)';

          return (
            <motion.div 
              key={b.category} 
              className="card" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600 }}>
                  <span>{CATEGORY_ICONS[b.category]}</span>
                  {CATEGORY_LABELS[b.category]}
                </div>
                
                <div style={{ position: 'relative', width: 120 }}>
                  <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-secondary)', fontSize: 14 }}>R$</span>
                  <input 
                    type="number" 
                    step="50"
                    min="0"
                    className="form-input" 
                    style={{ paddingLeft: 35, textAlign: 'right', fontWeight: 600 }}
                    value={b.budget_amount} 
                    onChange={(e) => handleAmountChange(b.category, e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {budget > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Gasto: {formatCurrency(spent)}</span>
                    <span style={{ fontWeight: 600, color: isOverLimit ? 'var(--red)' : 'var(--text-primary)' }}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="progress-bg">
                    <div className="progress-fill" style={{ width: `${percentage}%`, background: barColor }} />
                  </div>
                  {isOverLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontSize: 12, marginTop: 8, fontWeight: 500 }}>
                      <AlertTriangle size={14} /> Você estourou o orçamento!
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  Defina um valor limite para acompanhar.
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
