# AlgoChat Frontend

Next.js frontend for the AlgoChat CRM dashboard.

Requests to `/api/*` are proxied to the backend API via `next.config.mjs`.

## Run

```bash
npm install
npm run dev
```

## Environment

Copy `.env.local.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WHATSAPP_API_BASE=http://localhost:4000
NEXT_PUBLIC_WHATSAPP_SOCKET_URL=http://localhost:4000
```
