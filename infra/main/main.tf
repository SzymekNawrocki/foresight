# Pierwszy zasób: grupa zbierająca wszystko z tagiem projektu — darmowa, a w konsoli
# widać w jednym miejscu, co Foresight postawił w regionie.
resource "aws_resourcegroups_group" "project" {
  name = "foresight-${var.environment}"
  # AWS przyjmuje tu tylko litery ASCII, cyfry, spacje oraz _ . -
  description = "Foresight ${var.environment} resources managed by Terraform"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "project", Values = ["foresight"] },
        { Key = "environment", Values = [var.environment] },
      ]
    })
  }
}
