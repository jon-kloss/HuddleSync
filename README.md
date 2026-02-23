# HuddleSync

AI-Powered Team Huddle Recorder & Summarizer. Record your team standups in the browser, automatically detect who's speaking, transcribe the conversation in real time, and generate per-person summaries with action items.

## Architecture

- **Web Frontend**: React 19 + Vite + React Router, Zustand state management
- **Backend**: Node.js + Express + Socket.IO, TypeScript
- **Database**: PostgreSQL 16 (via Prisma ORM)
- **Diarization Service**: Python FastAPI microservice using pyannote.audio
- **AI Pipeline**: pyannote.audio (speaker diarization) + OpenAI Whisper (speech-to-text) + Anthropic Claude (summarization)

### How It Works

1. The browser captures microphone audio using the MediaRecorder API and sends 5-second chunks over WebSocket to the backend
2. The backend forwards each chunk to two services in parallel:
   - **OpenAI Whisper** for speech-to-text transcription
   - **Diarization microservice** for speaker identification
3. Transcription results are merged with speaker labels and streamed back to the browser in real time
4. After every few chunks, **Anthropic Claude** generates an incremental summary of the meeting so far
5. When the session ends, Claude generates a final comprehensive summary with per-speaker updates, blockers, and action items

## Prerequisites

