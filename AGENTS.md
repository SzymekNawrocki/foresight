# Foresight — instrukcje dla agenta

Źródło prawdy: `SPEC.md` (zakres, architektura, proces), `CONTEXT.md` (słownik domeny — używaj
tych nazw w kodzie i tekstach), `docs/adr/` (decyzje trudne do odwrócenia).

## Zasady nadrzędne

- **0 zł bez limitu czasu.** Tylko usługi „always free". Nie dodawaj płatnych usług ani akcji CI
  wołających płatne API.
- **Zero stałych kluczy.** Żadnych sekretów w repo, `.env` poza `.gitignore`.
- **WIP = 1.** Jeden otwarty plaster; pomysły spoza zakresu → issue z etykietą `later`.

## Proces plastra

1 issue = 1 gałąź = 1 PR. TDD: czerwony → zielony → refaktor. Conventional Commits
(`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `test:`), po angielsku, tryb rozkazujący.
Merge robi człowiek.

## Stos i komendy

pnpm workspaces: `apps/web` (Vite + React), `apps/api` (Hono), `packages/shared` (schematy Zod).

```
pnpm install      # zależności (skrypty instalacyjne zablokowane)
pnpm dev          # API :8787 + web :5173 (proxy /api)
pnpm test         # vitest we wszystkich pakietach
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

## Bezpieczeństwo

- Kontrakty (odpowiedzi API, odpowiedzi LLM) walidowane schematem Zod z `packages/shared`.
- Dane zewnętrzne (RSS, odpowiedź LLM) = niezaufane wejście; renderuj jako tekst, nigdy HTML.
- Akcje GitHub przypięte do pełnego SHA commita.
