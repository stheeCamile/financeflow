import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { parseInvoiceImage } from '../services/ai.js';

const router = express.Router();
router.use(authMiddleware);

// Usar multer em memória, já que só precisamos passar o buffer para a IA
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Limite 10MB
});

router.post('/invoice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const mimeType = req.file.mimetype;
    const base64Data = req.file.buffer.toString('base64');

    // Manda para a IA ler
    const expenses = await parseInvoiceImage(req.userId, base64Data, mimeType);
    
    // Retorna a lista extraída
    res.json({ expenses });
  } catch (err) {
    console.error('Erro no upload/parse da fatura:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar imagem da fatura' });
  }
});

export default router;
