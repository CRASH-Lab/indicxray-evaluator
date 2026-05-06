# AGENTS.md — AI agent guide for this repository

Purpose: give concise, actionable guidance to AI coding agents so they can be productive quickly.

Quick Start
- Install dependencies: `npm install`
- Run dev server: `npm run dev` (Vite, port 5173)
- Build production: `npm run build`
- Preview production build: `npm run preview`

Key facts (short)
- Stack: React 18 + TypeScript + Vite + Tailwind + shadcn-ui (Radix)
- State: `zustand`; Data fetching: `@tanstack/react-query`; Forms: `react-hook-form` + `zod`
- Entry: `src/main.tsx` → `src/App.tsx`
- Pages: `src/pages/` — app routes and role-specific views
- UI components: `src/components/` and `src/components/ui/` (shadcn-derived)
- Services/API: `src/services/`
- Stores: `src/stores/`
- Types: `src/types/`

Agent Guidance (do this first)
- Prefer linking to docs or code rather than copying large blocks. Use relative workspace links.
- To run locally: follow Quick Start above. If environment variables are needed, look for `VITE_API_URL` in `.env` or CI configs.
- When changing UI, run `npm run dev` and visually verify; run `npm run typecheck` for TS errors and `npm run lint` for lint issues.
- Respect existing patterns in `src/components/ui/` (shadcn components) and `src/hooks/` abstractions.

Conventions & notes
- Path alias: `@/*` → `src/*` (check tsconfig for exact mapping)
- Deployment target: Vercel (see `vercel.json`). Production Docker artifacts exist (`Dockerfile`, `nginx.conf`).
- TypeScript strictness is relaxed in this repo; be conservative when tightening rules—discuss first.

Files to inspect for deep changes
- `src/services/` — API adapters and backend contracts
- `src/stores/evaluation.ts` — important stateful logic
- `src/types/` — domain models used across the app

If you modify tests, lint, or build scripts
- Update `package.json` scripts and run `npm run lint` and `npm run typecheck` locally.

Next suggestions
- Add CI job examples (GitHub Actions) for `lint`, `typecheck`, and `build`.
- If desired, create targeted agent skills for API changes and UI refactors.
