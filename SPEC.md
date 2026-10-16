# Foresight — SPEC v0.4

Nazwa: Foresight (dawniej robocza „WarRoom”, zmieniona 2026-09-23). Ustalenia z sesji grillingu
2026-09-15; kierunek produktu zmieniony w grillingu 2026-10-13 ([ADR 0007](docs/adr/0007-intelligence-hub-not-just-a-game.md))
i ponownie 2026-10-16 — Wątki zamiast Tez ([ADR 0008](docs/adr/0008-threads-instead-of-theses.md)).

Appka jest **publicznym narzędziem do śledzenia sytuacji geopolitycznych**: Wątki z Raportami
sytuacyjnymi, Briefing „co się ruszyło”, Baza wiedzy po Regionach, Tematach i Aktorach.
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

Przecięcie trzech osi: **geostrategia × tech × rynki**. Główna czynność: rano otwierasz Briefing,
widzisz, które sytuacje się ruszyły i jak, i wchodzisz w Raport sytuacyjny Wątku, który cię
obchodzi. Foresight nie ocenia, czy ktoś miał rację — pokazuje, jak zmieniała się sytuacja.

1. **Ingest** — co godzinę Zdarzenia z 11 Źródeł (światowe + po jednym branżowym na Temat).
2. **Analiza AI (meldunek)** — paczki po 5 Zdarzeń w jednym wywołaniu LLM, po polsku: Regiony,
   Tematy, do 4 Aktorów, Waga (1–3), jedno zdanie „dlaczego ważne” i przypięcie do aktywnego
   Wątku albo — przy Wadze ≥ 2 — propozycja Nowej sytuacji. Duplikaty nagłówków odsiewane bez AI;
   najpierw Źródła branżowe; zużycie tokenów logowane.
3. **Wątki** — oś czasu Zdarzeń; aktywny (Zdarzenie w 14 dni) → uśpiony → zarchiwizowany ręcznie;
   najwyżej 30 aktywnych w prompcie. Skrzynka **Nowe sytuacje**: właściciel akceptuje, łączy
   albo odrzuca.
4. **Raport sytuacyjny** — najwyżej raz dziennie, tylko dla Wątków z ruchem: stan teraz, Aktorzy
   i interesy, Scenariusze (eskalacja / status quo / deeskalacja) z Sygnałami ostrzegawczymi,
   Klasy aktywów, relacje międzynarodowe, „co się zmieniło”, najbardziej prawdopodobny Scenariusz.
   Każda wersja zostaje (dziennik sytuacji).
5. **Briefing** — Ruch w Wątkach · 24 h → mapa aktywnych Wątków per Region → Nowe sytuacje
   (właściciel); surowe Zdarzenia na osobnej stronie **Strumień**.
6. **Baza wiedzy** — strony Regionów, Tematów i Aktorów (u Aktora: „najczęściej razem”).

**Tematy (8, stała lista):** Cyber, AI, Pole walki, Kosmos, Półprzewodniki, Surowce, Energia,
Sankcje i handel. Zdarzenie bez Tematu to szum — nie liczy się na mapie.

**Regiony (7 + Globalne):** Ameryka Północna, Ameryka Łacińska, Europa, Rosja i Eurazja,
Bliski Wschód, Afryka, Azja-Pacyfik; Globalne — Zdarzenia bez jednego miejsca.

**Widoczność:** wszystko publiczne do odczytu; decyzje o Wątkach tylko po zalogowaniu — jedno
konto, właściciela, bez rejestracji dla innych. Publiczne odpowiedzi API cache'uje CloudFront.
Stopka: „Analizy generuje AI na podstawie nagłówków; to nie jest porada inwestycyjna”.

Poza zakresem MVP: Tezy i ich rozliczanie (ADR 0008), ceny Instrumentów przy Wątkach (później,
Tiingo), pełny graf relacji między Aktorami, Poza zakresem MVP: wielu użytkowników, publiczne statystyki, publikacja na Facebooku
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
| Lambda `web` | — | `Query` na indeksie `latest` tabeli Zdarzeń (02c); decyzje o Wątkach od plastra 10 |
| Lambda `ingest` | — | zapis Zdarzeń, Analiz i Raportów, odczyt jednego parametru SSM (klucz Groq) |

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
- Do modelu idą wyłącznie publiczne newsy i tytuły Wątków.

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
nie treść artykułu): BBC World, Al Jazeera, CNBC World, Notes from Poland.

