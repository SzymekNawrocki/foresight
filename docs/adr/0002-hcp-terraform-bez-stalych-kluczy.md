# HCP Terraform (VCS-driven) i zero stałych kluczy

Stan Terraforma i wykonanie `plan`/`apply` żyją w HCP Terraform (darmowy tier), wyzwalane przez VCS z GitHuba. Do AWS logują się przez dynamic provider credentials (OIDC). GitHub Actions odpowiada za testy i skany, a do AWS wchodzi wyłącznie rolą `deploy` przez własne OIDC. Dzięki temu nigdzie nie istnieje długo żyjący klucz: ani do AWS, ani do HCP.

## Considered Options

- **Stan w S3** — standard branżowy, ale S3 nie jest „always free" (łamie [ADR 0001](./0001-architektura-always-free.md)).
- **Wykonanie Terraforma w GitHub Actions, HCP tylko jako backend stanu** — jeden pipeline, ale GitHub potrzebowałby stałego tokena API do HCP.

## Consequences

- Pipeline żyje w dwóch miejscach. Reguła 0 zł i Checkov działają statycznie na kodzie HCL w GitHub Actions, bo plan w JSON powstaje w HCP.
- Kod aplikacji nie idzie przez Terraform: Terraform tworzy funkcje z kodem-zaślepką i ignoruje zmiany kodu (`ignore_changes`), a GitHub Actions wgrywa podpisane paczki ZIP.
- Dwie bramki human-in-the-loop: zatwierdzenie `apply` w HCP i zatwierdzenie deployu w GitHub Environment.
