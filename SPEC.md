# Foresight — SPEC v0.3

Nazwa: Foresight (dawniej robocza „WarRoom”, zmieniona 2026-09-23). Ustalenia z sesji grillingu
2026-09-15; kierunek produktu zmieniony w grillingu 2026-10-13 ([ADR 0007](docs/adr/0007-intelligence-hub-not-just-a-game.md)).

Appka jest **prywatnym centrum analitycznym geostrategii**: codzienny Briefing na mapie świata,
Baza wiedzy po Regionach i Tematach oraz trening inwestycyjny na Tezach rozliczanych przez rynek.
Zarazem pozostaje **pojazdem treningowym** Fazy 8 Ścieżki 01 (IaC + chmura) z Mapy DevSecOps,
budowanym procesem Ścieżki 05 (AI Native SDLC).
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

Przecięcie trzech osi: **geostrategia × tech × inwestycje**. Główna czynność: rano czytasz
Briefing, przy Zdarzeniu, które cię ruszyło, stawiasz Tezę, a rynek ją rozlicza.

1. **Ingest** — co godzinę pobiera Zdarzenia z najlepszych dostępnych Źródeł (ogólne serwisy
   światowe + branżowe; liczbę ogranicza limit Groq).
2. **Analiza AI** — dla nowego Zdarzenia jedno wywołanie LLM, odpowiedź po polsku:
   Regiony, Tematy, Waga (1–3), „dlaczego ważne” (2 zdania) i Scenariusz z 2 Gałęziami
   (eskalacja / deeskalacja, każda z Klasą aktywów i kierunkiem). Zdarzenia przetwarzane
   po kolei z pauzami (limity Groq).
3. **Briefing (dashboard)** — ciemna mapa świata; 7 Regionów + Globalne jako przyciski
   z licznikiem Zdarzeń z Wagą ≥ 2 z ostatnich 24 h.
4. **Baza wiedzy** — automatyczne strony Regionów i Tematów: Zdarzenia (od najnowszych, z Wagą),
   Tezy właściciela w tym obszarze i jego trafność w tym obszarze.
5. **Tezy** — właściciel stawia Tezę pod Zdarzeniem: Instrument z krótkiej listy (~20, głównie
   ETF-y sektorowe i surowce) + Kierunek + Horyzont + Uzasadnienie.
6. **Rozstrzygnięcie i Wynik** — po Horyzoncie automat porównuje cenę Instrumentu z ceną przy
   postawieniu Tezy; ruch w granicach ±2% = „bez zmian”. Wynik: trafność ogólna, per Temat,
   per Region. Warunek: darmowe i legalne źródło cen dziennych — jeśli go nie ma, Rozstrzygnięcie
   ręczne.

**Tematy (8, stała lista):** Cyber, AI, Pole walki, Kosmos, Półprzewodniki, Surowce, Energia,
Sankcje i handel. Zdarzenie bez Tematu to szum — nie liczy się na mapie.

**Regiony (7 + Globalne):** Ameryka Północna, Ameryka Łacińska, Europa, Rosja i Eurazja,
Bliski Wschód, Afryka, Azja-Pacyfik; Globalne — Zdarzenia bez jednego miejsca.

**Widoczność:** Briefing i Baza wiedzy publiczne (tylko odczyt); Tezy i Wynik prywatne —
jedno konto, właściciela, bez rejestracji dla innych.

