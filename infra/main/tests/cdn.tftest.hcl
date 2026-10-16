# Sprawdza kontrakt bezpieczeństwa 01b-2 bez AWS: provider jest zmockowany, więc
# test idzie lokalnie i w CI, nic nie tworzy i nic nie kosztuje.
# Mock zwraca losowe stringi, a rola IAM waliduje JSON polityki — podstawiamy poprawny.
mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

run "lambda_reachable_only_through_cloudfront" {
  command = plan

  assert {
    condition     = aws_lambda_function_url.web.authorization_type == "AWS_IAM"
    error_message = "Function URL musi wymagać podpisu IAM — inaczej da się obejść CloudFront."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.web.signing_behavior == "always"
    error_message = "OAC ma podpisywać każde żądanie do originu."
  }

  assert {
    condition     = aws_cloudfront_distribution.web.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Viewer ma dostawać tylko HTTPS."
  }

  assert {
    condition     = aws_cloudfront_distribution.web.default_cache_behavior[0].response_headers_policy_id == data.aws_cloudfront_response_headers_policy.security_headers.id
    error_message = "Responses must carry the managed security headers (HSTS, X-Frame-Options, nosniff)."
  }
}

run "only_public_recent_events_are_cached_at_the_edge" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.web.default_cache_behavior[0].cache_policy_id == data.aws_cloudfront_cache_policy.caching_disabled.id
    error_message = "Everything is uncached by default — private data must never sit in a shared cache."
  }

  assert {
    condition     = [for b in aws_cloudfront_distribution.web.ordered_cache_behavior : b.path_pattern] == ["/api/recent"]
    error_message = "Only /api/recent (public, changes hourly) may be cached."
  }
}
