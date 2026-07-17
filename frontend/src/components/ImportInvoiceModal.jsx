import { useState, useRef } from 'react';
import { UploadCloud, Check, X, Edit2, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';
import { importApi, expensesApi } from '../services/api';

const CATEGORY_LABELS = {
  moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte',
  saude: 'Saúde', educacao: 'Educação', lazer: 'Lazer', compras: 'Compras',
  assinaturas: 'Assinaturas', outros: 'Outros'
};

export default function ImportInvoiceModal({ isOpen, onClose, cardId, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('upload'); // 'upload' | 'review'
  const [expenses, setExpenses] = useState([]);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcessImage = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importApi.uploadInvoice(file);
      if (res.expenses && res.expenses.length > 0) {
        setExpenses(res.expenses);
        setStep('review');
        toast.success(`Foram encontrados ${res.expenses.length} gastos!`);
      } else {
        toast.info('Não foi possível identificar nenhum gasto nesta imagem.');
      }
    } catch (err) {
      toast.error('Erro ao ler imagem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (expenses.length === 0) return;
    setLoading(true);
    try {
      await expensesApi.bulk({ card_id: cardId, expenses });
      toast.success('Importação concluída com sucesso!');
      onImportSuccess();
      handleClose();
    } catch (err) {
      toast.error('Erro ao salvar no banco: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateExpense = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const removeExpense = (index) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setFile(null);
    setExpenses([]);
    setStep('upload');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importação Inteligente com IA">
      {step === 'upload' && (
        <div style={{ padding: 20 }}>
          <p style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>
            Faça upload do extrato ou fatura (PNG, JPG ou PDF). A IA vai extrair todos os gastos para você não precisar digitar nada!
          </p>
          
          <div 
            style={{ 
              border: '2px dashed var(--bg-border)', 
              borderRadius: 'var(--radius-lg)', 
              padding: 40, 
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg-input)'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={48} color="var(--primary)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{file ? file.name : 'Clique ou arraste a imagem aqui'}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Formatos aceitos: JPG, PNG, PDF
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*,application/pdf"
              onChange={handleFileChange}
            />
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary" 
              disabled={!file || loading}
              onClick={handleProcessImage}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'Analisar Fatura com IA'}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Revisão dos gastos identificados. Verifique se as categorias estão corretas e ajuste o que for necessário antes de salvar.
            </p>
          </div>

          <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Categoria</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => (
                  <tr key={idx}>
                    <td>
                      <input 
                        type="date" 
                        value={exp.date} 
                        onChange={(e) => updateExpense(idx, 'date', e.target.value)} 
                        style={{ border: '1px solid var(--bg-border)', borderRadius: 4, padding: 4 }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={exp.description} 
                        onChange={(e) => updateExpense(idx, 'description', e.target.value)}
                        style={{ border: '1px solid var(--bg-border)', borderRadius: 4, padding: 4, width: '100%' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        step="0.01"
                        value={exp.amount} 
                        onChange={(e) => updateExpense(idx, 'amount', e.target.value)}
                        style={{ border: '1px solid var(--bg-border)', borderRadius: 4, padding: 4, width: 80 }}
                      />
                    </td>
                    <td>
                      <select 
                        value={exp.category} 
                        onChange={(e) => updateExpense(idx, 'category', e.target.value)}
                        style={{ border: '1px solid var(--bg-border)', borderRadius: 4, padding: 4 }}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeExpense(idx)}>
                        <Trash2 size={16} color="var(--red)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bg-border)' }}>
            <div style={{ fontWeight: 700, alignSelf: 'center' }}>
              Total: R$ {expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep('upload')} disabled={loading}>Voltar</button>
              <button className="btn btn-primary" onClick={handleConfirmImport} disabled={loading || expenses.length === 0}>
                {loading ? 'Salvando...' : <><Check size={16} /> Confirmar e Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
