# Groq zamiast Gemini jako darmowy model AI

Scenariusze generuje Groq (`openai/gpt-oss-20b`, darmowy plan, Zero Data Retention włączone). Wybraliśmy go, bo warunki Gemini API wymagają płatnych usług przy udostępnianiu appki użytkownikom z EOG, Szwajcarii i UK („You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom"). Groq umownie zakazuje trenowania na danych klienta i nie ma takiej klauzuli regionalnej. Stan na 2026-09-15.

## Considered Options

- **Claude API, OpenAI, AWS Bedrock** — płatne.
- **Gemini API (darmowy tier)** — klauzula EOG/CH/UK opisana wyżej.
- **GitHub Models** — wycofane 30.07.2026.
- **Mistral (plan Experiment)** — wymaga zgody na trenowanie na danych, przeznaczony do ewaluacji, ok. 1 zapytanie na minutę.
- **Lokalna Ollama** — Lambda w chmurze nie ma do niej dostępu.

## Consequences

- Dane trafiają do USA. Akceptowalne, bo do modelu idą wyłącznie publiczne Zdarzenia, nigdy Tezy.
- Limit 8K tokenów na minutę wymusza przetwarzanie Zdarzeń po kolei, z pauzami.
- API zgodne z formatem OpenAI i walidacja odpowiedzi schematem Zod sprawiają, że zmiana dostawcy jest tania.
