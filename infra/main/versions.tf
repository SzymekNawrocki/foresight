terraform {
  required_version = ">= 1.10"

  # Workspace VCS-driven: plan/apply odpala HCP na zmianach w infra/main,
  # do AWS wchodzi przez OIDC (role z infra/bootstrap).
  cloud {
    organization = "devnawrocki-org"

    workspaces {
      name = "foresight-prod"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"

  default_tags {
    tags = {
      project     = "foresight"
      environment = var.environment
      managed-by  = "terraform"
    }
  }
}
