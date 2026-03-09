## PathSeeker Frontend MVP

PathSeeker MVP is a Next.js App Router application with:

- Voice or text trip input
- Trip parsing through Vercel AI SDK + AI Gateway
- Route optimization + ETA from Google Routes API
- Black/white shadcn-style UI with no animations

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

Required variables:

- `AI_GATEWAY_API_KEY`
- `AI_MODEL` (default `openai/gpt-4.1-mini`)
- `AI_GATEWAY_BASE_URL` (default `https://ai-gateway.vercel.sh/v1`)
- `ELEVENLABS_API_KEY`
- `GOOGLE_MAPS_API_KEY`

3. Run the app:

```bash
pnpm dev
```

4. Run tests:

```bash
pnpm test
```

## API Endpoints

- `POST /api/transcribe`  
  `multipart/form-data` with `audio` file (`webm`/`wav`/`mpeg`)  
  Response: `{ transcript: string }`

- `POST /api/plan-route`  
  Body: `{ prompt: string }`  
  Response:
  - `parsed`: extracted stops/deadline/notes
  - `route`: optimized stop order + duration + arrival estimate
  - `meta`: provider/model details
