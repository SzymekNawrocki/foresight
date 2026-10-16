# Foresight

Prywatne centrum analityczne geostrategii: świat dostarcza Zdarzenia, AI osadza je w Regionach
i Tematach i rozpisuje na Scenariusze, a właściciel stawia Tezy, które rozlicza rynek.

## Świat

**Źródło**:
Publiczny kanał wiadomości (RSS), z którego pobierane są Zdarzenia.
_Avoid_: feed, provider
_W kodzie_: `Source`

**Zdarzenie**:
Pojedyncza wiadomość geopolityczna lub rynkowa pobrana ze Źródła, która może wpłynąć na rynki.
_Avoid_: news, event, artykuł, wpis
_W kodzie_: `Event` (po angielsku w kodzie; w tekstach po polsku „Zdarzenie”)

**Region**:
Teatr geostrategiczny, w którym rozgrywa się Zdarzenie: Ameryka Północna, Ameryka Łacińska,
Europa, Rosja i Eurazja, Bliski Wschód, Afryka, Azja-Pacyfik albo Globalne (bez jednego miejsca).
Zdarzenie ma jeden lub więcej Regionów.
_Avoid_: kontynent, kraj, obszar
_W kodzie_: `Region`

**Temat**:
Jedna z ośmiu stałych osi tech i rynku: Cyber, AI, Pole walki, Kosmos, Półprzewodniki, Surowce,
Energia, Sankcje i handel. Zdarzenie ma zero lub więcej Tematów; bez Tematu jest szumem.
_Avoid_: tag, kategoria, sektor
_W kodzie_: `Topic`

## Analiza

**Waga**:
Ocena AI, jak bardzo Zdarzenie zmienia sytuację: 1 — szum, 2 — istotne, 3 — przełomowe.
_Avoid_: priorytet, ważność, score
_W kodzie_: `Weight`

**Scenariusz**:
Wygenerowany przez AI rozpis możliwego rozwoju jednego Zdarzenia, złożony z Gałęzi.
_Avoid_: analiza, prognoza, predykcja

**Gałąź**:
Jedna ścieżka rozwoju w Scenariuszu (eskalacja albo deeskalacja) wraz z Klasą aktywów, której
dotyczy, i kierunkiem jej ruchu.
_Avoid_: wariant, opcja, branch

**Klasa aktywów**:
Grupa instrumentów, na którą wpływa Gałąź (np. ropa, złoto, półprzewodniki, indeksy akcji).
_Avoid_: asset, rynek

## Widoki

**Briefing**:
Dashboard — ciemna mapa świata, na której każdy Region pokazuje liczbę Zdarzeń z Wagą ≥ 2
z ostatnich 24 h.
_Avoid_: feed, strona główna, przegląd

**Baza wiedzy**:
Automatyczne strony Regionów i Tematów: Zdarzenia z tego obszaru, Tezy właściciela w tym obszarze
i jego trafność w tym obszarze.
_Avoid_: wiki, notatki, encyklopedia

## Gra

**Instrument**:
Konkretny, notowany walor z krótkiej listy (głównie ETF-y sektorowe i surowce), którego dotyczy
Teza, np. SOXX, ITA, Brent.
_Avoid_: ticker, spółka, aktywo
_W kodzie_: `Instrument`

**Teza**:
Stanowisko właściciela wobec Zdarzenia: Kierunek zmiany ceny Instrumentu w obrębie Horyzontu,
z Uzasadnieniem.
_Avoid_: zakład, typ, prognoza, zlecenie

**Kierunek**:
Oczekiwany ruch ceny Instrumentu w Tezie: wzrost, spadek albo bez zmian (ruch w granicach ±2%).
_Avoid_: pozycja, long/short

**Horyzont**:
Czas, po którym Teza podlega Rozstrzygnięciu.
_Avoid_: termin, deadline, timeframe

**Uzasadnienie**:
Krótki tekst właściciela: dlaczego tak uważa. Po Rozstrzygnięciu pozwala ocenić, czy trafił
z dobrego powodu.
_Avoid_: notatka, komentarz, opis

**Rozstrzygnięcie**:
Werdykt po upływie Horyzontu, czy Teza okazała się trafna — liczony automatycznie z ceny
Instrumentu przy postawieniu Tezy i po Horyzoncie.
_Avoid_: rozliczenie, settlement, ocena

**Wynik**:
Trafność właściciela liczona z Rozstrzygniętych Tez: ogólna, per Temat i per Region.
_Avoid_: score, ranking, punkty
