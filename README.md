# 🚀 Multi LLM Chat Platform

<p align="center">
  <img src="./assets/screenshot.png" width="900" />
</p>

A full-stack **multi-provider AI chat application** that allows you to interact with multiple LLM providers from a single unified interface.

This project combines:

- ⚡ A streaming FastAPI backend (Dockerized)
- 🎨 A premium Next.js frontend
- 🗄 PostgreSQL persistence
- 🐳 Dockerized backend environment
- 🔁 Multi-chat session management
- 🧠 Dynamic model/provider routing

---

# ✨ What This Project Does

The platform allows users to:

- Chat with multiple AI providers (OpenAI, Anthropic, Groq, OpenRouter, Gemini)
- Stream responses token-by-token in real time
- Manage multiple chat sessions
- Delete chats (persisted in DB)
- Switch models per conversation
- Render Markdown (GFM support)
- Copy responses with animated feedback
- Use a collapsible sidebar UI
- Persist conversations in PostgreSQL

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

# 🖥 Frontend — Next.js 16 + React 19

The frontend is built using modern React architecture and runs locally during development.

## 📦 Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- React Markdown
- remark-gfm
- Fetch API with streaming
- Custom animated UI components

## ✨ Frontend Features

- Collapsible sidebar
- Chat previews
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

- Chat session management
- Message persistence
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

# 🔐 Environment Variables

Create a `.env` file inside `apps/api`:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
OPENROUTER_API_KEY=your_key
GROQ_API_KEY=your_key
```

---

# 🗄 Database

The backend connects to a PostgreSQL database using async SQLAlchemy.

Example connection string:

```
postgresql+asyncpg://mlm:mlm@localhost:5433/mlm
```

Tables typically include:

- chats
- messages
- created_at / updated_at timestamps
- model metadata per chat

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

Make sure:

- No port conflicts (3000 / 8000)
- Only one `next dev` instance is running
- `.env` file exists for backend

---

# 🚀 Production Considerations

### Frontend

- Can be deployed to Vercel
- Or self-hosted with `next build` and `next start`

### Backend

- Can be deployed using Docker to:
  - VPS
  - Railway
  - Render
  - Fly.io
  - Kubernetes

Production run example:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```


---

# 🔮 Future Enhancements

- Authentication & per-user isolation
- Rate limiting
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

- Multi-provider LLM abstraction
- Streaming architecture
- Full-stack separation
- Production-style backend design
- Modern TypeScript + Python integration
- Clean and scalable AI chat foundation