- [Node.js 20+](https://nodejs.org/) (see `.nvmrc`)
- [Docker](https://www.docker.com/) and Docker Compose
- [Python 3.11+](https://www.python.org/) and [ffmpeg](https://ffmpeg.org/) (for local diarization service)
- API keys for:
  - [OpenAI](https://platform.openai.com/) (Whisper transcription)
  - [Anthropic](https://console.anthropic.com/) (Claude summarization)
  - [Hugging Face](https://huggingface.co/) (pyannote.audio model access)

### HuggingFace Model Access

The diarization service uses gated models that require license acceptance. Before running it, visit these pages and accept the license agreements while logged into your HuggingFace account:

- https://huggingface.co/pyannote/speaker-diarization-3.1
- https://huggingface.co/pyannote/segmentation-3.0
- https://huggingface.co/pyannote/embedding

Then create an access token at https://huggingface.co/settings/tokens.

## Project Structure

```
HuddleSync/
├── backend/                         # Node.js API server
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (7 models)
│   │   └── migrations/              # Database migrations
│   ├── src/
│   │   ├── config/                  # Environment config
│   │   ├── middleware/              # Auth (JWT), validation (Zod), error handling
│   │   ├── pipelines/              # AI pipeline services
│   │   │   ├── diarization.ts      # Speaker diarization client
│   │   │   ├── transcription.ts    # Whisper API client
│   │   │   ├── summarization.ts    # Claude summarization
│   │   │   └── orchestrator.ts     # Pipeline coordinator
│   │   ├── routes/                 # REST API endpoints
│   │   │   ├── auth.ts             # Register, login, token refresh
│   │   │   ├── teams.ts            # Team CRUD, member management
│   │   │   ├── sessions.ts         # Huddle session lifecycle
│   │   │   └── users.ts            # Profile, voice enrollment
│   │   ├── services/               # Prisma client
│   │   ├── websocket/              # Socket.IO real-time audio handling
│   │   └── index.ts                # Server entry point
│   └── package.json
├── web/                             # React SPA frontend
│   ├── src/
│   │   ├── components/             # Shared components (Layout, ProtectedRoute)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # Sign in
│   │   │   ├── RegisterPage.tsx    # Create account
│   │   │   ├── DashboardPage.tsx   # Team dashboard, start huddle
│   │   │   ├── SessionPage.tsx     # Live recording session
│   │   │   └── SummaryPage.tsx     # Per-speaker summary + combined view
│   │   ├── services/
│   │   │   ├── api.ts              # Axios HTTP client with token refresh
│   │   │   ├── websocket.ts        # Socket.IO client
│   │   │   └── audio.ts            # MediaRecorder audio capture
│   │   ├── stores/                 # Zustand state (auth, session)
│   │   ├── types.ts                # Shared TypeScript types
│   │   ├── config.ts               # Frontend config
│   │   ├── App.tsx                 # Router + auth initialization
│   │   └── App.css                 # Global styles
│   ├── vite.config.ts              # Vite config with API proxy
│   └── package.json
├── diarization/                     # Python speaker diarization microservice
│   ├── main.py                     # FastAPI app (/diarize, /enroll, /health)
│   ├── diarize_engine.py           # pyannote.audio pipeline wrapper
│   ├── audio_utils.py              # WebM/Opus → WAV conversion (pydub + ffmpeg)
│   ├── speaker_store.py            # Speaker embedding storage
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Container image
│   └── .env.example                # Environment variables
├── docker-compose.yml               # PostgreSQL + Redis + Diarization
├── package.json                     # Workspace root (npm workspaces)
└── .nvmrc                           # Node 20
```

## Getting Started

### 1. Clone and install dependencies

```bash
cd HuddleSync
nvm use          # switch to Node 20
npm install      # installs backend/ and web/ workspaces
```

### 2. Start the databases

```bash
docker-compose up -d postgres redis
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 3. Configure environment variables

**Backend:**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://huddlesync:huddlesync_dev@localhost:5432/huddlesync

# Auth
JWT_SECRET=<generate-a-random-secret>
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# API Keys
WHISPER_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Diarization service
DIARIZATION_SERVICE_URL=http://localhost:8000

# CORS (must match Vite dev server)
CORS_ORIGIN=http://localhost:5173
```

**Diarization service:**

```bash
cp diarization/.env.example diarization/.env
```

Edit `diarization/.env`:

```env
HF_TOKEN=<your-huggingface-token>
```

### 4. Run database migrations

```bash
cd backend
npx prisma migrate dev
```

This creates all database tables and generates the Prisma client.

### 5. Start the diarization service

**Option A: Run locally (requires Python 3.11+ and ffmpeg)**

```bash
cd diarization
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The first startup takes 30-60 seconds while pyannote models are downloaded and loaded.

Verify it's running:

```bash
curl http://localhost:8000/health
```

**Option B: Run via Docker**

```bash
docker-compose up -d diarization
```

Note: The Docker build downloads ~2GB of ML models. Set `HF_TOKEN` in your shell environment or a `.env` file at the project root.

### 6. Start the backend + frontend

From the project root:

```bash
npm run dev
```

This runs both concurrently:
- **Backend** on `http://localhost:3001` (Express + Socket.IO)
- **Frontend** on `http://localhost:5173` (Vite dev server with API proxy)

Or start them individually:

```bash
npm run backend:dev   # backend only
npm run web:dev       # frontend only
```

### 7. Open the app

Go to http://localhost:5173 in your browser. Create an account, create a team, and start your first huddle.

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run backend:dev` | Start backend in watch mode (tsx) |
| `npm run web:dev` | Start Vite dev server |
| `npm run build` | Build the web frontend |
| `npm run start` | Start backend in production mode |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run docker:up` | Start Docker containers |
| `npm run docker:down` | Stop Docker containers |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create a new account |
| POST | `/api/v1/auth/login` | Sign in |
| POST | `/api/v1/auth/refresh` | Refresh access token |

### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/teams` | Create a team |
| GET | `/api/v1/teams/:id` | Get team details |
| POST | `/api/v1/teams/:id/members` | Add a team member |
| DELETE | `/api/v1/teams/:id/members/:userId` | Remove a team member |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions` | Start a new huddle session |
| GET | `/api/v1/sessions/:id` | Get session details |
| PATCH | `/api/v1/sessions/:id/end` | End a session |
| GET | `/api/v1/sessions/:id/summary` | Get session summary |
| GET | `/api/v1/sessions/team/:teamId` | List team sessions (paginated) |
| PUT | `/api/v1/sessions/:id/speakers/:label` | Map speaker label to user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/me` | Get current user profile |
| PATCH | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/users/me/voice-enrollment` | Upload voice enrollment sample |

## WebSocket Events

Connect to the `/huddle` namespace with a JWT token and session ID:

```javascript
const socket = io("/huddle", {
  auth: { token: "your-jwt-token", sessionId: "session-uuid" },
  transports: ["websocket"],
});
```

| Event | Direction | Description |
|-------|-----------|-------------|
| `session_control` | Client -> Server | `"start"` / `"pause"` / `"resume"` / `"end"` |
| `audio_chunk` | Client -> Server | Audio data (base64) with sequence number and MIME type |
| `transcript_update` | Server -> Client | New transcript segments with speaker labels |
| `summary_update` | Server -> Client | Incremental/final meeting summary |
| `speaker_detected` | Server -> Client | Speaker identification results |
| `session_status` | Server -> Client | Session state changes |
| `error` | Server -> Client | Error notifications |

## Diarization Service API

The Python microservice exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/diarize` | Identify speakers in an audio chunk |
| POST | `/enroll` | Enroll a user's voice for recognition |
| GET | `/health` | Health check + model status |

**POST /diarize** (multipart/form-data):
- `audio`: Audio file (WebM, WAV, MP4)
- `session_id`: Session identifier
- `threshold`: Speaker matching threshold (default: 0.65)

```json
{
  "segments": [
    { "speaker_label": "SPEAKER_00", "start_ms": 0, "end_ms": 5200, "confidence": 0.85 },
    { "speaker_label": "SPEAKER_01", "start_ms": 5500, "end_ms": 12100, "confidence": 0.85 }
  ]
}
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Web Frontend | React 19, Vite, React Router 7 |
| State Management | Zustand |
| Backend Server | Node.js, Express, TypeScript |
| Real-time | Socket.IO |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Speaker Diarization | pyannote.audio 3.1 (FastAPI microservice) |
| Transcription | OpenAI Whisper API |
| Summarization | Anthropic Claude |
| Audio Capture | MediaRecorder API (5-second WebM/Opus chunks) |
