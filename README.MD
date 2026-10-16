# Zangoh AI Agent Supervisor Workstation

A human-in-the-loop workstation for monitoring AI-assisted customer support, reviewing conversations, taking over or returning control, configuring agents, and managing response templates.

## Prerequisites

- Docker Desktop with Docker Compose v2 (`docker compose`)
- Node.js 16 or newer and npm (for local development)
- A modern browser

## Run with Docker Compose

From the repository root:

```bash
docker compose up -d --build
```

Compose starts the React development server, Express API, MongoDB, Qdrant, and Ollama. The frontend and backend containers install their npm dependencies when they start.

Open:

- Frontend: <http://localhost:3000>
- Backend health: <http://localhost:8080/health>
- API documentation: <http://localhost:8080/api-docs>
- Qdrant: <http://localhost:6333>
- Ollama: <http://localhost:11434>

Check status and logs:

```bash
docker compose ps
docker compose logs -f backend
```

Stop the services:

```bash
docker compose down
```

To also remove persisted MongoDB, Qdrant, and Ollama data, run `docker compose down -v`.

The Compose configuration supplies `MONGODB_URI=mongodb://mongodb:27017/zangoh` to the backend and points the frontend at the host-mapped API on `localhost:8080`. Optional model API keys can be supplied in a root `.env` file as `OPENAI_API_KEY` and `TOGETHER_API_KEY`; the Compose file provides dummy defaults for local startup.

## Run locally (without frontend/backend containers)

Start the data and supporting services from the repository root:

```bash
docker compose up -d mongodb qdrant ollama
```

In a terminal, install and start the backend:

```bash
cd backend-starter
npm install
MONGODB_URI=mongodb://localhost:27017/zangoh QDRANT_URL=http://localhost:6333 npm run dev
```

In a second terminal, install and start the frontend:

```bash
cd frontend-starter
npm install
npm start
```

The frontend is available at <http://localhost:3000>. Its development proxy forwards `/api` requests to `http://localhost:8080`. To use different API or WebSocket addresses, set `REACT_APP_API_URL` or `REACT_APP_WS_URL` before starting the frontend.

## Project structure

```text
.
├── backend-starter/
│   ├── models/              # Mongoose schemas for agents, conversations, templates, and knowledge bases
│   ├── routes/              # REST endpoints for application features and analytics
│   ├── websocket/           # WebSocket connection handlers
│   ├── data/                # Sample conversation data
│   ├── utils/               # Seed and helper scripts
│   └── server.js            # Express, MongoDB, WebSocket server, and route setup
├── frontend-starter/
│   ├── src/components/      # Shared layout, navigation, and template picker UI
│   ├── src/context/         # Shared app state and WebSocket connection
│   ├── src/pages/           # Dashboard, conversations, agent configuration, and templates
│   └── src/api/             # Axios API client
├── docker/                  # Frontend and backend Dockerfiles
├── data-samples/            # MongoDB initialization data
├── testing/                 # Puppeteer-based integration/UI test runner
└── docker-compose.yaml      # Local service topology
```

## Architecture overview

The frontend is a React single-page application. React Router maps the Dashboard, Conversation, Agent Configuration, and Templates screens. Chakra UI provides the component system, and Recharts renders dashboard activity. `AppDataContext` loads shared conversations and agent data; `WebSocketContext` handles server-pushed events. The Dashboard also subscribes to the analytics Server-Sent Events stream for periodic metric snapshots.

The backend is an Express application connected to MongoDB through Mongoose. REST routes serve conversation, agent, intervention, template, knowledge-base, and analytics data. The same HTTP server hosts WebSockets for real-time updates. Qdrant and Ollama run as supporting Compose services for vector search and local model workflows.

## Testing

Start the frontend and backend first. The test runner uses Axios, `ws`, and Puppeteer. Install those dependencies at the repository root if they are not already available, then run:

```bash
npm install --no-save axios ws puppeteer
node testing/test-runner.js
```

The runner checks service availability, API endpoints, WebSocket behavior, and key UI screens. Dashboard navigation waits for the page heading rather than network idleness because the live SSE connection remains open.

Build the frontend for production with:

```bash
cd frontend-starter
npm run build
```

## Implementation notes and challenges

- **Live dashboard and browser navigation:** SSE keeps a request open continuously, so a browser test waiting for all requests to become idle can time out. The Dashboard UI check waits for rendered page content instead.
- **Template data shape and insertion:** Older or incomplete template records may omit a content field. The UI falls back to available message/description data, resolves supported variables, and uses a fallback clipboard method when browser clipboard access is unavailable.
- **SLA information:** The conversation view uses an API-provided SLA deadline when present. If a deadline is absent, it displays an estimate based on alert priority and the latest customer reply.
- **Local service connectivity:** Containers address MongoDB by the Compose service name `mongodb`; processes running directly on the host use `localhost`. This distinction avoids using a container-only hostname from a local backend process.
