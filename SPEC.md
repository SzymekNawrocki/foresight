# Foresight — SPEC v0.6

Nazwa: Foresight (dawniej robocza „WarRoom”, zmieniona 2026-09-23). Ustalenia z sesji grillingu
2026-09-15; kierunek produktu zmieniony w grillingu 2026-10-13 ([ADR 0007](docs/adr/0007-intelligence-hub-not-just-a-game.md))
i ponownie 2026-10-16 — Wątki zamiast Tez ([ADR 0008](docs/adr/0008-threads-instead-of-theses.md)).
Po starcie MVP grilling 2026-10-19 doprecyzował kierunek świata, Poziomy Źródeł i budżet tokenów
([ADR 0009](docs/adr/0009-tracked-signals-and-token-budget.md)).
Audyt 2026-10-22 zawęził produkt do niszy tech × geo × rynki
([ADR 0010](docs/adr/0010-tech-first-niche-radar.md)).

Appka jest **radarem tematów na stronę właściciela w jednej niszy**: technologia w centrum
(cyber i hacking, drony, militarny kosmos, chipy, AI, zbrojeniówka), w tle gra państw, obok wpływ
na ceny Spółek. Wątki z Raportami sytuacyjnymi, Briefing „co się ruszyło”, Karty postów,
Baza wiedzy po Regionach, Tematach i Aktorach.
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

Przecięcie trzech osi: **tech × geostrategia × rynki**, z technologią na pierwszym miejscu
(ADR 0010). Zdarzenie spoza Niszy (np. czysta geopolityka bez technologii) jest zapisywane, ale
nie pokazuje się nigdzie. Główna czynność: otwierasz Briefing, widzisz 3 Karty postów i Wątki,
które się ruszyły, i wchodzisz w Raport sytuacyjny Wątku, o którym chcesz pisać. Foresight nie ocenia, czy ktoś miał rację — pokazuje, jak zmieniała się sytuacja.
Kierunek świata to **ruch między Scenariuszami w czasie**: Sygnały ostrzegawcze zapalają się
na podstawie Zdarzeń, a Prawdopodobieństwo Scenariuszy przesuwa się na skali.

1. **Ingest** — co godzinę Zdarzenia ze Źródeł z Poziomem A (oficjalne), B (rzetelne serwisy)
   albo C (analizy). Fakty z A i B, interpretacje z C.
2. **Analiza AI (meldunek)** — `gpt-oss-120b`, paczki po 5 Zdarzeń w jednym wywołaniu, po polsku:
   najpierw „czy w Niszy?” (poza Niszą — tylko `niche: false`), potem Regiony, Tematy, do 4
   Aktorów, do 3 Wpływów na Spółkę (Spółka z ustalonej listy, kierunek ↑ ↓ ↕, jedno zdanie
   mechanizmu), Waga (1–3), jedno zdanie „dlaczego ważne” i przypięcie do aktywnego
   Wątku albo — przy Wadze ≥ 2 — propozycja Nowej sytuacji (podobne propozycje łączy kod). Duplikaty nagłówków odsiewane bez AI;
   najpierw Źródła branżowe; zużycie tokenów logowane.
3. **Wątki** — oś czasu Zdarzeń; aktywny (Zdarzenie w 14 dni) → uśpiony → zarchiwizowany ręcznie;
   najwyżej 30 aktywnych w prompcie. Skrzynka **Nowe sytuacje**: właściciel akceptuje, łączy
   albo odrzuca.
4. **Raport sytuacyjny** — `gpt-oss-120b`, krocząco: co godzinę 2–3 Wątki z nowymi Zdarzeniami
   i Raportem starszym niż 24 h (najpierw największa Waga). Stan teraz, Aktorzy i interesy,
   Scenariusze (eskalacja / status quo / deeskalacja) z Sygnałami ostrzegawczymi
   i Prawdopodobieństwem (skala ICD 203), Wpływy na Spółki (od plastra 14; wcześniej Klasy
   aktywów), relacje międzynarodowe, „co się zmieniło”.
   Sygnał zapala się tylko z dowodem — id Zdarzenia ze Źródła A lub B (sprawdza kod); strzałkę
   i powód zmiany Prawdopodobieństwa liczy kod względem poprzedniej wersji. Każda wersja zostaje
   (dziennik sytuacji).
5. **Briefing** — Ruchy · 24 h (przesunięcia Scenariuszy i zapalone Sygnały) → mapa aktywnych
   Wątków per Region → Wątki aktywne → Nowe sytuacje (właściciel); surowe Zdarzenia na osobnej
   stronie **Strumień**. W stopce świeżość: ostatni ingest i ostatni Raport.
