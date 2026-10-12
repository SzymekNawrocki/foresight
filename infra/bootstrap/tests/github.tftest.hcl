# Checks the security contract of the GitHub deploy role without AWS: the provider is mocked,
# so the test runs locally and in CI, creates nothing and costs nothing.
# The mock returns random strings, but the IAM role validates its policy JSON — feed it a valid one.
mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }

  mock_data "aws_region" {
    defaults = {
      region = "eu-central-1"
    }
  }

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
}

run "deploy_role_trusts_only_production_environment" {
  command = plan

  assert {
    condition = anytrue([
      for c in data.aws_iam_policy_document.github_deploy_trust.statement[0].condition :
      c.test == "StringEquals" && c.variable == "token.actions.githubusercontent.com:sub"
      && toset(c.values) == toset(["repo:SzymekNawrocki@129281704/foresight@1383949825:environment:production"])
    ])
    error_message = "Only the production Environment of this repo may assume the deploy role."
  }

  assert {
    condition = anytrue([
      for c in data.aws_iam_policy_document.github_deploy_trust.statement[0].condition :
      c.variable == "token.actions.githubusercontent.com:aud" && toset(c.values) == toset(["sts.amazonaws.com"])
    ])
    error_message = "The token audience must be pinned to sts.amazonaws.com."
  }
}

run "deploy_role_touches_only_web_function_code" {
  command = plan

  assert {
    condition = toset(data.aws_iam_policy_document.github_deploy.statement[0].actions) == toset([
      "lambda:UpdateFunctionCode",
      "lambda:GetFunction",
      "lambda:PublishVersion",
    ])
    error_message = "The deploy role may only upload code, read the function and publish a version."
  }

  assert {
    condition = toset(data.aws_iam_policy_document.github_deploy.statement[0].resources) == toset([
      "arn:aws:lambda:eu-central-1:123456789012:function:foresight-prod-web",
    ])
    error_message = "The deploy role must be scoped to the foresight-prod-web function only."
  }
}
