locals {
  github_host        = "token.actions.githubusercontent.com"
  github_audience    = "sts.amazonaws.com"
  github_environment = "repo:SzymekNawrocki@129281704/foresight@1383949825:environment:production"
  web_function_name  = "foresight-prod-web"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# GitHub Actions as a trusted identity provider. No thumbprint — AWS validates
# the certificate of token.actions.githubusercontent.com itself, via trusted CAs.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_host}"
  client_id_list = [local.github_audience]
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.github_host}:aud"
      values   = [local.github_audience]
    }

    # Only jobs running in the `production` Environment of this repo — a PR or
    # another branch gets a different `sub` and is denied. The repo uses immutable
    # subjects (owner@id/repo@id), so a renamed or re-created repo cannot match.
    condition {
      test     = "StringEquals"
      variable = "${local.github_host}:sub"
      values   = [local.github_environment]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "foresight-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_trust.json
  max_session_duration = 3600
}

# Code only: upload a ZIP, wait for it, publish a version. No config, no IAM, no other functions.
data "aws_iam_policy_document" "github_deploy" {
  statement {
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:GetFunction",
      "lambda:PublishVersion",
    ]
    resources = [
      "arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:function:${local.web_function_name}",
    ]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy-web"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
