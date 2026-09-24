# Widoczne na stronie runa w HCP i przez `terraform output` — szybki dowód, co workspace postawił.
output "resource_group_name" {
  description = "Nazwa grupy zasobów projektu w AWS."
  value       = aws_resourcegroups_group.project.name
}

output "resource_group_arn" {
  description = "ARN grupy zasobów projektu."
  value       = aws_resourcegroups_group.project.arn
}
