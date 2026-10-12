# Widoczne na stronie runa w HCP i przez `terraform output` — szybki dowód, co workspace postawił.
output "resource_group_name" {
  description = "Nazwa grupy zasobów projektu w AWS."
  value       = aws_resourcegroups_group.project.name
}

output "resource_group_arn" {
  description = "ARN grupy zasobów projektu."
  value       = aws_resourcegroups_group.project.arn
}

output "cloudfront_url" {
  description = "Publiczny adres appki — jedyne wejście dla widza."
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "function_url" {
  description = "Bezpośredni adres Lambdy; bez podpisu ma odpowiadać 403."
  value       = aws_lambda_function_url.web.function_url
}