- **02a — rdzeń ingestu lokalnie** (TDD, bez AWS): pobranie i parsowanie RSS, normalizacja
  do Zdarzenia, deduplikacja, zapis przez port; model danych DynamoDB; lekki STRIDE.
- **02b — ingest w chmurze**: tabela DynamoDB, Lambda `ingest`, EventBridge Scheduler (co 1 h),
  deploy obu Lambd z pipeline’u.
- **02c — Zdarzenia na stronie**: `GET /api/events` + lista na dashboardzie.

Gotowe, gdy pod `xxxx.cloudfront.net` widać najnowsze Zdarzenia z czterech Źródeł,
dopisywane co godzinę bez duplikatów, a koszt na koncie dalej wynosi 0 zł.

**Zamknięty 2026-10-12** (#23, #25, #28). Lista jest chronologiczna, więc rzadko piszące Źródło
(Notes from Poland) może nie mieścić się w top 20 — widok per Źródło: #30 (`later`).

## Plastry 03–06 — od listy do mapy

Kolejność ustalona 2026-10-13: po każdym plastrze na stronie widać coś nowego.

| Plaster | Zdolność produktowa | Zdolność DevSecOps | Do sprawdzenia w źródłach przed startem |
|---|---|---|---|
| **03 Analiza AI** | Nowe Zdarzenia dostają Regiony, Tematy, Wagę, „dlaczego ważne”, Scenariusz | Klucz Groq jako sekret w AWS (nie w repo), obrona przed prompt injection, Zod na odpowiedzi | Limity darmowego Groq; structured outputs dla modelu; koszt przechowania sekretu = 0 zł |
| **04 Mapa i Baza wiedzy** | Ciemna mapa 7 Regionów + Globalne z licznikami; strony Regionów i Tematów | Testy UI, dostępność | Kolor przewodni — warianty do wyboru na żywo |
| **05 Lepsze Źródła** | Najlepsze Źródła branżowe (research → akceptacja właściciela) | Wolumen pod limity Groq | RSS i warunki każdego Źródła |
| **06 Logowanie** | Jedno konto właściciela (Tezy wycięte — ADR 0008) | Uwierzytelnianie Cognito + PKCE, nagłówek tokenu i SHA-256 body przez OAC | Darmowe logowanie dla jednego konta |

## Plastry 08–12 — Wątki (ADR 0008)

| Plaster | Zdolność produktowa | Zdolność DevSecOps |
|---|---|---|
| **08 Porządki** | Kierunek zapisany (ADR 0008, CONTEXT, SPEC); 06 przycięty do logowania; 07 zamknięty | Usunięcie martwego kodu i uprawnień |
| **09 Odchudzona Analiza** | Meldunek: Aktorzy, 1 zdanie, bez Scenariusza; paczki po 5, odsiew duplikatów, priorytet Źródeł | Pomiar zużycia tokenów; injection w paczce w modelu zagrożeń |
| **10 Wątki** | Przypinanie w tym samym wywołaniu, skrzynka Nowe sytuacje, cykl życia, strona Wątku | Autoryzacja decyzji właściciela (pierwszy realny zapis przez OAC) |
| **11 Raport sytuacyjny** | Dzienny Raport + historia wersji; nowy Briefing (Ruch w Wątkach, mapa Wątków) | Trzeci harmonogram; budżet tokenów dzielony między Analizę i Raporty |
| **12 Aktorzy** | Strony Aktorów, „najczęściej razem” | Agregacje bez dodatkowych wywołań AI |

## Odłożone (decyzja w plastrze, który tego potrzebuje)

- Ceny Instrumentów przy Wątkach (Tiingo, darmowy Starter) — gdy właściciel uzna, że ich brakuje.
- Pełny graf relacji między Aktorami.
- Retencja Zdarzeń (TTL) — gdy tabela zacznie rosnąć.
- Obserwowalność i alarmy, szczegóły strategii testów.
- Środowisko dev i promocja zmian.
