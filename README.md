# Foresight

Geopolityczno-rynkowa gra strategiczna na realnych danych: świat dostarcza Zdarzenia, AI
rozpisuje je na Scenariusze, a gracz stawia Tezy i jest rozliczany z trafności.

Projekt treningowy: mała appka, cały ciężar w procesie — serverless AWS w darmowym planie
(0 zł bez limitu czasu), Terraform w HCP, zero stałych kluczy, bramki bezpieczeństwa w CI,
AI-native SDLC.

- Zakres i architektura: [SPEC.md](SPEC.md)
- Słownik domeny: [CONTEXT.md](CONTEXT.md)
- Decyzje architektoniczne: [docs/adr/](docs/adr/)

## Uruchomienie lokalne

Wymaga Node.js 22+ i pnpm (`corepack enable pnpm`).

```
pnpm install
pnpm dev
```

Strona: http://localhost:5173
