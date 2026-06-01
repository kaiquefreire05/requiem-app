# Requiem Backend

Backend simples para o Requiem App com autenticação de usuários e histórico de sessões.

## Stack

- **Runtime**: Node.js + Express
- **ORM**: Prisma
- **Banco de dados**: PostgreSQL (Docker)
- **Auth**: JWT + bcrypt

## Estrutura

```
backend/
├── prisma/
│   └── schema.prisma     # Schema do banco (User, ChatSession, Message)
├── src/
│   ├── index.js          # Entry point
│   ├── lib/
│   │   └── jwt.js        # Utilitários JWT
│   ├── middleware/
│   │   └── auth.js       # Middleware de autenticação
│   └── routes/
│       ├── auth.js       # POST /login, /register, GET /me
│       └── sessions.js   # CRUD de sessões + mensagens
└── .env                  # Variáveis de ambiente
```

## Como rodar

### 1. Subir o PostgreSQL (Docker)

```bash
# Na raiz do projeto (requiem-app/)
docker compose up -d
```

### 2. Instalar dependências do backend

```bash
cd backend
npm install
```

### 3. Sincronizar o schema com o banco

```bash
npx prisma db push
```

### 4. Iniciar o servidor

```bash
npm run dev   # desenvolvimento (nodemon)
npm start     # produção
```

O servidor roda em `http://localhost:3001`

## Endpoints

### Auth
- `POST /api/auth/register` — Criar conta
- `POST /api/auth/login` — Fazer login
- `GET  /api/auth/me` — Dados do usuário logado (requer token)

### Sessões
- `GET    /api/sessions` — Listar sessões do usuário
- `POST   /api/sessions` — Criar nova sessão
- `GET    /api/sessions/:id` — Sessão + mensagens
- `PATCH  /api/sessions/:id` — Renomear sessão
- `DELETE /api/sessions/:id` — Excluir sessão
- `POST   /api/sessions/:id/messages` — Adicionar mensagem

Todos os endpoints de sessão requerem `Authorization: Bearer <token>`.
