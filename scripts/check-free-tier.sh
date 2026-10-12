#!/usr/bin/env bash
# Zero-cost rule: every Terraform resource type in infra/ must be on the allowlist.
set -euo pipefail

allowlist="infra/free-tier-allowlist.txt"

allowed=$(sed 's/#.*//' "$allowlist" | tr -d ' \r' | grep -v '^$' | sort -u)
used=$(grep -rhoE '^resource "[a-z0-9_]+"' --include='*.tf' --exclude-dir=.terraform infra | cut -d'"' -f2 | sort -u)

unknown=$(comm -23 <(echo "$used") <(echo "$allowed"))

if [ -n "$unknown" ]; then
  echo "Resource types not on $allowlist (possible cost, ADR 0001):"
  echo "$unknown" | sed 's/^/  - /'
  exit 1
fi

echo "Zero-cost rule OK: $(echo "$used" | wc -l) resource types, all on the allowlist."
