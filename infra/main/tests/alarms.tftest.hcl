# Contract of slice 09 without AWS: the owner hears about a broken pipeline by e-mail.
variables {
  alarm_email = "owner@example.com"
}

mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

run "three_alarms_mail_the_owner" {
  command = plan

  override_resource {
    target          = aws_sns_topic.alarms
    override_during = plan
    values = {
      arn = "arn:aws:sns:eu-central-1:123456789012:foresight-prod-alarms"
    }
  }

  assert {
    condition     = aws_sns_topic_subscription.owner.protocol == "email" && aws_sns_topic_subscription.owner.endpoint == "owner@example.com"
    error_message = "Alarms go to the owner's e-mail."
  }

  assert {
    condition = alltrue([
      for a in [aws_cloudwatch_metric_alarm.worker_errors, aws_cloudwatch_metric_alarm.analysis_stalled, aws_cloudwatch_metric_alarm.ingest_silent] :
      a.alarm_actions == toset([aws_sns_topic.alarms.arn]) && a.ok_actions == toset([aws_sns_topic.alarms.arn])
    ])
    error_message = "Every alarm mails both the problem and the recovery."
  }

  assert {
    condition = alltrue([
      for a in [aws_cloudwatch_metric_alarm.worker_errors, aws_cloudwatch_metric_alarm.analysis_stalled, aws_cloudwatch_metric_alarm.ingest_silent] :
      a.period >= 60 && a.extended_statistic == null
    ])
    error_message = "Standard-resolution alarms only — high resolution is not free."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.ingest_silent.treat_missing_data == "breaching"
    error_message = "No run at all is the silence this alarm exists for."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.analysis_stalled.metric_name == "AnalysisBacklog" && aws_cloudwatch_metric_alarm.ingest_silent.metric_name == "NewEvents"
    error_message = "The alarms watch the metrics the worker writes in its run log."
  }
}
