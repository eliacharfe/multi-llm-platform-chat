# 🚀 Multi LLM Chat Platform

<p align="center">
  <img src="./assets/screenshot1.png" width="900" />
</p>

A full-stack **multi-provider AI chat application** that allows you to interact with multiple LLM providers from a single unified interface — with per-user authentication and isolated chat history.

---

## 🌐 Live Demo

**Available on:**  
👉 https://multi-llm-platform-premium.vercel.app/

---

This project combines:

- ⚡ A streaming FastAPI backend (Dockerized)
- 🎨 A premium Next.js frontend
- 🗄 PostgreSQL persistence
- 🔐 Firebase Authentication (Google OAuth + Email/Password)
- 🐳 Dockerized backend environment
- 🔁 Multi-chat session management per user
- 🧠 Dynamic model/provider routing

---

# ✨ What This Project Does

The platform allows users to:

- Sign in via **Google OAuth** or **Email/Password** (Firebase Auth)
- Chat with multiple AI providers (OpenAI, Anthropic, Groq, OpenRouter, Gemini)
- Stream responses token-by-token in real time
- Manage multiple chat sessions **isolated per user**
- Delete chats (persisted in DB)
- Switch models per conversation
- Render Markdown (GFM support)
- Copy responses with animated feedback
- Use a collapsible sidebar UI
- Persist conversations in PostgreSQL **scoped to authenticated user**

This is a production-style architecture, not just a demo chatbot.

---

# 🏗 Project Structure

```text
multi-llm-platform/
│
├── apps/
│   ├── api/              # FastAPI backend (Dockerized)
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   ├── secrets/
│   │   │   └── firebase-sa.json   # Firebase service account (not committed)
│   │   └── ...
│   │
│   └── web/              # Next.js frontend
│       ├── src/
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
- React Markdown
- remark-gfm
- Fetch API with streaming
- Custom animated UI components

## ✨ Frontend Features

- Firebase Auth (Google + Email/Password)
- Protected routes (redirect to login if unauthenticated)
- JWT token forwarded to backend on every request
- Collapsible sidebar
- Chat previews per user
- Streaming token rendering
- Model selector dropdown
- Copy button with animated "Copied" state
- Premium dark UI
- Responsive layout
- Markdown rendering (GFM support)

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
- Provider routing
- Streaming responses (SSE-compatible)
- File-aware prompt building
- Temperature control
- Provider-specific SDK handling

---

## 📦 Backend Tech Stack

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy (Async)
- asyncpg
- PostgreSQL
- firebase-admin (Python SDK)
- OpenAI SDK
- Anthropic SDK
- Google GenAI SDK
- httpx
- python-dotenv
- Pydantic v2

---

# 🐳 Backend Docker Setup

The backend is containerized using Docker.

## 🔹 Build the Image

```bash
cd apps/api
docker build -t mlm-backend .
```

## 🔹 Run the Container

```bash
docker run -p 8000:8000 --env-file .env mlm-backend
```

Backend will be available at:

```
http://localhost:8000
```

---

## 🔐 Environment Variables

### Frontend — `apps/web/.env.local`

> `NEXT_PUBLIC_*` variables are exposed to the browser by Next.js.  
> The Firebase Web API key is **not a secret**, but it **must be restricted** in Google Cloud (HTTP referrers + API restrictions).

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

## Backend — `apps/api/.env`

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

FIREBASE_SERVICE_ACCOUNT_JSON=./secrets/firebase-sa.json

OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
OPENROUTER_API_KEY=your_key
GROQ_API_KEY=your_key
```

> ⚠️ The `secrets/firebase-sa.json` file is **never committed**. Download it from the Firebase Console under **Project Settings → Service Accounts → Generate new private key**.

---

# 🗄 Database

The backend connects to a PostgreSQL database using async SQLAlchemy.

Example connection string:

```
postgresql+asyncpg://mlm:mlm@localhost:5433/mlm
```

Tables typically include:

- `users` — Firebase UID + optional metadata
- `chats` — linked to `user_id`
- `messages` — linked to `chat_id`
- `created_at` / `updated_at` timestamps
- model metadata per chat

All queries are filtered by the authenticated `user_id` — no user can access another user's chats.

---

# 🔁 Streaming Architecture

### Backend

- Uses async generators (`yield`)
- Streams provider tokens progressively
- Normalizes provider-specific streaming APIs

### Frontend

- Uses `ReadableStream`
- Appends tokens live to UI
- Maintains reactive state updates

---

# 🧠 Provider Routing

Models are selected dynamically using a prefix pattern:

```
provider:model_name
```

Examples:

```
openai:gpt-5
anthropic:claude-sonnet-4-6
groq:llama-3.3-70b-versatile
openrouter:mistralai/mistral-large-2512
```

The backend parses the provider prefix and initializes the correct SDK client.

---

# 🛠 Development Requirements

- Node 18+
- Python 3.11+ (3.12 recommended)
- Docker (for backend)
- PostgreSQL instance (local or remote)
- Firebase project with Auth enabled (Google + Email/Password providers)

Make sure:

- No port conflicts (3000 / 8000)
- Only one `next dev` instance is running
- `.env` / `.env.local` files exist for both frontend and backend
- `secrets/firebase-sa.json` is placed in `apps/api/secrets/` and is gitignored

---

# 🚀 Production Considerations

### Frontend

- Can be deployed to Vercel
- Add all `NEXT_PUBLIC_FIREBASE_*` vars to Vercel environment settings
- Or self-hosted with `next build` and `next start`

### Backend

- Can be deployed using Docker to:
  - VPS
  - Railway
  - Render
  - Fly.io
  - Kubernetes
- Inject `FIREBASE_SERVICE_ACCOUNT_JSON` as a secret (or mount the file via volume)

Production run example:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

# 🔮 Future Enhancements

- Rate limiting per user
- Redis caching
- Vector database (RAG)
- Tool calling support
- File upload UI
- Chat export (Markdown / PDF)
- Cost tracking per model
- Multi-modal support

---

# 👨‍💻 Author

Built by **Eliachar Feig**  
Senior Mobile & Product Engineer  
iOS · Flutter · AI Systems · Architecture-first development

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
