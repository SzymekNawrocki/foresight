# Events from all Sources. Model and capacity: docs/data-model.md.
# Encrypted at rest with the AWS-owned key (free); a KMS key would add per-request or monthly cost.
# nosemgrep: terraform.aws.security.aws-dynamodb-table-unencrypted.aws-dynamodb-table-unencrypted
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

  attribute {
    name = "pending"
    type = "S"
  }

  # Latest N Events: kind = EVENT, newest publishedAt first.
  global_secondary_index {
    name            = "latest"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5

    key_schema {
      attribute_name = "kind"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "publishedAt"
      key_type       = "RANGE"
    }
  }

  # Events waiting for their AI Analysis (slice 03). Sparse: only items with `pending` are
  # indexed, and saving the Analysis removes the attribute, so the index is the queue itself.
  global_secondary_index {
    name            = "pending"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5

    key_schema {
      attribute_name = "pending"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "publishedAt"
      key_type       = "RANGE"
    }
  }
}

# Theses of the owner (slice 06). Private: only the web Lambda reads and writes them, always
# under the caller's Cognito `sub`. Model: docs/data-model.md.
# nosemgrep: terraform.aws.security.aws-dynamodb-table-unencrypted.aws-dynamodb-table-unencrypted
resource "aws_dynamodb_table" "theses" {
  #checkov:skip=CKV_AWS_28:Point-in-time recovery is billed per GB (0 PLN); see docs/data-model.md for the backup trade-off
  #checkov:skip=CKV_AWS_119:Customer-managed KMS key costs ~1 USD/month (0 PLN); data is encrypted with an AWS-owned key anyway
  #checkov:skip=CKV2_AWS_16:Auto scaling creates CloudWatch alarms; fixed capacity is sized for always free
  name                        = "foresight-${var.environment}-theses"
  billing_mode                = "PROVISIONED"
  read_capacity               = 3
  write_capacity              = 3
  hash_key                    = "owner"
  range_key                   = "id"
  deletion_protection_enabled = true

  attribute {
    name = "owner"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }
}