6. **Karty postów** (od plastra 14) — codziennie 3 na Briefingu: hak, technologia, gra państw,
   Spółki z kierunkiem, linki do Źródeł. Posty pisze właściciel; tylko w appce, bez maila.
7. **Baza wiedzy** — strony Regionów, Tematów i Aktorów (u Aktora: „najczęściej razem”).

**Tematy (6, stała lista niszy — ADR 0010):** Cyber, Drony, Kosmos, Chipy, AI, Zbrojeniówka.
Energia, surowce i sankcje nie są Tematami — pojawiają się jako Wpływ na Spółkę. Stare Analizy
(8 Tematów do plastra 11) zostają czytelne.

**Spółki (~45, stała lista z tickerami, akceptuje właściciel):** obronność i drony, cyber, kosmos,
chipy, platformy AI, kilka ETF-ów, polskie spółki z GPW. Kod odrzuca Spółkę spoza listy.

**Regiony (7 + Globalne):** Ameryka Północna, Ameryka Łacińska, Europa, Rosja i Eurazja,
Bliski Wschód, Afryka, Azja-Pacyfik; Globalne — Zdarzenia bez jednego miejsca.

**Widoczność:** wszystko publiczne do odczytu; decyzje o Wątkach tylko po zalogowaniu — jedno
konto, właściciela, bez rejestracji dla innych. Publiczne odpowiedzi API cache'uje CloudFront.
Stopka: „Analizy generuje AI na podstawie nagłówków; to nie jest porada inwestycyjna”.

Poza zakresem MVP: Tezy i ich rozliczanie (ADR 0008), ceny jako Sygnały, pełny graf relacji
między Aktorami, wielu użytkowników, publiczne statystyki, publikacja na Facebooku i gotowe
posty od AI (appka jest warsztatem — posty właściciel pisze sam), własne notatki w Bazie wiedzy,
cotygodniowe podsumowania AI, powiadomienia, Zdarzenia spoza Niszy.

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
EventBridge Scheduler ─► Lambda "ingest" (worker) ─► RSS
                              └─► Groq API (klucz z SSM) ─► DynamoDB
