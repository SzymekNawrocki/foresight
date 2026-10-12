# Contract of slice 02b without AWS: the provider is mocked, nothing is created or billed.
mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

run "events_table_stays_in_always_free" {
  command = plan

  assert {
    condition     = aws_dynamodb_table.events.billing_mode == "PROVISIONED"
    error_message = "On-demand has no free requests — the table must be provisioned (docs/data-model.md)."
  }

  assert {
    condition = (
      aws_dynamodb_table.events.read_capacity + sum([for g in aws_dynamodb_table.events.global_secondary_index : g.read_capacity]) <= 25 &&
      aws_dynamodb_table.events.write_capacity + sum([for g in aws_dynamodb_table.events.global_secondary_index : g.write_capacity]) <= 25
    )
    error_message = "Table + indexes must stay within the always-free 25 RCU / 25 WCU."
  }

  assert {
    condition     = aws_dynamodb_table.events.deletion_protection_enabled
    error_message = "The events table must be protected from accidental deletion."
  }
}

run "ingest_runs_hourly_without_retries" {
  command = plan

  assert {
    condition     = aws_scheduler_schedule.ingest.schedule_expression == "rate(1 hour)"
    error_message = "Ingest runs once an hour."
  }

  assert {
    condition     = aws_scheduler_schedule.ingest.target[0].retry_policy[0].maximum_retry_attempts == 0
    error_message = "A failed run waits for the next hour instead of retrying."
  }

  assert {
    condition     = aws_lambda_function.ingest.environment[0].variables.TABLE_NAME == aws_dynamodb_table.events.name
    error_message = "The ingest Lambda writes to the events table."
  }
}

run "web_reads_only_the_latest_index" {
  command = plan

  # The table ARN is computed; give it a fixed value already at plan time.
  override_resource {
    target          = aws_dynamodb_table.events
    override_during = plan
    values = {
      arn = "arn:aws:dynamodb:eu-central-1:123456789012:table/foresight-prod-events"
    }
  }

  assert {
    condition     = aws_lambda_function.web.environment[0].variables.EVENTS_TABLE_NAME == aws_dynamodb_table.events.name
    error_message = "The web Lambda reads from the events table."
  }

  assert {
    condition     = length(data.aws_iam_policy_document.web_events.statement) == 1
    error_message = "The web role gets exactly one DynamoDB statement."
  }

  assert {
    condition     = data.aws_iam_policy_document.web_events.statement[0].actions == toset(["dynamodb:Query"])
    error_message = "The web role may only Query — no Scan, GetItem or writes."
  }

  assert {
    condition     = data.aws_iam_policy_document.web_events.statement[0].resources == toset(["${aws_dynamodb_table.events.arn}/index/latest"])
    error_message = "The web role may only read the `latest` index, not the base table."
  }
}
