#!/usr/bin/env bash
set -euo pipefail

: "${HOSTED_ZONE_ID:?Set HOSTED_ZONE_ID to the Route 53 hosted zone ID}"
: "${CLOUDFRONT_DOMAIN:?Set CLOUDFRONT_DOMAIN to the distribution domain name}"
: "${CLOUDFRONT_DISTRIBUTION_ID:?Set CLOUDFRONT_DISTRIBUTION_ID to the distribution ID}"

DOMAIN="${DOMAIN:-transit.chelseakr.com}"
FQDN="${DOMAIN%.}."
TARGET="${CLOUDFRONT_DOMAIN%.}"
TARGET_FQDN="${TARGET}."
CLOUDFRONT_ZONE_ID="Z2FDTNDATAQYW2"

distribution=$(aws cloudfront get-distribution \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --output json)

actual_domain=$(jq -r '.Distribution.DomainName' <<<"$distribution")
status=$(jq -r '.Distribution.Status' <<<"$distribution")
enabled=$(jq -r '.Distribution.DistributionConfig.Enabled' <<<"$distribution")
has_alias=$(jq -r --arg alias "${FQDN%.}" \
  '(.Distribution.DistributionConfig.Aliases.Items // []) | index($alias) != null' \
  <<<"$distribution")

if [[ "$actual_domain" != "$TARGET" || "$status" != "Deployed" || "$enabled" != "true" || "$has_alias" != "true" ]]; then
  echo "Refusing cutover because the supplied CloudFront distribution is not the deployed, enabled owner of ${FQDN%.}." >&2
  exit 1
fi

records=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name == '$FQDN']" \
  --output json)

cname=$(jq -c 'map(select(.Type == "CNAME")) | first // empty' <<<"$records")
if [[ -n "$cname" ]]; then
  current_target=$(jq -r '.ResourceRecords[0].Value' <<<"$cname")
  if [[ "$current_target" != "custom-domains.chatgpt.site." ]]; then
    echo "Refusing to replace unexpected CNAME target: $current_target" >&2
    exit 1
  fi

  change_batch=$(jq -n \
    --argjson old "$cname" \
    --arg name "$FQDN" \
    --arg target "$TARGET_FQDN" \
    --arg zone "$CLOUDFRONT_ZONE_ID" \
    '{
      Comment: "Cut Transit Delivery Atlas over from OpenAI Sites to AWS CloudFront",
      Changes: [
        {Action: "DELETE", ResourceRecordSet: $old},
        {Action: "CREATE", ResourceRecordSet: {Name: $name, Type: "A", AliasTarget: {HostedZoneId: $zone, DNSName: $target, EvaluateTargetHealth: false}}},
        {Action: "CREATE", ResourceRecordSet: {Name: $name, Type: "AAAA", AliasTarget: {HostedZoneId: $zone, DNSName: $target, EvaluateTargetHealth: false}}}
      ]
    }')

  change_id=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "$change_batch" \
    --query 'ChangeInfo.Id' \
    --output text)
  aws route53 wait resource-record-sets-changed --id "$change_id"
  echo "Cutover complete: $FQDN now aliases $TARGET_FQDN"
  exit 0
fi

a_target=$(jq -r 'map(select(.Type == "A"))[0].AliasTarget.DNSName // empty' <<<"$records")
aaaa_target=$(jq -r 'map(select(.Type == "AAAA"))[0].AliasTarget.DNSName // empty' <<<"$records")
if [[ "$a_target" == "$TARGET_FQDN" && "$aaaa_target" == "$TARGET_FQDN" ]]; then
  echo "No change needed: $FQDN already aliases $TARGET_FQDN"
  exit 0
fi

echo "Refusing cutover because the current DNS state is neither the expected OpenAI CNAME nor the target CloudFront aliases." >&2
exit 1
