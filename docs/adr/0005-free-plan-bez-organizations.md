# Free plan AWS bez Organizations i bez SSO

Konto AWS zostaje na Free plan. Na tym planie konto nie może wygenerować rachunku: błąd w trakcie nauki zjada kredyty, a nie pieniądze. Założenie AWS Organizations (wymagane przez IAM Identity Center do logowania na konta AWS) automatycznie przełącza konto na Paid plan i kasuje kredyty. Dlatego człowiek loguje się jako użytkownik IAM z MFA, a do CLI używa `aws login`, które wydaje krótkotrwałe poświadczenia na podstawie logowania do konsoli (wersję CLI sprawdzić przy konfiguracji). Zasada „zero stałych kluczy" zostaje zachowana. Stan na 2026-09-23.

## Considered Options

- **Paid plan + Organizations + IAM Identity Center** — wzorzec branżowy, ale bez twardej blokady kosztów; pomyłka = realny rachunek.
- **Użytkownik IAM z access keys** — łamie zasadę „zero stałych kluczy".

## Consequences

- Konto na Free plan zostaje zamknięte po 6 miesiącach (lub po wyczerpaniu kredytów), jeśli nie przejdzie na Paid plan. Przed tym terminem trzeba świadomie zdecydować: przejście na Paid (architektura wciąż kosztuje 0 zł, ale bez twardej blokady) albo eksport wiedzy i zamknięcie.
- Przy przejściu na Paid plan: osobny plaster z Organizations i IAM Identity Center.
- Uprawnienia człowieka nadawane przez polityki IAM użytkownika, nie przez permission sets.
