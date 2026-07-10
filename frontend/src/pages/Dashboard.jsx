import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, PointElement, LineElement, Filler, BarElement
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { dashboardApi } from '../services/api';
import { TrendingUp, TrendingDown, Wallet, CreditCard, AlertCircle, Sparkles, PiggyBank } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement);

const CATEGORY_COLORS = {
  alimentacao: '#f59e0b', transporte: '#06b6d4', saude: '#10b981',
  lazer: '#7c3aed', educacao: '#3b82f6', casa: '#6366f1',
  roupas: '#ec4899', outros: '#94a3b8',
};

const CATEGORY_LABELS = {
  alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde',
  lazer: 'Lazer', educacao: 'Educação', casa: 'Casa',
  roupas: 'Roupas', outros: 'Outros',
};

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function getLimitColor(percent) {
  if (percent >= 90) return 'red';
  if (percent >= 70) return 'amber';
  return 'green';
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function Dashboard() {
  const [summary, setSummary]     = useState(null);
  const [evolution, setEvolution] = useState([]);
  const [loading, setLoading]     = useState(true);
  
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear]   = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    setAiSummary(null);
    Promise.all([
      dashboardApi.getSummary({ month, year }),
      dashboardApi.getEvolution(),
    ]).then(([s, e]) => {
      setSummary(s);
      setEvolution(e);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  const handleFetchAi = async () => {
    setLoadingAi(true);
    try {
      const res = await dashboardApi.getAiSummary({ month, year });
      setAiSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  const limitPercent = parseFloat(summary?.limit_percent || 0);
  const limitColor   = getLimitColor(limitPercent);

  // Dados do gráfico de donut (categorias)
  const catLabels = summary?.categories?.map(c => CATEGORY_LABELS[c.category] || c.category) || [];
  const catValues = summary?.categories?.map(c => parseFloat(c.total)) || [];
  const catColors = summary?.categories?.map(c => CATEGORY_COLORS[c.category] || '#94a3b8') || [];

  const donutData = {
    labels: catLabels,
    datasets: [{ data: catValues, backgroundColor: catColors, borderWidth: 2, borderColor: '#111122' }],
  };

  // Dados do gráfico de linha (evolução)
  const lineLabels = evolution.map(e => `${MONTHS[e.month - 1]}/${String(e.year).slice(2)}`);
  const lineSpent  = evolution.map(e => parseFloat(e.total_spent));
  const lineRevenue = evolution.map(e => parseFloat(e.total_revenue));

  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: 'Gastos',
        data: lineSpent,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#7c3aed',
        pointRadius: 5,
      },
      {
        label: 'Receitas',
        data: lineRevenue,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.05)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Inter' } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Inter' }, callback: v => `R$ ${v}` } },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16 } },
    },
  };

  // Dados para o Gráfico de Barras: Receita vs Despesa
  const barData = {
    labels: ['Mês Atual'],
    datasets: [
      {
        label: 'Receitas',
        data: [summary?.total_revenue || 0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Despesas',
        data: [summary?.total_spent || 0],
        backgroundColor: '#7c3aed',
        borderRadius: 4,
      }
    ]
  };

  // Dados para Pagamentos (Crédito vs Débito)
  const paymentLabels = summary?.paymentMethods?.map(p => p.type === 'credit' ? 'Cartão de Crédito' : p.type === 'debit' ? 'Débito' : 'Conta/Pix') || [];
  const paymentValues = summary?.paymentMethods?.map(p => parseFloat(p.total)) || [];
  const paymentData = {
    labels: paymentLabels,
    datasets: [{ data: paymentValues, backgroundColor: ['#7c3aed', '#06b6d4', '#f59e0b'], borderWidth: 2, borderColor: '#111122' }],
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral das suas finanças</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            className="form-input" 
            value={month} 
            onChange={e => setMonth(parseInt(e.target.value))}
            style={{ minWidth: 120 }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select 
            className="form-input" 
            value={year} 
            onChange={e => setYear(parseInt(e.target.value))}
            style={{ minWidth: 100 }}
          >
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      {/* IA Summary Card */}
      <motion.div 
        className="card" 
        style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(124,58,237,0.2)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
              <Sparkles size={18} /> Resumo Semanal da IA
            </div>
            {aiSummary ? (
              <p style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Sua consultora financeira IA está pronta para analisar seus gastos deste mês e te dar dicas.
              </p>
            )}
          </div>
          {!aiSummary && (
            <button className="btn btn-primary" onClick={handleFetchAi} disabled={loadingAi} style={{ minWidth: 160 }}>
              {loadingAi ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '✨ Gerar Análise'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div className="stats-grid" variants={container} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="stat-card purple">
          <div className="stat-icon purple"><Wallet size={20} /></div>
          <div className="stat-value">{formatCurrency(summary?.total_spent)}</div>
          <div className="stat-label">Total gasto no mês</div>
        </motion.div>
        <motion.div variants={fadeUp} className="stat-card green">
          <div className="stat-icon green"><TrendingUp size={20} /></div>
          <div className="stat-value">{formatCurrency(summary?.total_revenue)}</div>
          <div className="stat-label">Receitas do mês</div>
        </motion.div>
        <motion.div variants={fadeUp} className={`stat-card ${summary?.balance >= 0 ? 'cyan' : 'red'}`}>
          <div className={`stat-icon ${summary?.balance >= 0 ? 'cyan' : 'red'}`}>
            {summary?.balance >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="stat-value">{formatCurrency(summary?.balance)}</div>
          <div className="stat-label">Saldo do mês</div>
        </motion.div>
        <motion.div variants={fadeUp} className={`stat-card ${limitColor}`}>
          <div className={`stat-icon ${limitColor}`}><AlertCircle size={20} /></div>
          <div className="stat-value">{limitPercent}%</div>
          <div className="stat-label">Do limite mensal usado</div>
        </motion.div>
        <motion.div variants={fadeUp} className="stat-card cyan">
          <div className="stat-icon cyan"><PiggyBank size={20} /></div>
          <div className="stat-value">{formatCurrency(summary?.total_net_worth)}</div>
          <div className="stat-label">Patrimônio Total</div>
        </motion.div>
      </motion.div>

      {/* Limite mensal */}
      {summary?.monthly_limit > 0 && (
        <motion.div
          className="card"
          style={{ marginBottom: 24 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Limite Mensal Global</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatCurrency(summary.total_spent)} de {formatCurrency(summary.monthly_limit)} utilizados
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: limitPercent >= 90 ? 'var(--red)' : limitPercent >= 70 ? 'var(--amber)' : 'var(--green)' }}>
              {limitPercent}%
            </div>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${limitColor}`}
              style={{ width: `${Math.min(limitPercent, 100)}%` }}
            />
          </div>
          {limitPercent >= 90 && (
            <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
              ⚠️ Atenção! Você está quase no limite mensal!
            </div>
          )}
        </motion.div>
      )}

      {/* Gráficos */}
      <div className="charts-grid">
        {/* Donut - Categorias */}
        <div className="chart-card">
          <div className="chart-title">Gastos por Categoria</div>
          {catValues.length > 0 ? (
            <div style={{ height: 280 }}>
              <Doughnut data={donutData} options={donutOptions} />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon">📊</div>
              <p className="empty-state-text">Nenhum gasto registrado ainda</p>
            </div>
          )}
        </div>

        {/* Linha - Evolução */}
        <div className="chart-card">
          <div className="chart-title">Evolução dos Últimos Meses</div>
          {evolution.length > 0 ? (
            <div style={{ height: 280 }}>
              <Line data={lineData} options={chartOptions} />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon">📈</div>
              <p className="empty-state-text">Dados insuficientes para exibir a evolução</p>
            </div>
          )}
        </div>

        {/* Barra - Receitas vs Despesas */}
        <div className="chart-card">
          <div className="chart-title">Receitas vs Despesas</div>
          <div style={{ height: 280 }}>
            <Bar 
              data={barData} 
              options={{
                ...chartOptions,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter' }, padding: 16 } } }
              }} 
            />
          </div>
        </div>

        {/* Donut - Meios de Pagamento */}
        <div className="chart-card">
          <div className="chart-title">Meios de Pagamento</div>
          {paymentValues.length > 0 ? (
            <div style={{ height: 280 }}>
              <Doughnut data={paymentData} options={donutOptions} />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <CreditCard size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
              <p className="empty-state-text">Sem dados de pagamento</p>
            </div>
          )}
        </div>
      </div>

      {/* Seção inferior: Cartões + Faturas + Metas */}
      <div className="grid-2" style={{ gap: 24 }}>
        {/* Gastos por Cartão */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="chart-title">Gastos por Cartão</div>
          {summary?.cards?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {summary.cards.map(c => {
                const pct = c.limit_amount > 0 ? Math.min((parseFloat(c.spent) / parseFloat(c.limit_amount)) * 100, 100) : 0;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(c.spent)}</span>
                        {c.limit_amount > 0 && <span>de {formatCurrency(c.limit_amount)}</span>}
                      </div>
                    </div>
                    {c.limit_amount > 0 && (
                      <div className="progress-track">
                        <div className={`progress-fill ${getLimitColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <CreditCard size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
              <p className="empty-state-text">Nenhum cartão cadastrado</p>
            </div>
          )}
        </motion.div>

        {/* Próximas Faturas + Metas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Próximas Faturas */}
          <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div className="chart-title">Próximas Faturas</div>
            {summary?.upcoming_invoices?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.upcoming_invoices.map(inv => {
                  const days = Math.ceil((new Date(inv.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--bg-border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.card_name}</div>
                        <div style={{ fontSize: 12, color: days <= 3 ? 'var(--red)' : 'var(--text-secondary)' }}>
                          {days <= 0 ? 'Vencida!' : `Vence em ${days} dia${days !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(inv.total_amount)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma fatura para os próximos 30 dias</p>
            )}
          </motion.div>

          {/* Metas */}
          <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="chart-title">Metas de Poupança</div>
            {summary?.goals?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {summary.goals.map(g => (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{g.emoji}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {parseFloat(g.progress_percent || 0).toFixed(0)}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill purple" style={{ width: `${Math.min(parseFloat(g.progress_percent || 0), 100)}%` }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma meta criada ainda</p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
