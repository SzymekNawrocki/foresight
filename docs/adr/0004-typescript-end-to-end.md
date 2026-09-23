# TypeScript end-to-end (Hono + Vite/React) w monorepo

Backend (Hono na Lambdzie), frontend (Vite + React + TanStack Router/Query) i schematy współdzielone (Zod) są w TypeScripcie, w monorepo pnpm. Ten sam kształt danych jest walidowany w trzech miejscach: w odpowiedzi LLM, w API i we frontendzie. Jeden język z silnymi typami daje wtedy jedno źródło prawdy i szybki feedback (`tsc`) dla kodu pisanego przez agenta. Dodatkowo esbuild daje małe paczki i krótki cold start.

## Considered Options

- **Python + FastAPI** — zgodne z wcześniejszą roadmapą autora, ale wymaga duplikowania schematów między językami, a paczki z `pydantic-core` są cięższe na Lambdzie.
- **Go** — najszybszy cold start, ale dwa języki i brak współdzielonego kontraktu z frontendem.
- **Next.js** — przy eksporcie statycznym (wymuszonym przez [ADR 0001](./0001-architektura-always-free.md)) traci SSR, Server Components i Server Actions.

## Consequences

- npm to ekosystem najczęściej atakowany złośliwymi paczkami. Obowiązkowe: `--frozen-lockfile`, blokada skryptów instalacyjnych, `minimumReleaseAge`, SCA na każdym PR.
