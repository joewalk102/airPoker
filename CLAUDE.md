# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Planning poker app. Users create or join rooms, vote on tickets using Fibonacci card values, and the organizer reveals all votes at once to calculate the average.

## Commands

### Backend (Django + Channels)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python -m daphne -p 8000 config.asgi:application
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build
```

## Architecture

### Backend (`backend/`)

- **`config/`** — Django project package: `settings.py`, `urls.py`, `asgi.py`
- **`poker/`** — single Django app with all domain logic

**Request flow:**
- REST: `POST /api/rooms/` creates a room and returns `{code, name, organizer_token}`. `GET /api/rooms/<code>/` verifies a room exists before joining.
- WebSocket: `ws://localhost:8000/ws/room/<CODE>/` handles all real-time state.

**`poker/consumers.py`** — the core of the app. `PokerConsumer` is an `AsyncWebsocketConsumer`. All room state lives in the module-level `rooms_state` dict (in-memory, lost on restart). On `connect`, the consumer adds itself to a Channels group named `room_<CODE>`. On `disconnect`, it removes the participant and broadcasts the updated state. Message handlers:

| Client → Server `type` | Who can send | Effect |
|---|---|---|
| `join` | anyone | Registers participant; sets `is_organizer` if `organizer_token` matches DB |
| `vote` | anyone | Records vote; marks `has_voted=True` |
| `reveal` | organizer only | Sets `status="revealed"` |
| `set_ticket` | organizer only | Clears votes, sets new ticket, sets `status="voting"` |

After any mutation, `broadcast_state` does a `group_send` → every consumer's `send_state` method pushes the full `room_state` JSON to its WebSocket client.

**Organizer identity** is determined at join time by comparing `organizer_token` against `Room.organizer_token` in the DB. The token is only given to the room creator.

### Frontend (`frontend/src/`)

- **`hooks/useRoom.js`** — manages the WebSocket connection lifecycle and exposes `{ roomState, connected, error, vote, reveal, setTicket }`.
- **`pages/Home.jsx`** — create-or-join UI; stores `pokerName` and `pokerToken_<CODE>` in `sessionStorage` before navigating to `/room/<code>`.
- **`pages/Room.jsx`** — main room view. Reads name/token from `sessionStorage`. Derives `isOrganizer` from whether an `organizerToken` exists for this room code.
- **`components/VoteCard.jsx`** — individual voting card button.
- **`components/ParticipantList.jsx`** — sidebar participant list with voted/pending indicators.

**Room status state machine:**
```
waiting  →  voting  →  revealed
              ↑             |
              └─────────────┘  (organizer sets new ticket)
```

**Vote values:** `1, 2, 3, 5, 8, 13, 21, 34, ?, ☕`. Non-numeric values are excluded from the average calculation.

### Data storage

- SQLite (`backend/db.sqlite3`) stores only `Room` records (code, name, organizer_token, created_at).
- All runtime state (participants, votes, status) is in-memory in `consumers.py`. A server restart clears all active sessions.
- Channel layer uses `InMemoryChannelLayer` (no Redis needed for single-process deployments).
