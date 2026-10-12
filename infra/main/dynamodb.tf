# Events from all Sources. Model and capacity: docs/data-model.md.
resource "aws_dynamodb_table" "events" {
  #checkov:skip=CKV_AWS_28:Point-in-time recovery is billed per GB (0 PLN); Events can be re-fetched from the feeds
  #checkov:skip=CKV_AWS_119:Customer-managed KMS key costs ~1 USD/month (0 PLN); data is encrypted with an AWS-owned key anyway
  #checkov:skip=CKV2_AWS_16:Auto scaling creates CloudWatch alarms; fixed capacity is sized for always free
  name                        = "foresight-${var.environment}-events"
  billing_mode                = "PROVISIONED"
  read_capacity               = 5
  write_capacity              = 5
  hash_key                    = "id"
  deletion_protection_enabled = true

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "kind"
    type = "S"
  }

  attribute {
    name = "publishedAt"
    type = "S"
  }

  # Latest N Events: kind = EVENT, newest publishedAt first.
  global_secondary_index {
    name            = "latest"
    hash_key        = "kind"
    range_key       = "publishedAt"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5
  }
}
