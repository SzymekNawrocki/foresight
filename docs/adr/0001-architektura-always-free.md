# Architektura wyłącznie na usługach „always free"

Projekt ma kosztować 0 zł bez limitu czasu, nie tylko przez 6 miesięcy kredytów darmowego planu AWS. Dlatego architektura składa się wyłącznie z usług, które mają stałe darmowe limity: CloudFront (flat-rate plan Free z WAF), Lambda z Function URL, DynamoDB, EventBridge Scheduler i SSM Parameter Store. Reguła w CI blokuje każdy zasób spoza listy.

## Considered Options

- **EC2 + Docker Compose, Fargate/RDS/ALB** — płatne po kredytach albo od pierwszej godziny.
- **S3 jako origin frontendu** — podręcznikowy wzorzec, ale żądania GET do S3 nie są objęte kredytem planu Free CloudFrontu. Dlatego frontend serwuje Lambda.
- **Lambda z obrazów kontenerowych** — wymaga prywatnego ECR, który nie jest „always free". Dlatego paczki ZIP.
- **API Gateway** — darmowe tylko przez 12 miesięcy. Dlatego Function URL za CloudFrontem z OAC.
- **Secrets Manager** — płatny od sekretu. Dlatego SSM Parameter Store (SecureString, standard tier).
- **Postgres (RDS)** — płatny. Dlatego DynamoDB, co wymusza modelowanie danych pod zapytania.

## Consequences

- Frontend musi dać się wyeksportować statycznie (brak SSR).
- Brak własnej domeny — appka działa pod `*.cloudfront.net`.
- Konto działa na darmowym planie AWS i zostanie zamknięte po 6 miesiącach, jeśli nie przejdziemy na plan płatny. Architektura jest przygotowana tak, żeby po takim przejściu nadal kosztowała 0 zł.
