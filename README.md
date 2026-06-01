# Mock Interview Studio

Production-style mock interview app with adaptive difficulty, per-question timers, and a structured readiness report. Built with React 19, TypeScript (strict), Vite, and a finite-state interview engine that keeps domain logic out of the UI layer.

## Highlights

- Resume and job-description aware question generation
- Tiered difficulty that adapts from consecutive performance
- Automatic session exit when scores fall below a configured threshold
- Sub-second timer precision with timeout handling
- Multi-dimensional scoring and a final hire-readiness summary
- Pluggable LLM backends (OpenAI, Anthropic) plus a local mock provider for development

## Stack

| Layer | Technology |
|--------|------------|
| UI | React 19, Vite 6, TypeScript |
| Styling | Tailwind CSS, Radix UI primitives |
| State | `useReducer` FSM (`useInterviewEngine`) |
| Integrations | OpenAI & Anthropic Chat APIs (fetch) |

## Getting started

**Requirements:** Node.js 18+ and npm 9+.

```bash
git clone <your-repo-url>
cd mock-interview-studio
npm install
cp .env.example .env   # optional — mock mode works without keys
npm run dev
```

Open the URL printed in the terminal (default `http://localhost:5173`).

### Typical flow

1. Enter target role, resume text, and job description.
2. **Prepare interview** — parses inputs and builds the question bank.
3. **Begin interview** — answer each question before the timer ends.
4. Review the readiness report when the session completes or ends early.

Default session: **5 questions**, **90 seconds** each (`src/config/interviewDefaults.ts`).

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_AI_PROVIDER` | `mock`, `openai`, or `anthropic` |
| `VITE_OPENAI_API_KEY` | OpenAI API key |
| `VITE_OPENAI_MODEL` | Model id (default `gpt-4o-mini`) |
| `VITE_OPENAI_BASE_URL` | Optional API base URL |
| `VITE_ANTHROPIC_API_KEY` | Anthropic API key |
| `VITE_ANTHROPIC_MODEL` | Model id (default `claude-3-5-haiku-20241022`) |
| `VITE_ANTHROPIC_BASE_URL` | Optional API base URL |

`VITE_*` values are bundled into the client. Use a backend proxy before shipping production API keys.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the `dist/` output locally |

## Architecture

Interview flow is modeled as explicit states (`IDLE` → `PARSING_INPUTS` → `READY` → `QUESTION_ACTIVE` → `EVALUATING_RESPONSE` → terminal). Transitions live in `src/hooks/interviewReducer.ts`; types are in `src/types/interview.ts`.

```
components/     Presentational UI & layout
hooks/          FSM engine, timer, session orchestration
services/       LLM clients, prompts, resume parsing
utils/          Scoring & adaptation (pure functions)
```

## Scoring rules

| Rule | Threshold |
|------|-----------|
| Promote tier | ≥ 80% composite, 2 consecutive strong answers |
| Demote tier | &lt; 50% composite, 2 consecutive weak answers |
| End session early | Moving average &lt; 40% after ≥ 3 answers |
| Timeout | 0% on all dimensions |

Weights are defined in `DEFAULT_SCORING_WEIGHTS` (`src/types/interview.ts`).

## Deployment

```bash
npm run build
```

Deploy the contents of `dist/` to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages, etc.).

## License

MIT — see [LICENSE](LICENSE) if present, or add your preferred license before publishing.
