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
Dwie ścieżki (ADR 0012), wybiera je check `Lane`:

- **szybka** — tylko kod appki: agent otwiera PR i włącza `gh pr merge --auto --merge`;
  merge i deploy dzieją się same po zielonych bramkach. Po merge'u agent sprawdza
  `gh run list --workflow Deploy` i smoke na prodzie.
- **wolna** — `infra/`, `.github/`, `scripts/`, prompt, eval, Wątki startowe: agent NIE włącza
  auto-merge i NIE dodaje etykiety `owner-approved` — robi to tylko człowiek, on też merguje.

## Stos i komendy

pnpm workspaces: `apps/web` (Vite + React), `apps/api` (Hono), `apps/ingest` (RSS → Zdarzenia),
`packages/shared` (schematy Zod).

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
