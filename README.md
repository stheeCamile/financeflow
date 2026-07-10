# FinanceFlow 💸

Sistema de gestão financeira pessoal full-stack com React + Node.js + PostgreSQL e bot WhatsApp.

## 📦 Estrutura

```
financeiro/
├── frontend/   # React + Vite (deploy: Vercel)
└── backend/    # Node.js + Express (deploy: Render.com)
```

---

## 🚀 Como rodar localmente

### 1. Banco de Dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) (gratuito)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute os scripts em ordem:
   - `backend/src/db/migrations.sql` — schema principal
   - `backend/src/db/migration_auth.sql` — tabela de usuários e autenticação
4. Copie a **Connection String** em: Settings → Database → Connection string → URI

### 2. Backend

```bash
cd backend
copy .env.example .env
# Edite o .env com:
# - DATABASE_URL do Supabase
# - JWT_SECRET (gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
npm install
npm run dev
# API rodando em http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App rodando em http://localhost:5173
```

---

## ☁️ Deploy Gratuito

### Frontend → Vercel

1. Suba o código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) → "New Project"
3. Importe o repositório e configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Adicione a variável de ambiente:
   - `VITE_API_URL` = `https://SEU-BACKEND.onrender.com/api`
5. Clique em Deploy ✅

### Backend → Render.com

1. Acesse [render.com](https://render.com) → "New Web Service"
2. Conecte o repositório GitHub
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Adicione as variáveis de ambiente:
   - `DATABASE_URL` = connection string do Supabase
   - `FRONTEND_URL` = URL do seu app no Vercel
   - `NODE_ENV` = `production`
5. Clique em Deploy ✅

---

## 📱 Bot WhatsApp

1. Inicie o backend
2. Acesse a aba **WhatsApp** no app
3. Clique em "Conectar WhatsApp"
4. Escaneie o QR Code com o celular (WhatsApp → Aparelhos conectados)
5. Pronto! Envie mensagens como:
   - `gastei 150 com mercado no nubank`
   - `paguei 89,90 de gasolina no itau em 3x`
   - `recebi 3000 salário`

---

## 🗂️ Funcionalidades

| Módulo | Descrição |
|---|---|
| 💳 Cartões | Cadastro, faturas mensais, compras à vista e parceladas |
| 💰 Receitas | Salários, freelances, receitas recorrentes |
| 🎯 Metas | Objetivos com progresso e aportes |
| 📊 Dashboard | Gráficos, limite mensal, alertas visuais |
| 📱 WhatsApp | Registro rápido via mensagem + resposta automática |

---

## 🛠️ Stack

- **Frontend**: React 18 + Vite + React Router + Framer Motion + Chart.js
- **Backend**: Node.js + Express + PostgreSQL (via `pg`)
- **Banco**: Supabase (PostgreSQL gerenciado, free tier)
- **WhatsApp**: @whiskeysockets/baileys (conexão leve, sem Puppeteer)
- **Deploy**: Vercel (frontend) + Render.com (backend)
