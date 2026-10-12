# No AWS WAF while the account is on the AWS Free plan

The CloudFront distribution runs without AWS WAF. CloudFront flat-rate pricing plans, whose Free tier bundles a web ACL at no cost, are not available to accounts on the AWS Free Tier, and a standalone web ACL is billed monthly, which breaks the zero-cost rule (ADR 0001). The account stays on the Free plan (ADR 0005). As of 2026-10-12.

Accepted risk: application-layer (L7) request floods and malicious payloads reach the Lambda unfiltered. It is bounded by:

- the Free plan itself: it cannot incur charges, so a flood burns credits or, at worst, closes the account (the app goes down; no bill),
- the account-wide Lambda concurrency limit of 10, which caps parallel executions (reserving concurrency per function is not possible below that limit),
- AWS Shield Standard on CloudFront for L3/L4 attacks, included at no cost,
- input validation in the app and Semgrep in CI for payload-level attacks.

## Considered Options

- **CloudFront flat-rate Free plan (WAF included)** — not eligible: the account is on the AWS Free Tier.
- **Standalone web ACL** — monthly charge per web ACL plus per-rule and per-request fees.

## Consequences

- Checkov findings `CKV_AWS_68` and `CKV2_AWS_47` are skipped with a reference to this ADR.
- Revisit when the account moves to the Paid plan (decision due before the Free plan ends, ADR 0005): subscribe the distribution to the flat-rate Free plan, which requires associating a web ACL.

Sources: [CloudFront flat-rate pricing plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html) (account-level constraints), [Choosing an AWS Free Tier plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html).
