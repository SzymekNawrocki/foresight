# CloudFront przed Lambdą: HTTPS dla widza, a do originu każde żądanie podpisane przez OAC.
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = local.web_function_name
  description                       = "Signs CloudFront requests to the web Lambda Function URL"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Honors the origin Cache-Control (max-age), so only /api/recent — public and changing at most
# hourly — is cached at the edge.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# Host widza nie może trafić do originu — Function URL odrzuca obcy Host.
# HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection — free.
data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  # https://<id>.lambda-url.<region>.on.aws/ -> <id>.lambda-url.<region>.on.aws
  web_origin_domain = split("/", aws_lambda_function_url.web.function_url)[2]
  web_origin_id     = "lambda-web"
}

# Accepted findings: docs/adr/0006-no-waf-on-free-plan.md (WAF) and PR #14 (TLS).
# Bez własnej domeny certyfikat *.cloudfront.net nie pozwala podnieść minimalnej wersji TLS;
# domena odłożona (0 zł).
#trivy:ignore:AWS-0011
resource "aws_cloudfront_distribution" "web" { # nosemgrep: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
  #checkov:skip=CKV_AWS_68:No WAF on the AWS Free plan, see ADR 0006
  #checkov:skip=CKV2_AWS_47:No WAF on the AWS Free plan, see ADR 0006
  #checkov:skip=CKV_AWS_174:Default *.cloudfront.net certificate cannot raise min TLS; no custom domain (0 PLN), PR #14
  #checkov:skip=CKV2_AWS_42:No custom domain (0 PLN), PR #14
  #checkov:skip=CKV_AWS_86:Access logs need S3 or paid vended-log delivery (0 PLN, ADR 0001)
  #checkov:skip=CKV_AWS_310:Single Lambda origin in one region; failover origin has nothing to fail over to
  #checkov:skip=CKV_AWS_305:Origin is a Lambda that serves / itself; a root object applies to S3 origins
  #checkov:skip=CKV_AWS_374:Public app, no reason to block countries
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Foresight ${var.environment} web"
  price_class     = "PriceClass_100"

  origin {
    origin_id                = local.web_origin_id
    domain_name              = local.web_origin_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id           = local.web_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
    compress                   = true
  }

  ordered_cache_behavior {
    path_pattern               = "/api/recent"
    target_origin_id           = local.web_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
    compress                   = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# OAC dla Lambdy wymaga obu uprawnień, każde zawężone do tej jednej dystrybucji.
resource "aws_lambda_permission" "cloudfront_invoke_url" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.web.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.web.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke" {
  statement_id             = "AllowCloudFrontInvokeFunction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.web.function_name
  principal                = "cloudfront.amazonaws.com"
  source_arn               = aws_cloudfront_distribution.web.arn
  invoked_via_function_url = true
}