CloudWatch (alarmy) ─► SNS ─► e-mail właściciela
```

| Warstwa | Wybór |
|---|---|
| Konto | AWS, Free plan (bez Organizations — ADR 0005); MFA na root, root nieużywany; alarm budżetowy |
| Regiony | `eu-central-1` obciążenia; `us-east-1` zasoby globalne CloudFronta; role z warunkiem `aws:RequestedRegion` |
| Wejście | CloudFront, pay-as-you-go w ramach always free (1 TB, 10 mln żądań); bez WAF — ADR 0006 |
| Obliczenia | Lambda, paczki ZIP (nie obrazy — prywatny ECR nie jest „always free") |
| Wydania | wersje + alias `live`; rollback = przestawienie aliasu |
| Dane | DynamoDB, tryb provisioned (always free: 25 GB, 25 RCU/25 WCU łącznie; on-demand nie jest darmowy); `events` z indeksami 15/15, `threads` single-table 5/5 — razem 20/25 |
| Harmonogram | EventBridge Scheduler |
| Sekrety | SSM Parameter Store, SecureString (standard tier), klucz zarządzany przez AWS |
| AI | Groq, Zero Data Retention: `openai/gpt-oss-120b` meldunki (~105K tokenów/dzień) i Raporty (reszta z 200K/dzień, ~15–20 Raportów; ADR 0009, aneks); budżet tokenów zatrzymuje pracę przed limitem |
| Obserwowalność | logi JSON z zużyciem tokenów; 3 alarmy CloudWatch → SNS e-mail (błędy workera, Analiza stoi, cisza w ingeście) |
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
| Lambda `ingest` (worker) | — | zapis Zdarzeń i Analiz, tabela `threads` (Wątki, Raporty, budżet), odczyt jednego parametru SSM (klucz Groq) |

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
  ścisłym — Groq sprawdza go dopiero po generowaniu, więc etykiety idą jako zwykłe napisy, a kod
  zostawia znane wartości; jeden błędny meldunek nie odrzuca paczki (ADR 0009, aneks).
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
nie treść artykułu): BBC World, Al Jazeera, CNBC World, Notes from Poland. Plaster 05 (2026-10-16)
dodał po jednym Źródle branżowym na słabo pokryty Temat: The Record (Cyber), Breaking Defense
(Pole walki), SpaceNews (Kosmos), OilPrice (Energia, Surowce), The Diplomat (Azja-Pacyfik),
MIT Technology Review (AI), EE Times (Półprzewodniki).

Plaster 10 (2026-10-20) nadał Źródłom Poziomy i dodał 8 oficjalnych Źródeł poziomu A (~15 wpisów
na dobę): Biały Dom (akty prezydenta), Departament Obrony USA, ONZ (komunikaty i UN News), Rada UE,
EBC, Fed, CISA. Poziom B: BBC, Al Jazeera, CNBC, Notes from Poland, The Record, Breaking Defense,
SpaceNews; poziom C: OilPrice, The Diplomat, MIT Technology Review, EE Times. Przy zaległościach
Meldunki powstają najpierw z A i B. Wpisy starsze niż 48 h są pomijane, więc nowe Źródło nie
zasypuje kolejki swoim archiwum. Odrzucone: Komisja Europejska (szum), NATO, Departament Stanu,
IEA, OPEC, MSZ Rosji i Japonii (blokują boty lub nie mają RSS), OFAC (martwy feed).

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

## Plastry 09–11 — kierunek świata (ADR 0009)

08 (porządki po ADR 0008) zamknięty; plastry 09–12 z ADR 0008 zastąpione 2026-10-19 trzema
większymi.

| Plaster | Zdolność produktowa | Zdolność DevSecOps |
|---|---|---|
| **09 Fundament** | Bez widocznej zmiany poza stopką ze świeżością | Głębokie moduły workera (Ingest, Meldunki, Raporty, Budżet, seam LLM z adapterem Groq i fake), log tokenów, budżet tokenów, 3 alarmy + SNS |
| **10 Rdzeń** | Poziomy Źródeł A/B/C (research listy), odchudzony meldunek z Aktorami w paczkach po 5, Wątki i skrzynka Nowe sytuacje, kroczące Raporty z Sygnałami i Prawdopodobieństwem, minimalna strona Wątku | Tabela `threads`, drugi model, `pnpm eval` (złote przypadki), autoryzacja decyzji właściciela, injection w paczce w modelu zagrożeń |
| **11 Widok** | Nowy Briefing (Ruchy, mapa Wątków, Wątki aktywne), ceny przy Wątku | Darmowe źródło cen (licencja, limity), cache odpowiedzi |

Plaster 10 (#53, PR #54, #56, #58) dał Wątki, skrzynkę Nowe sytuacje i kroczące Raporty sytuacyjne;
pierwszy realny Raport: ~2,4K tokenów. Plaster 11 (#61, 2026-10-21) przebudował Briefing na Wątki
(Ruchy 24 h → mapa aktywnych Wątków → Wątki aktywne), surowe Zdarzenia przeszły na stronę Strumień.
Ceny przy Wątku wydzielone do #60 (`later`) — wymagają wyboru darmowego, legalnego źródła cen.

Później: strony Aktorów („najczęściej razem”), ceny jako Sygnały.

## Plastry 12–14 — nisza tech × geo × rynki (ADR 0010)

Audyt 2026-10-22: 0 aktywnych Wątków (CloudFront blokował POST, #63), 43 Nowe sytuacje
o różnych nazwach (zimny start), tylko 122 z 481 meldunków z Tematem tech, Al Jazeera = 39%
strumienia.

| Plaster | Zdolność produktowa | Zdolność DevSecOps |
|---|---|---|
| **12 Pętla i nisza** | Decyzje właściciela działają (POST przez CloudFront), meldunek v3 z bramką Niszy, 6 Tematów niszy i Wpływami na Spółki, ~8 Wątków startowych, łączenie podobnych Nowych sytuacji, widoki tylko z Niszy | Eval przepisany pod Niszę (trafność bramki: nic z niszy nie ginie, szum odpada), lista dozwolonych wartości w kodzie (Spółki), ordered behavior CloudFronta tylko dla tras właściciela |
| **13 Źródła niszy** | Research Źródeł branżowych i oficjalnych dla cyber, obronności, kosmosu i chipów → akceptacja właściciela; mniej ogólnych serwisów | Zdrowie Źródeł (ile wpisów i ile w Niszy per Źródło w raporcie workera) |
| **14 Karty postów** | 3 Karty postów dziennie na Briefingu; Wpływy na Spółki w Raporcie zamiast Klas aktywów | Wynik AI w nowej części tabeli `threads`, renderowany jako tekst; budżet tokenów dla Kart |

Później: ceny przy Spółkach (#60) — czy rynek faktycznie zareagował.

## Odłożone (decyzja w plastrze, który tego potrzebuje)

- Pełny graf relacji między Aktorami.
- Retencja Zdarzeń (TTL) — gdy tabela zacznie rosnąć.
- Szczegóły strategii testów poza evalem.
- Środowisko dev i promocja zmian.
