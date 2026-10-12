# Wartości do zmiennych środowiskowych workspace'u foresight-prod
# (TFC_AWS_PLAN_ROLE_ARN / TFC_AWS_APPLY_ROLE_ARN) — nie do repo.
output "plan_role_arn" {
  value = aws_iam_role.hcp["plan"].arn
}

output "apply_role_arn" {
  value = aws_iam_role.hcp["apply"].arn
}

# Value for the AWS_DEPLOY_ROLE_ARN variable of the GitHub Environment `production` — not a secret.
output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
