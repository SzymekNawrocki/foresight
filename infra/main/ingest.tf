# Lambda "ingest": every hour reads the Sources and stores new Events. Terraform creates the
# function with a placeholder; the real code comes from the deploy pipeline (ignore_changes).
locals {
  ingest_function_name = "foresight-${var.environment}-ingest"

  # Created by hand as a SecureString (aws/ssm key), so the value never enters Terraform state:
  # aws ssm put-parameter --name /foresight/prod/groq-api-key --type SecureString --value <key>
  groq_key_parameter = "/foresight/${var.environment}/groq-api-key"
}

data "archive_file" "ingest_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.build/ingest-placeholder.zip"

  source {
    filename = "index.mjs"
    content  = "export const handler = async () => ({ placeholder: true });"
  }
}

# nosemgrep: terraform.aws.security.aws-cloudwatch-log-group-unencrypted.aws-cloudwatch-log-group-unencrypted
resource "aws_cloudwatch_log_group" "ingest" {
  #checkov:skip=CKV_AWS_158:Customer-managed KMS key costs ~1 USD/month (0 PLN); logs are encrypted with an AWS key anyway
  #checkov:skip=CKV_AWS_338:7-day retention keeps storage inside the always-free 5 GB
  name              = "/aws/lambda/${local.ingest_function_name}"
  retention_in_days = 7
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ingest" {
  name               = "${local.ingest_function_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Write new Events, read the Analysis queue, save Analyses, count tokens, read the one Groq key
# and write its own logs — nothing else (no scans, no deletes, no other parameters).
data "aws_iam_policy_document" "ingest" {
  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.events.arn]
  }

  # The queue, and the last 48 h of Analyses for near-duplicates (slice 10).
  statement {
    actions = ["dynamodb:Query"]
    resources = [
      "${aws_dynamodb_table.events.arn}/index/pending",
      "${aws_dynamodb_table.events.arn}/index/latest",
    ]
  }

  # Daily token counters only (slice 09); Threads and Situation reports come in slice 10.
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.threads.arn]

    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["BUDGET#*"]
    }
  }

  # The aws/ssm key policy lets account principals decrypt through SSM, so no kms:Decrypt here.
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.groq_key_parameter}"]
  }

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.ingest.arn}:*"]
  }
}

resource "aws_iam_role_policy" "ingest" {
  name   = "ingest"
  role   = aws_iam_role.ingest.id
  policy = data.aws_iam_policy_document.ingest.json
}

# nosemgrep: terraform.aws.security.aws-lambda-x-ray-tracing-not-active.aws-lambda-x-ray-tracing-not-active
resource "aws_lambda_function" "ingest" {
  #checkov:skip=CKV_AWS_50:X-Ray waits for the observability decision (PR #14)
  #checkov:skip=CKV_AWS_115:Account concurrency limit is 10 and AWS keeps 10 unreserved, so nothing can be reserved (ADR 0006)
  #checkov:skip=CKV_AWS_116:A failed run is logged and the next hour retries; nothing to replay from a DLQ
  #checkov:skip=CKV_AWS_117:Only reaches public feeds and DynamoDB; a VPC with outbound internet needs a paid NAT gateway (0 PLN)
  #checkov:skip=CKV_AWS_272:The ZIP is signed with cosign and verified in deploy.yml before upload (#18)
  #checkov:skip=CKV_AWS_173:TABLE_NAME and the SSM parameter name are not secrets; AWS encrypts environment variables at rest by default
  function_name = local.ingest_function_name
  role          = aws_iam_role.ingest.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  memory_size   = 256
  # Up to 10 Groq calls with 12 s pauses after the ingest.
  timeout = 300
  handler = "index.handler"

  filename         = data.archive_file.ingest_placeholder.output_path
  source_code_hash = data.archive_file.ingest_placeholder.output_base64sha256

  # TABLE_NAME is not a secret; AWS-managed key encrypts it at rest.
  # nosemgrep: terraform.aws.security.aws-lambda-environment-unencrypted.aws-lambda-environment-unencrypted
  environment {
    variables = {
      TABLE_NAME         = aws_dynamodb_table.events.name
      THREADS_TABLE_NAME = aws_dynamodb_table.threads.name
      GROQ_KEY_PARAMETER = local.groq_key_parameter
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.ingest.name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  depends_on = [aws_iam_role_policy.ingest]
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    # Only schedules in this account may use the role (confused deputy).
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.ingest_function_name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.ingest.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "invoke-ingest"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "ingest" {
  #checkov:skip=CKV_AWS_297:The schedule holds no secrets (a function ARN); a KMS key costs ~1 USD/month (0 PLN)
  name                = local.ingest_function_name
  schedule_expression = "rate(1 hour)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.ingest.arn
    role_arn = aws_iam_role.scheduler.arn

    # A failed run waits for the next hour; retries would only hammer the feeds.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
