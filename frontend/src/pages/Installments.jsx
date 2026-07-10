import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { expensesApi } from '../services/api';
import { useToast } from '../context/ToastContext';

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function Installments() {
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadInstallments();
  }, []);

  async function loadInstallments() {
    setLoading(true);
    try {
      const data = await expensesApi.getInstallments();
      setInstallments(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Parcelas</h1>
          <p className="page-subtitle">Acompanhe suas compras parceladas e o progresso de pagamento</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : installments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛍️</div>
          <div className="empty-state-title">Nenhuma compra parcelada</div>
          <div className="empty-state-text">Você não possui compras em andamento.</div>
        </div>
      ) : (
        <div className="grid-2">
          {installments.map((inst, i) => {
            const percent = Math.round((inst.paid_installments / inst.total_installments) * 100);
            return (
              <motion.div
                key={i}
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>{inst.description}</h3>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {new Date(inst.purchase_date).toLocaleDateString('pt-BR')} • {inst.card_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatCurrency(inst.total_amount)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {inst.total_installments}x de {formatCurrency(inst.installment_amount)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, fontWeight: 600 }}>
                    <span style={{ color: percent === 100 ? 'var(--green)' : 'var(--text-primary)' }}>
                      {inst.paid_installments} pagas
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Faltam {inst.total_installments - inst.paid_installments}
                    </span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: 8 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${percent}%`, background: percent === 100 ? 'var(--green)' : 'var(--primary)' }}
                    />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>
                    {percent}% Concluído
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
