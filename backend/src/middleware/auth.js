import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'financeflow-secret-dev-key-change-in-production';
const JWT_EXPIRES = '7d';

/**
 * Middleware de autenticação JWT
 * Injeta req.userId e req.user em todas as requisições autenticadas
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user   = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Gera um token JWT para um usuário
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export { JWT_SECRET };
