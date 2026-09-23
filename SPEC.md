# Foresight — SPEC v0.2

Nazwa: Foresight (dawniej robocza „WarRoom”, zmieniona 2026-09-23). Ustalenia z sesji grillingu 2026-09-15 (zastępują szkic v0.1).

Appka jest **pojazdem treningowym**: ma być mała, a cały ciężar idzie w proces — Faza 8
Ścieżki 01 (IaC + chmura) z Mapy DevSecOps, budowana procesem Ścieżki 05 (AI Native SDLC).
Słownik domeny: `CONTEXT.md`. Decyzje trudne do odwrócenia: `docs/adr/`.

## Zasady nadrzędne

1. **0 zł bez limitu czasu.** Tylko usługi „always free" i darmowe tiery bez terminu.
   Pilnowane w CI regułą kosztową (lista dozwolonych typów zasobów `aws_*`). Bez wyjątków.
2. **Zero stałych kluczy.** Człowiek: użytkownik IAM z MFA, CLI przez `aws login` (krótkie poświadczenia), bez SSO — [ADR 0005](docs/adr/0005-free-plan-bez-organizations.md). CI i HCP Terraform: OIDC.
3. **Ostatni odpowiedzialny moment.** Decyzję podejmujemy, gdy blokuje najbliższy plaster.
4. **Walking skeleton najpierw.** Zero funkcji produktu, dopóki pipeline nie dowiezie
   „hello world" na produkcję.
5. **Limit WIP = 1.** Jeden otwarty plaster. Nowe pomysły → issue z etykietą `later`.
6. **Każdy plaster = jedna zdolność produktowa + jedna zdolność DevSecOps.**

## Produkt — zakres MVP

Geopolityczno-rynkowa gra strategiczna na realnych danych:

1. **Ingest** — cron pobiera kilka RSS-ów, zapisuje nowe Zdarzenia.
2. **Scenariusze** — dla nowego Zdarzenia jedno wywołanie LLM: 2 Gałęzie (eskalacja /
   deeskalacja) + klasa aktywów. Zdarzenia przetwarzane po kolei z pauzami (limity Groq).
3. **Tezy** — użytkownik loguje Tezę pod Zdarzeniem: kierunek + Horyzont.
4. **Rozstrzygnięcie i Wynik** — po Horyzoncie ręczne Rozstrzygnięcie, ranking trafności.
5. **Dashboard** — jeden widok.

Poza zakresem MVP: automatyczne rozstrzyganie danymi rynkowymi, wielu użytkowników,
powiadomienia, wiele modeli, rozbudowany UI.

## Role i proces (Ścieżka 05)

- **Człowiek = tech lead / owner**: zatwierdza issue i plan, robi review i merge, zatwierdza
  `apply` i deploy, sam odpala komendy operacyjne (`terraform`, `aws`, `gh`, `pnpm`).
- **Agent = implementacja**.
- Źródło prawdy: spec, słownik i ADR-y w repo; plastry w GitHub Issues; 1 issue = 1 PR.
- Instrukcje agenta: `AGENTS.md`, `CLAUDE.md` tylko importuje `AGENTS.md`.

Cykl plastra:

1. Issue z szablonu (cel, kryteria akceptacji, zdolność produktowa + DevSecOps, pozycje mapy,
   poza zakresem) — agent pisze, człowiek zatwierdza.
2. Plan (tryb planowania) — człowiek zatwierdza.
3. TDD na gałęzi: czerwony → zielony → refaktor. Conventional Commits.
4. PR z sekcjami „Co i dlaczego" oraz „Czego uczy ten plaster" (odnośniki do mapy).
5. AI review lokalnie (`/code-review` w Claude Code), wynik jako komentarz w PR.
   Nie w GitHub Actions — płatne API łamie zasadę 0 zł.
6. Bramki CI (automat).
7. Review i merge — człowiek.
8. Deploy — człowiek zatwierdza `apply` w HCP i/lub deploy w GitHub Environment.
9. Domknięcie — wpis w `devsecops/learning-records/`, człowiek odhacza mapę.

Lekcja HTML (teoria + 10 ABCD) tylko dla zupełnie nowego tematu i na prośbę.

## Architektura

```
Przeglądarka
   │ HTTPS
   ▼
CloudFront (plan Free: WAF + DDoS, nagłówki CSP/HSTS)      [us-east-1 — zasoby globalne]
   │ OAC (podpisane żądania)
   ▼
Lambda "web" — Function URL (auth: AWS_IAM)                [eu-central-1]
   ├─ /*      → statyczny frontend (Vite build)
   └─ /api/*  → Hono API ──► DynamoDB
EventBridge Scheduler ─► Lambda "ingest" ─► RSS
                              └─► Groq API (klucz z SSM) ─► DynamoDB
```

