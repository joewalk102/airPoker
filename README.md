# Air Poker

Air Poker is a collaborative planning poker application designed for agile teams to estimate tasks efficiently. It features a modern, real-time interface built with React (Vite) on the frontend and Django Channels (WebSockets) on the backend.

## Features

- **Real-time Collaboration:** Join rooms and see votes update in real-time via WebSockets.
- **Anonymous/Named Voting:** Participants can enter a display name to join.
- **Host Controls:** The room creator has the ability to start votes, set tickets/topics, reveal votes, and manage participants.
- **Session History:** Keeps a log of past tickets and their estimated story points during a session.
- **Responsive Design:** Works seamlessly on desktop and mobile devices.

## Tech Stack

- **Frontend:** React, Vite, React Router
- **Backend:** Python, Django, Django REST Framework, Django Channels (WebSockets), Daphne
- **Database:** PostgreSQL (production), SQLite (development fallback)
- **Infrastructure:** Docker, Docker Compose, Nginx

## How to Host

Air Poker is containerized using Docker, making it easy to deploy anywhere Docker is supported.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd airPoker
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application:**
   By default, the application will be available at `http://localhost`. 

   *Note: If you run this on a remote server, you can access it via the server's IP address or domain name.*

### Configuration (Optional)

You can customize the deployment by creating a `.env` file in the root of the project (next to `docker-compose.yml`). The application will read these variables on startup.

**Example `.env` file:**

```env
# Frontend/Backend Host Ports
FRONTEND_PORT=80
BACKEND_PORT=8000

# PostgreSQL Database Configuration
POSTGRES_DB=airpoker
POSTGRES_USER=pokeruser
POSTGRES_PASSWORD=pokerpassword
```

#### Important Notes on Ports

- The frontend container uses Nginx to serve the static Vite build and reverse-proxies `/api` and `/ws` requests directly to the backend container internally via Docker's network.
- Because of this internal routing, changing the `FRONTEND_PORT` or `BACKEND_PORT` in your `.env` file only changes the ports exposed to the **host machine**, not how the containers talk to each other.
- It is highly recommended to run the frontend behind a secure reverse proxy (like Traefik, Caddy, or an AWS Application Load Balancer) that provides HTTPS/SSL if you are deploying to the public internet.

## Development

If you want to run the application locally without Docker for development:

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
