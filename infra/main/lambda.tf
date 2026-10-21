# Lambda „web” — na razie zaślepka „hello”. Prawdziwy kod appki wdroży pipeline (01b-3/01b-4),
# dlatego Terraform tworzy funkcję, ale potem nie rusza jej kodu (ignore_changes).
locals {
  web_function_name = "foresight-${var.environment}-web"
}

data "archive_file" "web_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.build/web-placeholder.zip"

  source {
    filename = "index.mjs"
    content  = <<-JS
      export const handler = async () => ({
        statusCode: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: "hello from foresight",
      });
    JS
  }
}

# Zaakceptowane (PR #14): logi i tak szyfruje klucz AWS; własny KMS to ~1 USD/mies. — łamie 0 zł.
# nosemgrep: terraform.aws.security.aws-cloudwatch-log-group-unencrypted.aws-cloudwatch-log-group-unencrypted
resource "aws_cloudwatch_log_group" "web" {
  #checkov:skip=CKV_AWS_158:Customer-managed KMS key costs ~1 USD/month (0 PLN); logs are encrypted with an AWS key anyway
  #checkov:skip=CKV_AWS_338:7-day retention keeps storage inside the always-free 5 GB
  name              = "/aws/lambda/${local.web_function_name}"
  retention_in_days = 7
}

data "aws_iam_policy_document" "web_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "web" {
  name               = "${local.web_function_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.web_assume.json
}

# Zamiast zarządzanej AWSLambdaBasicExecutionRole (logi do dowolnej grupy) — tylko własna log group.
data "aws_iam_policy_document" "web_logs" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.web.arn}:*"]
  }
}

resource "aws_iam_role_policy" "web_logs" {
  name   = "logs"
  role   = aws_iam_role.web.id
  policy = data.aws_iam_policy_document.web_logs.json
}

# GET /api/events and /api/recent: Query on the `latest` index only — no base table, no Scan, no writes.
data "aws_iam_policy_document" "web_events" {
  statement {
    actions   = ["dynamodb:Query"]
    resources = ["${aws_dynamodb_table.events.arn}/index/latest"]
  }
}

resource "aws_iam_role_policy" "web_events" {
  name   = "read-latest-events"
  role   = aws_iam_role.web.id
  policy = data.aws_iam_policy_document.web_events.json
}

# /api/threads*: read Threads, timelines and reports; write only through the owner's decisions on
# New situations (accept, merge, reject). The token counters (BUDGET#) stay out of reach.
data "aws_iam_policy_document" "web_threads" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.threads.arn]

    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["THREADS", "THREAD#*"]
    }
  }
}

resource "aws_iam_role_policy" "web_threads" {
  name   = "threads"
  role   = aws_iam_role.web.id
  policy = data.aws_iam_policy_document.web_threads.json
}

# Zaakceptowane (PR #14): X-Ray czeka na decyzję o obserwowalności — bez WAF publiczny ruch
# mógłby wybić ślady ponad darmowy limit.
# nosemgrep: terraform.aws.security.aws-lambda-x-ray-tracing-not-active.aws-lambda-x-ray-tracing-not-active
resource "aws_lambda_function" "web" {
  #checkov:skip=CKV_AWS_50:X-Ray waits for the observability decision (PR #14)
  #checkov:skip=CKV_AWS_115:Account concurrency limit is 10 and AWS keeps 10 unreserved, so nothing can be reserved; the account limit caps it (ADR 0006)
  #checkov:skip=CKV_AWS_116:Invoked synchronously through the Function URL; a DLQ only applies to async invocations
  #checkov:skip=CKV_AWS_117:No private resources to reach; a VPC with outbound internet needs a paid NAT gateway (0 PLN)
  #checkov:skip=CKV_AWS_272:The ZIP is signed with cosign and verified in deploy.yml before upload (#18)
  #checkov:skip=CKV_AWS_173:The table name, user pool and client ids are public identifiers, not secrets; AWS encrypts environment variables at rest by default
  function_name = local.web_function_name
  role          = aws_iam_role.web.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  memory_size   = 128
  timeout       = 10
  handler       = "index.handler"

  filename         = data.archive_file.web_placeholder.output_path
  source_code_hash = data.archive_file.web_placeholder.output_base64sha256

  # EVENTS_TABLE_NAME is not a secret; AWS-managed key encrypts it at rest.
  # nosemgrep: terraform.aws.security.aws-lambda-environment-unencrypted.aws-lambda-environment-unencrypted
  environment {
    variables = {
      EVENTS_TABLE_NAME   = aws_dynamodb_table.events.name
      THREADS_TABLE_NAME  = aws_dynamodb_table.threads.name
      USER_POOL_ID        = aws_cognito_user_pool.owner.id
      USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.web.id
      AUTH_DOMAIN         = local.auth_domain
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.web.name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  depends_on = [aws_iam_role_policy.web_logs, aws_iam_role_policy.web_events, aws_iam_role_policy.web_threads]
}

# AWS_IAM = bez podpisu SigV4 Function URL odpowiada 403; podpisuje tylko CloudFront (OAC).
resource "aws_lambda_function_url" "web" {
  function_name      = aws_lambda_function.web.function_name
  authorization_type = "AWS_IAM"
}
