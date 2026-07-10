-- FinanceFlow — Schema PostgreSQL (Supabase)
-- Execute este script no SQL Editor do Supabase

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CARTÕES DE CRÉDITO
-- =============================================
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  brand VARCHAR(50) NOT NULL,          -- nubank, itau, bradesco, etc
  color VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
  limit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_day INT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  last_four_digits VARCHAR(4),
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FATURAS MENSAIS
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  total_amount DECIMAL(12,2) DEFAULT 0,
  closing_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, month, year)
);

-- =============================================
-- GASTOS / COMPRAS
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'outros',
  amount DECIMAL(12,2) NOT NULL,
  installment_current INT DEFAULT 1,
  installment_total INT DEFAULT 1,
  purchase_date DATE DEFAULT CURRENT_DATE,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RECEITAS
-- =============================================
CREATE TABLE IF NOT EXISTS revenues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'outros',
  amount DECIMAL(12,2) NOT NULL,
  received_date DATE DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence VARCHAR(20) CHECK (recurrence IN ('monthly', 'weekly', 'yearly')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- METAS DE POUPANÇA
-- =============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  deadline DATE,
  color VARCHAR(7) DEFAULT '#7c3aed',
  emoji VARCHAR(10) DEFAULT '🎯',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- APORTES NAS METAS
-- =============================================
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  note TEXT,
  contributed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONFIGURAÇÕES GLOBAIS
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações padrão
INSERT INTO settings (key, value) VALUES
  ('monthly_limit_global', '3000'),
  ('monthly_limit_per_card', 'false'),
  ('whatsapp_number', ''),
  ('currency', 'BRL'),
  ('timezone', 'America/Sao_Paulo')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_invoices_card_id ON invoices(card_id);
CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON invoices(month, year);
CREATE INDEX IF NOT EXISTS idx_expenses_invoice_id ON expenses(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_card_id ON expenses(card_id);
CREATE INDEX IF NOT EXISTS idx_expenses_purchase_date ON expenses(purchase_date);
CREATE INDEX IF NOT EXISTS idx_revenues_received_date ON revenues(received_date);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON goal_contributions(goal_id);

-- =============================================
-- FUNÇÃO: Atualizar total da fatura automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET total_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM expenses
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  )
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_invoice_total
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_invoice_total();

-- =============================================
-- FUNÇÃO: Atualizar valor atual da meta
-- =============================================
CREATE OR REPLACE FUNCTION update_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE goals
  SET 
    current_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM goal_contributions
      WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
    ),
    is_completed = (
      SELECT COALESCE(SUM(amount), 0) >= target_amount
      FROM goal_contributions
      WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
    )
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_goal_amount
AFTER INSERT OR DELETE ON goal_contributions
FOR EACH ROW EXECUTE FUNCTION update_goal_amount();

-- =============================================
-- INDEXES (Performance)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_expenses_card_purchase ON expenses(card_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_invoices_card_month_year ON invoices(card_id, month, year);
