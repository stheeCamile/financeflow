-- =============================================
-- MIGRATION: Adicionar autenticação e multi-usuário
-- Execute no SQL Editor do Supabase APÓS o migrations.sql inicial
-- =============================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar user_id nas tabelas principais
ALTER TABLE cards    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE goals    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Settings agora é por usuário (e mantém config global sem user_id)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Remover a constraint UNIQUE antiga de settings (key) e criar nova composta
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE settings ADD CONSTRAINT settings_key_user_unique UNIQUE (key, user_id);

-- Índices para performance nas buscas por user_id
CREATE INDEX IF NOT EXISTS idx_cards_user_id    ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_user_id ON revenues(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id    ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Remover as configurações globais antigas sem user_id (já não fazem sentido)
DELETE FROM settings WHERE user_id IS NULL;
