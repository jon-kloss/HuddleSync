# HuddleSync

AI-Powered Team Huddle Recorder & Summarizer. Record your team standups, automatically detect who's speaking, transcribe the conversation, and generate per-person summaries with action items.

## Architecture

- **Mobile**: React Native (Expo 54) with Expo Router, Zustand state management
- **Backend**: Node.js + Express + Socket.IO, TypeScript
- **Database**: PostgreSQL 16 (via Prisma ORM) + Redis 7
- **AI Pipeline**: pyannote.audio (speaker diarization) + OpenAI Whisper (ASR) + Anthropic Claude (summarization)

## Prerequisites

- [Node.js 20+](https://nodejs.org/) (see `.nvmrc`)
- [Docker](https://www.docker.com/) and Docker Compose
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- API keys for:
  - [OpenAI](https://platform.openai.com/) (Whisper transcription)
  - [Anthropic](https://console.anthropic.com/) (Claude summarization)
  - [Hugging Face](https://huggingface.co/) (pyannote.audio diarization model access)

## Project Structure

```
HuddleSync/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema (8 models)
│   ├── src/
│   │   ├── config/                 # Environment config
│   │   ├── middleware/             # Auth (JWT), validation (Zod), error handling
│   │   ├── pipelines/             # AI pipeline services
│   │   │   ├── diarization.ts     # Speaker diarization (pyannote.audio)
│   │   │   ├── transcription.ts   # Speech-to-text (Whisper)
│   │   │   ├── summarization.ts   # Summary generation (Claude)
│   │   │   └── orchestrator.ts    # Pipeline coordinator
│   │   ├── routes/                # REST API endpoints
│   │   │   ├── auth.ts            # Register, login, token refresh
│   │   │   ├── teams.ts           # Team CRUD, member management
│   │   │   ├── sessions.ts        # Huddle session lifecycle
│   │   │   └── users.ts           # Profile, voice enrollment
│   │   ├── services/              # Prisma client
│   │   ├── websocket/             # Socket.IO real-time audio handling
│   │   └── index.ts               # Server entry point
│   └── package.json
├── mobile/
│   ├── app/
│   │   ├── (tabs)/                # Tab navigator screens
│   │   │   ├── index.tsx          # Dashboard / Start Huddle
│   │   │   ├── history.tsx        # Session history
│   │   │   └── settings.tsx       # Profile & team settings
│   │   ├── session/[id].tsx       # Live recording session
│   │   ├── summary/[id].tsx       # Per-speaker summary view
│   │   ├── login.tsx              # Sign in
│   │   ├── register.tsx           # Create account
│   │   └── _layout.tsx            # Root layout with auth redirect
│   ├── contexts/                  # React context (auth)
│   ├── services/                  # API, WebSocket, audio capture
│   ├── stores/                    # Zustand state (auth, session)
│   ├── constants/                 # Config, colors, API URLs
│   ├── types/                     # Shared TypeScript types
│   └── package.json
├── docker-compose.yml             # PostgreSQL 16 + Redis 7
└── .nvmrc                         # Node 20
```

## Getting Started

### 1. Clone and install dependencies

```bash
cd HuddleSync
npm install
```

This installs dependencies for both `backend/` and `mobile/` workspaces.

### 2. Start the databases

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your API keys:

```env
DATABASE_URL=postgresql://huddlesync:huddlesync@localhost:5432/huddlesync
REDIS_URL=redis://localhost:6379

JWT_SECRET=<generate-a-random-secret>
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

OPENAI_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
DIARIZATION_SERVICE_URL=http://localhost:8000
```

### 4. Run database migrations

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all database tables and generates the Prisma client.

### 5. Start the backend

```bash
cd backend
npm run dev
```

The server starts on `http://localhost:3000`.

### 6. Start the mobile app

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS simulator / `a` for Android emulator.

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
| PUT | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/users/me/voice` | Upload voice enrollment sample |

## WebSocket Events

Connect to the `/huddle` namespace with a JWT token:

```javascript
const socket = io("http://localhost:3000/huddle", {
  auth: { token: "your-jwt-token" }
});
```

| Event | Direction | Description |
|-------|-----------|-------------|
| `session_control` | Client -> Server | Start/end session |
| `audio_chunk` | Client -> Server | Send audio data (base64) |
| `transcript_update` | Server -> Client | New transcript segments |
| `summary_update` | Server -> Client | Incremental summary |
| `session_status` | Server -> Client | Session state changes |
| `error` | Server -> Client | Error notifications |

## Speaker Diarization Service

The backend expects a pyannote.audio microservice running at `DIARIZATION_SERVICE_URL`. This service should accept audio file uploads and return speaker segments:

```json
POST /diarize (multipart/form-data)

Response:
{
  "segments": [
    { "speaker": "SPEAKER_00", "start": 0.0, "end": 5.2 },
    { "speaker": "SPEAKER_01", "start": 5.5, "end": 12.1 }
  ]
}
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile App | React Native, Expo 54, Expo Router |
| State Management | Zustand + SecureStore |
| Backend Server | Node.js, Express, TypeScript |
| Real-time | Socket.IO |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Speaker Diarization | pyannote.audio |
| Transcription | OpenAI Whisper API |
| Summarization | Anthropic Claude |
| Audio Capture | expo-av (5-second chunks) |