| Warstwa | Wybór |
|---|---|
| Konto | AWS, Free plan (bez Organizations — ADR 0005); MFA na root, root nieużywany; alarm budżetowy |
| Regiony | `eu-central-1` obciążenia; `us-east-1` CloudFront/WAF/plan cenowy; role z warunkiem `aws:RequestedRegion` |
| Wejście | CloudFront, flat-rate plan Free (`aws_pricingplanmanager_subscription` — sprawdzić w wydanym providerze) |
| Obliczenia | Lambda, paczki ZIP (nie obrazy — prywatny ECR nie jest „always free") |
| Wydania | wersje + alias `live`; rollback = przestawienie aliasu |
| Dane | DynamoDB (model danych — w plastrze ingestu) |
| Harmonogram | EventBridge Scheduler |
| Sekrety | SSM Parameter Store, SecureString (standard tier), klucz zarządzany przez AWS |
| AI | Groq, `openai/gpt-oss-20b`, Zero Data Retention włączone |
| Domena | brak; `*.cloudfront.net` |
| Środowiska | tylko prod + lokalny dev; Terraform parametryzowany `environment` |

## Stos

- **TypeScript end-to-end**, monorepo **pnpm workspaces**:
  `apps/web`, `apps/api`, `apps/ingest`, `packages/shared`, `infra/`.
- **Backend:** Hono na Lambdzie (Node.js, najnowszy wspierany runtime w dniu implementacji),
  OpenAPI z `@hono/zod-openapi`, bundling esbuild.
- **Kontrakt:** schematy Zod w `packages/shared` — walidują odpowiedź LLM, żądania API i typy
  frontendu.
- **Frontend:** Vite + React + TanStack Router + TanStack Query + Tailwind + shadcn/ui.
- **IaC:** Terraform. Stan i wykonanie w **HCP Terraform** (darmowy tier, VCS-driven),
  dynamic provider credentials (OIDC do AWS). `apply` po ręcznym zatwierdzeniu.

## Tożsamości i uprawnienia

| Tożsamość | Kto ufa | Może |
|---|---|---|
| Człowiek | użytkownik IAM + MFA, `aws login` | praca operacyjna, krótkie poświadczenia |
| `plan` | OIDC z HCP Terraform (workspace) | tylko odczyt |
| `apply` | OIDC z HCP Terraform (workspace, faza apply) | zmiany infrastruktury w 2 regionach |
| `deploy` | OIDC z GitHub (repo, `main`, Environment) | tylko `UpdateFunctionCode` / `PublishVersion` / `UpdateAlias` dla funkcji projektu |
| Lambda `web` | — | odczyt/zapis tabel projektu |
| Lambda `ingest` | — | zapis Zdarzeń i Scenariuszy, odczyt jednego parametru SSM (klucz Groq) |

## Pipeline

**GitHub Actions (każdy PR):** `pnpm install --frozen-lockfile`, testy, `tsc`, lint,
Semgrep, gitleaks, SCA (Trivy `fs`), Checkov na `infra/`, reguła 0 zł.

**GitHub Actions (merge do `main`, Environment z zatwierdzeniem):** build ZIP → SBOM (Syft) →
podpis `cosign sign-blob` (keyless, OIDC GitHub) → `cosign verify-blob` → rola `deploy` →
nowa wersja → alias `live`.

**HCP Terraform:** speculative plan jako status check na PR; `apply` po merge'u i ręcznym
zatwierdzeniu.

**Higiena npm:** lockfile, blokada skryptów instalacyjnych, `minimumReleaseAge`.

**Repo:** publiczne (push protection sekretów, CodeQL, Dependabot za darmo). ID konta
i identyfikatory zasobów w zmiennych HCP, nie w kodzie.

## Bezpieczeństwo AI (wbudowane od plastra ze scenariuszami)

- Treść RSS = niezaufane wejście (prompt injection, OWASP LLM01).
- Model bez narzędzi i uprawnień.
- Odpowiedź = JSON walidowany schematem Zod; niezgodne odrzucane. Structured outputs w trybie
  ścisłym, jeśli `gpt-oss-20b` na darmowym planie to obsługuje (sprawdzić w plastrze).
- Wynik renderowany jako tekst, nigdy jako HTML.
- Do modelu idą wyłącznie publiczne newsy — nigdy Tezy.

## Plaster 01 — walking skeleton

Podzielony 2026-09-23 na dwie części (brak kont AWS/HCP w chwili startu):

- **01a — szkielet lokalny i bramki CI** (bez kont): monorepo, `/api/health` przez TDD, strona
  wyświetlająca odpowiedź, bramki na PR (testy, `tsc`, lint, gitleaks, Semgrep, Trivy `fs`),
  higiena npm, zabezpieczenia repo.
- **01b — chmura**: Terraform w HCP, AWS, CloudFront + OAC, pipeline deployu, Checkov,
  reguła 0 zł. Dopiero 01b domyka poniższe kryteria.

Gotowe, gdy:
- pod `xxxx.cloudfront.net` strona wyświetla odpowiedź z `/api/health`,
- Function URL nie odpowiada z pominięciem CloudFrontu (OAC),
- jedna zmiana przeszła drogę PR → bramki → merge → deploy przez wszystkie zatwierdzenia,
- stan w HCP Terraform, zero stałych kluczy w GitHubie i lokalnie.

## Odłożone (decyzja w plastrze, który tego potrzebuje)

- Uwierzytelnianie — przed plastrem z zapisem Tez (appka pod publicznym adresem).
- Model danych DynamoDB — plaster ingestu.
- Threat model STRIDE — przed pierwszym plastrem z danymi.
- Obserwowalność i alarmy, szczegóły strategii testów.
- Środowisko dev i promocja zmian.
