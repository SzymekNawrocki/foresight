terraform {
  required_version = ">= 1.10"

  # Stan w HCP; workspace w trybie Local — apply idzie z laptopa, bo HCP nie ma
  # jeszcze roli, przez którą mógłby wejść do AWS (to właśnie tworzy ten katalog).
  cloud {
    organization = "devnawrocki-org"

    workspaces {
      name = "foresight-bootstrap"
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
      project    = "foresight"
      managed-by = "terraform/bootstrap"
    }
  }
}
