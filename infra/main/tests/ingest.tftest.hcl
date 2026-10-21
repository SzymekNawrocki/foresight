# Contract of slice 02b without AWS: the provider is mocked, nothing is created or billed.
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

run "all_tables_together_stay_in_always_free" {
  command = plan

  assert {
    condition     = aws_dynamodb_table.threads.billing_mode == "PROVISIONED" && length(aws_dynamodb_table.threads.global_secondary_index) == 0
    error_message = "threads is a provisioned single-table design without indexes (ADR 0009)."
  }

  assert {
    condition = (
      aws_dynamodb_table.events.read_capacity + sum([for g in aws_dynamodb_table.events.global_secondary_index : g.read_capacity]) + aws_dynamodb_table.threads.read_capacity <= 25 &&
      aws_dynamodb_table.events.write_capacity + sum([for g in aws_dynamodb_table.events.global_secondary_index : g.write_capacity]) + aws_dynamodb_table.threads.write_capacity <= 25
    )
    error_message = "All tables and indexes share the account-wide 25 RCU / 25 WCU."
  }

  assert {
    condition     = one(aws_dynamodb_table.threads.ttl).enabled && one(aws_dynamodb_table.threads.ttl).attribute_name == "expiresAt"
    error_message = "Budget counters expire through TTL, so the table does not grow."
  }

  assert {
    condition     = aws_dynamodb_table.threads.deletion_protection_enabled
    error_message = "The threads table must be protected from accidental deletion."
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

run "web_writes_threads_only_through_owner_partitions" {
  command = plan

  assert {
    condition     = aws_lambda_function.web.environment[0].variables.THREADS_TABLE_NAME == aws_dynamodb_table.threads.name
    error_message = "The web Lambda serves Threads from the threads table."
  }

  assert {
    condition     = one(data.aws_iam_policy_document.web_threads.statement[0].condition).values == tolist(["THREADS", "THREAD#*"])
    error_message = "The web role must never reach the token counters (BUDGET#)."
  }

  assert {
    condition     = !contains(tolist(data.aws_iam_policy_document.web_threads.statement[0].actions), "dynamodb:DeleteItem") && !contains(tolist(data.aws_iam_policy_document.web_threads.statement[0].actions), "dynamodb:Scan")
    error_message = "The web role neither deletes nor scans Threads."
  }
}

run "ingest_role_is_scoped_to_the_analysis_queue_and_one_key" {
  command = plan

  override_resource {
    target          = aws_dynamodb_table.events
    override_during = plan
    values = {
      arn = "arn:aws:dynamodb:eu-central-1:123456789012:table/foresight-prod-events"
    }
  }

  assert {
    condition     = length(aws_dynamodb_table.events.global_secondary_index) == 2
    error_message = "Two indexes: `latest` for the page and the sparse `pending` queue for the Analysis."
  }

  assert {
    condition     = data.aws_iam_policy_document.ingest.statement[0].actions == toset(["dynamodb:PutItem", "dynamodb:UpdateItem"])
    error_message = "Ingest writes Events and Analyses — no deletes, no scans."
  }

  assert {
    condition     = data.aws_iam_policy_document.ingest.statement[1].resources == toset(["${aws_dynamodb_table.events.arn}/index/pending", "${aws_dynamodb_table.events.arn}/index/latest"])
    error_message = "Ingest may Query only the `pending` queue and the `latest` index (near-duplicates), never the table itself."
  }

  assert {
    condition     = data.aws_iam_policy_document.ingest.statement[3].actions == toset(["ssm:GetParameter"])
    error_message = "Ingest may only read a parameter, never write one."
  }

  assert {
    condition     = endswith(one(data.aws_iam_policy_document.ingest.statement[3].resources), ":parameter/foresight/prod/groq-api-key")
    error_message = "Ingest may read exactly one parameter: the Groq key."
  }

  assert {
    condition     = data.aws_iam_policy_document.ingest.statement[2].actions == toset(["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"])
    error_message = "The worker keeps counters, Threads and reports — no deletes, no scans."
  }

  assert {
    condition     = one(data.aws_iam_policy_document.ingest.statement[2].condition).values == tolist(["BUDGET#*", "THREADS", "THREAD#*"])
    error_message = "The worker may touch only budget, Thread list and Thread partitions of the threads table."
  }

  assert {
    condition     = aws_lambda_function.ingest.environment[0].variables.THREADS_TABLE_NAME == aws_dynamodb_table.threads.name
    error_message = "The worker keeps its token counters in the threads table."
  }

  assert {
    condition     = aws_lambda_function.ingest.timeout >= 600 && aws_lambda_function.ingest.timeout <= 900
    error_message = "The run needs time for paced dispatch batches and up to 3 reports, within the 15-minute Lambda limit."
  }
}
