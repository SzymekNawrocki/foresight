# Logowanie właściciela (plaster 06): Cognito, poziom Essentials — 10 000 MAU/mies. za darmo
# bezterminowo. Jedno konto zakładane ręcznie przez admina; samodzielnej rejestracji brak.

locals {
  # Stały adres strony. Klient Cognito (callback) nie może wskazywać na zasób CloudFront —
  # CloudFront → Lambda → klient Cognito tworzyłoby cykl. Adres dystrybucji nie zmienia się,
  # dopóki istnieje ten sam zasób (output `cloudfront_url` pokazuje go po każdym apply).
  app_url     = "https://d1fsk10xga8rek.cloudfront.net"
  auth_prefix = "foresight-${var.environment}-${substr(sha1(data.aws_caller_identity.current.account_id), 0, 8)}"
  auth_domain = "https://${local.auth_prefix}.auth.${data.aws_region.current.region}.amazoncognito.com"
}

resource "aws_cognito_user_pool" "owner" {
  name                     = "foresight-${var.environment}-owner"
  deletion_protection      = "ACTIVE"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Konto zakłada tylko admin (aws cognito-idp admin-create-user) — obcy nie zarejestruje się.
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  # TOTP (aplikacja typu Authenticator) — do włączenia przez właściciela; SMS kosztuje, więc brak.
  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "owner" {
  domain                = local.auth_prefix
  user_pool_id          = aws_cognito_user_pool.owner.id
  managed_login_version = 1
}

# Klient publiczny (SPA): bez sekretu, Authorization Code + PKCE, krótkie tokeny.
resource "aws_cognito_user_pool_client" "web" {
  name                                 = "foresight-${var.environment}-web"
  user_pool_id                         = aws_cognito_user_pool.owner.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${local.app_url}/auth/callback"]
  logout_urls                          = ["${local.app_url}/"]
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  access_token_validity                = 1
  id_token_validity                    = 1
  refresh_token_validity               = 1

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
