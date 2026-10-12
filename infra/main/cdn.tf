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

# Host widza nie może trafić do originu — Function URL odrzuca obcy Host.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  # https://<id>.lambda-url.<region>.on.aws/ -> <id>.lambda-url.<region>.on.aws
  web_origin_domain = split("/", aws_lambda_function_url.web.function_url)[2]
  web_origin_id     = "lambda-web"
}

# Zaakceptowane przez tech leada (PR #14): WAF przychodzi w 01b-5 z planem Free CloudFronta.
#trivy:ignore:AWS-0011
# Bez własnej domeny certyfikat *.cloudfront.net nie pozwala podnieść minimalnej wersji TLS;
# domena odłożona (0 zł).
# nosemgrep: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
resource "aws_cloudfront_distribution" "web" {
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
    target_origin_id         = local.web_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
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
