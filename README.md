# 🚀 Multi LLM Chat Platform

<p align="center">
  <img src="./assets/screenshot1.png" width="900" />
</p>

A full-stack **multi-provider AI chat application** that allows you to interact with multiple LLM providers from a single unified interface — with per-user authentication, isolated chat history, and a premium subscription tier.

---

## 🌐 Live

**Available on:**  
👉 [https://multillm.net/](https://multillm.net/)

---

This project combines:

- ⚡ A streaming FastAPI backend (Dockerized)
- 🎨 A premium Next.js frontend
- 🗄 PostgreSQL persistence
- 🔐 Firebase Authentication (Google OAuth + Email/Password)
- 🐳 Dockerized backend environment
- 🔁 Multi-chat session management per user
- 🧠 Dynamic model/provider routing
- 💳 Premium billing via Polar (polar.sh)
- 🔍 Real-time Deep Search via Tavily (premium)

---

# ✨ What This Project Does

The platform allows users to:

- Sign in via **Google OAuth** or **Email/Password** (Firebase Auth)
- Chat with multiple AI providers (OpenAI, Anthropic, Groq, OpenRouter, Gemini)
- Stream responses token-by-token in real time
- Manage multiple chat sessions **isolated per user**
- Delete and share chats
- Switch models per conversation
- Render Markdown (GFM support)
- Copy responses with animated feedback
- Use a collapsible sidebar UI
- Persist conversations in PostgreSQL **scoped to authenticated user**
- Upload and analyze **files and images** (PDFs, code, screenshots)
- Use **Deep Search** to ground any model with live web results (premium)
- Subscribe to **Premium** for advanced models, higher limits, and exclusive features

This is a production-style architecture, not just a demo chatbot.

---

# 🏗 Project Structure

```text
multi-llm-platform/
│
├── apps/
│   ├── api/                        # FastAPI backend (Dockerized)
│   │   ├── main.py
│   │   ├── polar_billing.py        # Polar subscription billing
│   │   ├── user_service.py
│   │   ├── clients.py              # Provider SDK clients
│   │   ├── services/
│   │   │   └── web_search_client.py  # Tavily Deep Search
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── ...
│   │
│   └── web/                        # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx        # Main chat page
│       │   │   ├── premium/        # Upgrade + cancel flows
│       │   │   └── pricing/        # Public pricing page
│       │   └── components/
│       │       └── chat/
│       │           └── Composer.tsx  # Input + Deep Search toggle
│       ├── package.json
│       └── ...
│
├── .gitignore
└── README.md
```

---

# 🔐 Authentication — Firebase

Authentication is handled by **Firebase Auth** on the frontend. The backend verifies identity server-side using the **Firebase Admin SDK**.

## Auth Flow

1. User signs in via Google OAuth or Email/Password on the frontend
2. Firebase issues a **JWT ID token** on the client
3. The frontend attaches the token to every API request (`Authorization: Bearer <token>`)
4. The FastAPI backend verifies the token using the Firebase Admin SDK
5. All DB queries are scoped to the verified `user_id` — chats are fully isolated per user

## Supported Providers

- 🔵 **Google OAuth** — one-click sign-in
- 📧 **Email + Password** — standard registration/login

---

# 🖥 Frontend — Next.js 16 + React 19

The frontend is built using modern React architecture and runs locally during development.

## 📦 Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Firebase SDK (Auth)
- React Markdown + remark-gfm
- Fetch API with SSE streaming
- Custom animated UI components

## ✨ Frontend Features

- Firebase Auth (Google + Email/Password)
- JWT token forwarded to backend on every request
- Collapsible sidebar with chat search
- Streaming token rendering
- Model selector dropdown with tier picker
- File & image upload (drag-and-drop supported)
- **Deep Search toggle** — visible to all users, active for Premium
- Copy / Retry / Edit / Share per message
- Token counter per conversation
- Chat sharing via public link
- Premium upgrade + cancel flows
- Responsive dark UI

---

## ▶️ Frontend Installation

```bash
cd apps/web
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:3000
```

> The frontend is NOT containerized. It runs using the Next.js dev server.

---

# ⚙️ Backend — FastAPI (Dockerized)

The backend handles:

- Firebase ID token verification (Admin SDK)
- Per-user chat session management
- Message persistence scoped to `user_id`
- Provider routing across 5 providers
- Streaming responses (SSE)
- File-aware and image-aware prompt building
- **Deep Search** — Tavily web search injected into any model's context (premium-gated)
- Premium billing via Polar webhooks
- Subscription cancel / reactivate endpoints

---

## 📦 Backend Tech Stack

- Python 3.12
- FastAPI + Uvicorn
- SQLAlchemy (Async) + asyncpg
- PostgreSQL
- firebase-admin (Python SDK)
- OpenAI SDK
- Anthropic SDK
- Google GenAI SDK
- tavily-python
- httpx
- python-dotenv
- Pydantic v2

---

# 🔍 Deep Search (Premium)

Deep Search lets users ground any AI model with live web results — regardless of provider.

**How it works:**

1. User toggles **Search** in the composer (Premium only)
2. The user's message is sent to **Tavily** (`search_depth=advanced`)
3. Search results are formatted and injected into the system prompt
4. The selected model (GPT, Claude, Gemini, Grok, etc.) answers using real-time context
5. The model cites sources in its response

This works across **all providers** — not just Anthropic — because the search context is injected at the prompt level, not via a tool call.

---

# 💳 Premium Billing — Polar

Billing is handled by **Polar** (polar.sh), which supports AI/chatbot products and Israeli payouts via Stripe Connect.

**Plans:**
- Monthly — $5/month
- Yearly — $3.50/month (billed at $42/year, save 30%)

**Premium features:**
- All AI models (OpenAI, Claude, Gemini, Grok, DeepSeek, Mistral, Llama)
- Deep Search — real-time web on any model
- File & image uploads
- 8,192 token context window (4× free)
- Higher usage limits

**Webhook events handled:**
- `subscription.active` → grant premium
- `subscription.canceled` → access continues until period end
- `subscription.revoked` → revoke premium
- `subscription.updated` → sync status

---

# 🐳 Backend Docker Setup

```bash
cd apps/api
docker build -t mlm-backend .
docker run -p 8000:8000 --env-file .env mlm-backend
```

Backend available at `http://localhost:8000`

---

## 🔐 Environment Variables

### Frontend — `apps/web/.env.local`

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend — `apps/api/.env`

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

FIREBASE_SERVICE_ACCOUNT_JSON=./secrets/firebase-sa.json

OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GEMINI_API_KEY=your_key
OPENROUTER_API_KEY=your_key
GROQ_API_KEY=your_key
TAVILY_API_KEY=your_key

POLAR_ACCESS_TOKEN=your_key
POLAR_WEBHOOK_SECRET=your_key
POLAR_MONTHLY_PRODUCT_ID=your_product_id
POLAR_YEARLY_PRODUCT_ID=your_product_id
POLAR_ENV=production

FRONTEND_URL=https://multillm.net
```

---

# 🗄 Database

PostgreSQL with async SQLAlchemy. Tables include:

- `users` — Firebase UID, premium status, subscription ID, usage counters
- `chats` — linked to `user_id`, model, title, share token
- `messages` — linked to `chat_id`, role, content

All queries are filtered by the authenticated `user_id`.

---

# 🔁 Streaming Architecture

### Backend
- Async generators (`yield`) per provider
- Normalizes OpenAI, Anthropic, Gemini, Groq, OpenRouter streaming APIs
- Flushes to DB progressively during streaming

### Frontend
- `ReadableStream` + SSE parsing
- Appends tokens live to UI
- Handles `status`, `done`, `error` event types

---

# 🧠 Provider Routing

Models use a `provider:model_name` prefix:

```
openai:gpt-5
anthropic:claude-sonnet-4-6
gemini:models/gemini-2.5-pro
groq:llama-3.3-70b-versatile
openrouter:x-ai/grok-4.3
openrouter:deepseek/deepseek-chat
```

The backend parses the provider prefix and initializes the correct SDK client.

---

# 🛠 Development Requirements

- Node 18+
- Python 3.11+ (3.12 recommended)
- Docker (for backend)
- PostgreSQL instance (local or remote)
- Firebase project with Auth enabled
- Polar account (for billing)
- Tavily account (for Deep Search)

---

# 🚀 Production Deployment

### Frontend → Vercel
Add all `NEXT_PUBLIC_*` vars to Vercel environment settings.

### Backend → Railway / Render / Fly.io
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
Inject all `.env` secrets via platform secret manager.

---

# 👨‍💻 Author

Built by **Eliachar Feig**  
Senior Mobile & Full-Stack Engineer  
iOS · Flutter · React · AI Systems · Architecture-first development

🌐 [eliacharfeig.com](https://www.eliacharfeig.com/)

---

# 📄 License

MIT License

---

# ⭐ Summary

This project demonstrates:

- Firebase Auth with per-user chat isolation
- Multi-provider LLM abstraction
- Streaming architecture
- Full-stack separation
- Production-style backend design
- Modern TypeScript + Python integration
- Clean and scalable AI chat foundation

<p align="center">
  <img src="./assets/screenshot2.png" width="900" />
</p>
