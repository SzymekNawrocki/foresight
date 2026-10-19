# Alarms that e-mail the owner when the pipeline stops working (ADR 0009). Always free:
# 10 standard alarms and 10 custom metrics in CloudWatch, 1,000 e-mails a month from SNS.
# The worker's run log carries two metrics in Embedded Metric Format (namespace Foresight):
# NewEvents and AnalysisBacklog — no metric filters needed.

variable "alarm_email" {
  description = "E-mail właściciela na alarmy; ustawiany w zmiennych workspace'u HCP, nie w repo."
  type        = string
}

locals {
  metrics_namespace = "Foresight"
}

# Unencrypted on purpose — same reason as the Checkov skip below.
#trivy:ignore:AWS-0095
resource "aws_sns_topic" "alarms" { # nosemgrep: terraform.aws.security.aws-sns-topic-unencrypted.aws-sns-topic-unencrypted
  #checkov:skip=CKV_AWS_26:CloudWatch cannot publish to a topic encrypted with aws/sns, and a customer key costs ~1 USD/month (0 PLN); alarm texts hold no secrets
  name = "foresight-${var.environment}-alarms"
}

# The owner confirms the subscription once, from the e-mail AWS sends after the apply.
resource "aws_sns_topic_subscription" "owner" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# The handler never throws, so an error here means a crash, a timeout or a broken deploy.
resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "foresight-${var.environment}-worker-errors"
  alarm_description   = "Worker (Lambda ingest) failed in 2 hourly runs in a row."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.ingest.function_name }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# A key that expired, a changed API or constant 429s show up as a queue that only grows.
resource "aws_cloudwatch_metric_alarm" "analysis_stalled" {
  alarm_name          = "foresight-${var.environment}-analysis-stalled"
  alarm_description   = "More than 50 Events wait for their AI Analysis for 3 hours."
  namespace           = local.metrics_namespace
  metric_name         = "AnalysisBacklog"
  dimensions          = { Service = "worker" }
  statistic           = "Minimum"
  period              = 3600
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 50
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# Missing data counts as breaching: no run at all (scheduler off, every invocation failing)
# is exactly the silence this alarm is for.
resource "aws_cloudwatch_metric_alarm" "ingest_silent" {
  alarm_name          = "foresight-${var.environment}-ingest-silent"
  alarm_description   = "No new Events for 6 hours — Sources down or the schedule stopped."
  namespace           = local.metrics_namespace
  metric_name         = "NewEvents"
  dimensions          = { Service = "worker" }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 6
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}
