# Contract of slice 06 without AWS: the owner login.
variables {
  alarm_email = "owner@example.com"
}

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
}

run "only_the_owner_can_sign_in" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool.owner.admin_create_user_config[0].allow_admin_create_user_only
    error_message = "No self sign-up: the one account is created by the admin."
  }

  assert {
    condition     = aws_cognito_user_pool.owner.password_policy[0].minimum_length >= 14
    error_message = "Owner password: at least 14 characters."
  }

  assert {
    condition     = aws_cognito_user_pool.owner.deletion_protection == "ACTIVE"
    error_message = "Deleting the pool would lock the owner out."
  }
}

run "web_client_is_a_public_pkce_client" {
  command = plan

  assert {
    condition     = !aws_cognito_user_pool_client.web.generate_secret
    error_message = "A browser cannot keep a secret — the client must be public (PKCE)."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.allowed_oauth_flows == toset(["code"])
    error_message = "Authorization code flow only — no implicit tokens in the URL."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.callback_urls == toset(["https://d1fsk10xga8rek.cloudfront.net/auth/callback"])
    error_message = "Tokens may come back only to the app itself."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.access_token_validity <= 1
    error_message = "Access tokens live at most an hour."
  }
}
