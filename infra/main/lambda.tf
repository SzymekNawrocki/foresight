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

# Zaakceptowane (PR #14): X-Ray czeka na decyzję o obserwowalności — bez WAF publiczny ruch
# mógłby wybić ślady ponad darmowy limit.
# nosemgrep: terraform.aws.security.aws-lambda-x-ray-tracing-not-active.aws-lambda-x-ray-tracing-not-active
resource "aws_lambda_function" "web" {
  function_name = local.web_function_name
  role          = aws_iam_role.web.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  memory_size   = 128
  timeout       = 10
  handler       = "index.handler"

  filename         = data.archive_file.web_placeholder.output_path
  source_code_hash = data.archive_file.web_placeholder.output_base64sha256

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.web.name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  depends_on = [aws_iam_role_policy.web_logs]
}

# AWS_IAM = bez podpisu SigV4 Function URL odpowiada 403; podpisuje tylko CloudFront (OAC).
resource "aws_lambda_function_url" "web" {
  function_name      = aws_lambda_function.web.function_name
  authorization_type = "AWS_IAM"
}
