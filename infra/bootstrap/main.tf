locals {
  hcp_host      = "app.terraform.io"
  hcp_audience  = "aws.workload.identity"
  hcp_workspace = "organization:devnawrocki-org:project:Default Project:workspace:foresight-prod"
}

# HCP Terraform jako zaufany dostawca tożsamości. Bez thumbprintu — AWS weryfikuje
# certyfikat app.terraform.io sam, przez zaufane CA.
resource "aws_iam_openid_connect_provider" "hcp" {
  url            = "https://${local.hcp_host}"
  client_id_list = [local.hcp_audience]
}

data "aws_iam_policy_document" "trust" {
  for_each = toset(["plan", "apply"])

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.hcp.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.hcp_host}:aud"
      values   = [local.hcp_audience]
    }

    # Tylko jeden workspace i tylko jedna faza — token z fazy plan nie przejmie roli apply.
    condition {
      test     = "StringEquals"
      variable = "${local.hcp_host}:sub"
      values   = ["${local.hcp_workspace}:run_phase:${each.key}"]
    }
  }
}

resource "aws_iam_role" "hcp" {
  for_each = data.aws_iam_policy_document.trust

  name                 = "foresight-hcp-${each.key}"
  assume_role_policy   = each.value.json
  max_session_duration = 3600
}

# plan: tylko odczyt, więc speculative plan z obcego PR-a niczego nie zmieni.
resource "aws_iam_role_policy_attachment" "plan" {
  role       = aws_iam_role.hcp["plan"].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# apply: na start pełne uprawnienia; osłona to zaufanie (jeden workspace, faza apply)
# i ręczne zatwierdzenie apply w HCP. Zawężenie do faktycznie używanych akcji — issue `later`.
resource "aws_iam_role_policy_attachment" "apply" {
  role       = aws_iam_role.hcp["apply"].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
