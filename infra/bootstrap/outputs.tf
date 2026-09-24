# Wartości do zmiennych środowiskowych workspace'u foresight-prod
# (TFC_AWS_PLAN_ROLE_ARN / TFC_AWS_APPLY_ROLE_ARN) — nie do repo.
output "plan_role_arn" {
  value = aws_iam_role.hcp["plan"].arn
}

output "apply_role_arn" {
  value = aws_iam_role.hcp["apply"].arn
}
