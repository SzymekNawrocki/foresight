# Foresight

Publiczne narzędzie do śledzenia sytuacji geopolitycznych: świat dostarcza Zdarzenia, AI osadza je
w Regionach, Tematach i Wątkach, a dla każdego Wątku pisze Raport sytuacyjny — co to znaczy dla
rynków i relacji międzynarodowych.

## Świat

**Źródło**:
Publiczny kanał wiadomości (RSS), z którego pobierane są Zdarzenia.
_Avoid_: feed, provider
_W kodzie_: `Source`

**Poziom Źródła**:
Wiarygodność Źródła: A — pierwotne (oficjalne komunikaty rządów, organizacji, regulatorów),
B — rzetelne serwisy (redakcje z korektą i sprostowaniami), C — analizy (think tanki, media
branżowe). Fakty z A i B, interpretacje z C; tylko A i B mogą zapalić Sygnał ostrzegawczy.
_Avoid_: ranking, zaufanie, jakość
_W kodzie_: `SourceTier`

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
Możliwy rozwój Wątku w Raporcie sytuacyjnym: eskalacja, status quo albo deeskalacja,
każdy z Sygnałami ostrzegawczymi.
_Avoid_: analiza, prognoza, predykcja

**Klasa aktywów**:
Grupa instrumentów, na którą wpływa Scenariusz (np. ropa, złoto, półprzewodniki, indeksy akcji).
_Avoid_: asset, rynek

## Widoki

**Briefing**:
Strona główna: Ruchy z ostatnich 24 h, ciemna mapa z liczbą aktywnych Wątków per Region,
Wątki aktywne z najbardziej prawdopodobnym Scenariuszem i — dla właściciela — liczba Nowych
sytuacji.
_Avoid_: feed, strona główna, przegląd

**Ruch**:
Zmiana w Wątku warta uwagi: Scenariusz przesunął się na skali Prawdopodobieństwa albo zapalił
się Sygnał ostrzegawczy. Brak Ruchów w 24 h to też informacja („bez istotnych zmian”).
_Avoid_: aktualizacja, zmiana, update
_W kodzie_: `Move`

**Baza wiedzy**:
Automatyczne strony Regionów, Tematów i Aktorów: Wątki i Zdarzenia z tego obszaru; u Aktora
także, z kim najczęściej występuje w jednym Zdarzeniu.
_Avoid_: wiki, notatki, encyklopedia

**Strumień**:
Surowa lista wszystkich Zdarzeń, od najnowszych — dla tych, którzy chcą zajrzeć pod Wątki.
_Avoid_: feed, timeline

## Sytuacje

**Wątek**:
Trwająca sytuacja geopolityczna (np. „Cieśnina Ormuz”, „Tajwan i półprzewodniki”) z osią czasu
Zdarzeń i Raportem sytuacyjnym. Aktywny, gdy miał Zdarzenie w ostatnich 14 dniach; potem
uśpiony; zarchiwizowany ręcznie przez właściciela.
_Avoid_: temat (to oś Tematów), historia, sprawa, story
_W kodzie_: `Thread`

**Nowa sytuacja**:
Propozycja nowego Wątku od AI, gdy istotne Zdarzenie (Waga ≥ 2) nie pasuje do żadnego
aktywnego Wątku. Czeka na decyzję właściciela: akceptuj, połącz z istniejącym albo odrzuć.
_Avoid_: sugestia, draft
_W kodzie_: `ThreadProposal`

**Raport sytuacyjny**:
Pisany przez AI obraz Wątku: stan teraz, Aktorzy i ich interesy, Scenariusze z Sygnałami
ostrzegawczymi i Prawdopodobieństwem, narażone Klasy aktywów, wpływ na relacje
międzynarodowe i co się zmieniło. Odświeżany krocząco — Wątek z nowymi Zdarzeniami najwyżej
raz na 24 h; każda wersja zostaje jako dziennik sytuacji.
_Avoid_: podsumowanie, summary, analiza
_W kodzie_: `SituationReport`

**Sygnał ostrzegawczy**:
Obserwowalna oznaka, że sytuacja idzie w stronę danego Scenariusza („po czym to poznasz”).
Zapala się, gdy Raport wskaże Zdarzenie-dowód ze Źródła o Poziomie A albo B.
_Avoid_: wskaźnik, trigger, alert
_W kodzie_: `WarningSignal`

**Prawdopodobieństwo**:
Ocena Scenariusza na 7-stopniowej skali słownej (wg ICD 203): prawie wykluczone, bardzo mało
prawdopodobne, mało prawdopodobne, mniej więcej po równo, prawdopodobne, bardzo prawdopodobne,
niemal pewne. Bez procentów — model nie jest skalibrowany.
_Avoid_: procent, szansa, prognoza
_W kodzie_: `Likelihood`

**Aktor**:
Państwo albo organizacja z ustalonej listy (~40, np. USA, Chiny, Iran, NATO, UE, OPEC),
którego dotyczy Zdarzenie; do 4 na Zdarzenie.
_Avoid_: kraj (Aktor może być organizacją), strona, gracz
_W kodzie_: `Actor`
