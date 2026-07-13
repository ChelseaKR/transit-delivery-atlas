#!/usr/bin/env bash
set -euo pipefail

: "${HOSTED_ZONE_ID:?Set HOSTED_ZONE_ID to the Route 53 hosted zone ID}"
: "${CLOUDFRONT_DOMAIN:?Set CLOUDFRONT_DOMAIN to the distribution domain name}"

DOMAIN="${DOMAIN:-transit.chelseakr.com}"
FQDN="${DOMAIN%.}."
TARGET="${CLOUDFRONT_DOMAIN%.}."
CLOUDFRONT_ZONE_ID="Z2FDTNDATAQYW2"

records=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name == '$FQDN']" \
  --output json)

a_record=$(jq -c 'map(select(.Type == "A")) | first // empty' <<<"$records")
aaaa_record=$(jq -c 'map(select(.Type == "AAAA")) | first // empty' <<<"$records")

if [[ -z "$a_record" || -z "$aaaa_record" ]]; then
  current_cname=$(jq -r 'map(select(.Type == "CNAME"))[0].ResourceRecords[0].Value // empty' <<<"$records")
  if [[ "$current_cname" == "custom-domains.chatgpt.site." ]]; then
    echo "No change needed: $FQDN already points to OpenAI Sites"
    exit 0
  fi
  echo "Refusing rollback because the expected CloudFront aliases are not present." >&2
  exit 1
fi

a_target=$(jq -r '.AliasTarget.DNSName' <<<"$a_record")
aaaa_target=$(jq -r '.AliasTarget.DNSName' <<<"$aaaa_record")
a_zone=$(jq -r '.AliasTarget.HostedZoneId' <<<"$a_record")
aaaa_zone=$(jq -r '.AliasTarget.HostedZoneId' <<<"$aaaa_record")
if [[ "$a_target" != "$TARGET" || "$aaaa_target" != "$TARGET" || "$a_zone" != "$CLOUDFRONT_ZONE_ID" || "$aaaa_zone" != "$CLOUDFRONT_ZONE_ID" ]]; then
  echo "Refusing to remove aliases that do not target $TARGET" >&2
  exit 1
fi

change_batch=$(jq -n \
  --argjson a "$a_record" \
  --argjson aaaa "$aaaa_record" \
  --arg name "$FQDN" \
  '{
    Comment: "Roll Transit Delivery Atlas back from AWS CloudFront to OpenAI Sites",
    Changes: [
      {Action: "DELETE", ResourceRecordSet: $a},
      {Action: "DELETE", ResourceRecordSet: $aaaa},
      {Action: "CREATE", ResourceRecordSet: {Name: $name, Type: "CNAME", TTL: 60, ResourceRecords: [{Value: "custom-domains.chatgpt.site."}]}}
    ]
  }')

change_id=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "$change_batch" \
  --query 'ChangeInfo.Id' \
  --output text)
aws route53 wait resource-record-sets-changed --id "$change_id"
echo "Rollback complete: $FQDN now points to OpenAI Sites"