Poza zakresem MVP: wielu użytkowników, publiczne statystyki, publikacja na Facebooku
(appka jest warsztatem — posty właściciel pisze sam), własne notatki w Bazie wiedzy,
cotygodniowe podsumowania AI, powiadomienia, wiele modeli.

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
CloudFront (bez WAF — ADR 0006; Shield Std, nagłówki HSTS) [us-east-1 — zasoby globalne]
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
| Regiony | `eu-central-1` obciążenia; `us-east-1` zasoby globalne CloudFronta; role z warunkiem `aws:RequestedRegion` |
| Wejście | CloudFront, pay-as-you-go w ramach always free (1 TB, 10 mln żądań); bez WAF — ADR 0006 |
| Obliczenia | Lambda, paczki ZIP (nie obrazy — prywatny ECR nie jest „always free") |
| Wydania | wersje + alias `live`; rollback = przestawienie aliasu |
| Dane | DynamoDB, tryb provisioned (always free: 25 GB, 25 RCU/25 WCU łącznie; on-demand nie jest darmowy) |
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
| Lambda `web` | — | `Query` na indeksie `latest` tabeli Zdarzeń (02c); zapis Tez od plastra 06 |
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

## Plaster 02 — ingest

Pierwsza funkcja produktu: appka sama zbiera Zdarzenia ze Źródeł i pokazuje je na stronie.
Bez LLM — Scenariusze to plaster 03.

Źródła (sprawdzone 2026-10-12, publiczne RSS; zapisujemy tylko tytuł, link, datę i Źródło,
nie treść artykułu): BBC World, Al Jazeera, CNBC World, Notes from Poland. Plaster 05 (2026-10-16)
dodał po jednym Źródle branżowym na słabo pokryty Temat: The Record (Cyber), Breaking Defense
(Pole walki), SpaceNews (Kosmos), OilPrice (Energia, Surowce), The Diplomat (Azja-Pacyfik),
MIT Technology Review (AI), EE Times (Półprzewodniki).

- **02a — rdzeń ingestu lokalnie** (TDD, bez AWS): pobranie i parsowanie RSS, normalizacja
  do Zdarzenia, deduplikacja, zapis przez port; model danych DynamoDB; lekki STRIDE.
- **02b — ingest w chmurze**: tabela DynamoDB, Lambda `ingest`, EventBridge Scheduler (co 1 h),
  deploy obu Lambd z pipeline’u.
- **02c — Zdarzenia na stronie**: `GET /api/events` + lista na dashboardzie.

Gotowe, gdy pod `xxxx.cloudfront.net` widać najnowsze Zdarzenia z czterech Źródeł,
dopisywane co godzinę bez duplikatów, a koszt na koncie dalej wynosi 0 zł.

**Zamknięty 2026-10-12** (#23, #25, #28). Lista jest chronologiczna, więc rzadko piszące Źródło
(Notes from Poland) może nie mieścić się w top 20 — widok per Źródło: #30 (`later`).

## Plastry 03–07 — od listy do centrum analitycznego

Kolejność ustalona 2026-10-13: po każdym plastrze na stronie widać coś nowego.

| Plaster | Zdolność produktowa | Zdolność DevSecOps | Do sprawdzenia w źródłach przed startem |
|---|---|---|---|
| **03 Analiza AI** | Nowe Zdarzenia dostają Regiony, Tematy, Wagę, „dlaczego ważne”, Scenariusz | Klucz Groq jako sekret w AWS (nie w repo), obrona przed prompt injection, Zod na odpowiedzi | Limity darmowego Groq; structured outputs dla modelu; koszt przechowania sekretu = 0 zł |
| **04 Mapa i Baza wiedzy** | Ciemna mapa 7 Regionów + Globalne z licznikami; strony Regionów i Tematów | Testy UI, dostępność | Kolor przewodni — warianty do wyboru na żywo |
| **05 Lepsze Źródła** | Najlepsze Źródła branżowe (research → akceptacja właściciela) | Wolumen pod limity Groq | RSS i warunki każdego Źródła |
| **06 Logowanie i Tezy** | Jedno konto; Teza = Instrument + Kierunek + Horyzont + Uzasadnienie | Uwierzytelnianie, autoryzacja zapisu, zapis przez OAC | Darmowe logowanie dla jednego konta |
| **07 Rozstrzygnięcie i Wynik** | Ceny Instrumentów, automatyczne Rozstrzygnięcie, trafność ogólna / per Temat / per Region | Drugi harmonogram, zewnętrzne API cen | Darmowe i legalne źródło cen dziennych |

## Odłożone (decyzja w plastrze, który tego potrzebuje)

- Zapis Tez (POST/PUT) przez OAC: klient musi wysłać SHA-256 body w nagłówku
  `x-amz-content-sha256` (frontend liczy przez WebCrypto) — inaczej Lambda za OAC odrzuci żądanie.
- Retencja Zdarzeń (TTL) — gdy tabela zacznie rosnąć.
- Obserwowalność i alarmy, szczegóły strategii testów.
- Środowisko dev i promocja zmian.
