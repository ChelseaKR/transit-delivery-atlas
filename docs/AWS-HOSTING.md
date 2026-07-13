# AWS hosting and deployment

Transit Delivery Atlas is a static Next.js export hosted in a private Amazon
S3 bucket behind Amazon CloudFront. CloudFront reaches S3 through Origin
Access Control (OAC); the bucket has no public website endpoint.

## Architecture

The CloudFormation template at `infra/static-site.json` provisions:

- a private, encrypted, versioned S3 bucket;
- a DNS-validated ACM certificate for `transit.chelseakr.com` in `us-east-1`;
- a CloudFront distribution with OAC, HTTPS-only delivery, HTTP/2 and HTTP/3,
  IPv6, security headers, and exact 404 handling;
- a viewer-request function that maps extensionless paths to their exported
  `index.html` files; and
- a dedicated GitHub OIDC deployment role scoped to this repository's
  `production` environment.

The template deliberately does not own the production Route 53 record. That
allows the AWS edge to be built and tested before a transactional DNS cutover
from the previous host.

## Provision once

The AWS account must already have the account-level GitHub Actions OIDC
provider for `https://token.actions.githubusercontent.com`, with
`sts.amazonaws.com` as an audience. The template references that provider but
does not create or modify it because one provider is shared across repositories.

Run the stack in `us-east-1`, because CloudFront requires its ACM certificate
there:

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name transit-delivery-atlas-production \
  --template-file infra/static-site.json \
  --parameter-overrides HostedZoneId=YOUR_HOSTED_ZONE_ID \
  --capabilities CAPABILITY_IAM
```

Read the deployment values from the stack outputs and create these GitHub
Actions variables:

- `AWS_DEPLOY_ROLE_ARN` — `GitHubDeployRoleArn`
- `AWS_REGION` — `us-east-1`
- `S3_BUCKET` — `SiteBucketName`
- `CLOUDFRONT_DISTRIBUTION_ID` — `DistributionId`
- `CLOUDFRONT_DOMAIN_NAME` — `DistributionDomainName`

No long-lived AWS access keys belong in GitHub.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`. The workflow rebuilds and
tests the exact commit, uploads immutable `/_next/static/` assets first,
uploads mutable HTML/data/media with revalidation caching, invalidates
CloudFront, waits for completion, and smoke-tests the exact distribution even
before public DNS points to it.

For an initial manual release, use the same two uploads and then invalidate:

Build only from a clean, committed checkout, and set `BUILD_SHA` to that full
commit SHA before running `npm run check`. This keeps `/version.json` truthful.

```bash
aws s3 sync out/_next/static/ "s3://$S3_BUCKET/_next/static/" \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync out/ "s3://$S3_BUCKET/" \
  --delete --exclude "_next/static/*" \
  --cache-control "public, max-age=0, must-revalidate"
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths '/*'
```

Older hashed assets are not immediately deleted because cached HTML can still
refer to them.

## Production cutover and rollback

After the distribution passes preflight checks, replace the prior OpenAI Sites
CNAME with Route 53 A and AAAA aliases in one transactional change:

```bash
HOSTED_ZONE_ID=YOUR_HOSTED_ZONE_ID \
CLOUDFRONT_DOMAIN=YOUR_DISTRIBUTION.cloudfront.net \
CLOUDFRONT_DISTRIBUTION_ID=YOUR_DISTRIBUTION_ID \
  ./scripts/cutover-dns-to-aws.sh
```

Keep the previous host's custom-domain binding only through the verification
window. If a critical route, export, TLS, or header check fails, roll DNS back:

```bash
HOSTED_ZONE_ID=YOUR_HOSTED_ZONE_ID \
CLOUDFRONT_DOMAIN=YOUR_DISTRIBUTION.cloudfront.net \
  ./scripts/rollback-dns-to-openai.sh
```

The cutover script also verifies that the supplied distribution is deployed,
enabled, and configured for the production hostname. Both scripts refuse to
overwrite an unexpected DNS target. Keep the previous custom-domain binding
for at least the initial 24–48 hour verification window so DNS rollback remains
available.

After that window, content rollback is a normal reviewed release: revert the
bad commit (or branch from the last known-good tag), run the full checks, and
let the deployment workflow publish the resulting commit. S3 versioning is an
additional recovery aid, not the primary release procedure.

## Release verification

A release is complete only after all of these checks pass on the public domain:

- `/`, `/evidence/`, `/methodology/`, `/data/`, and a directive detail page
  return 200;
- an unknown extensionless path returns the designed `404.html` with status
  404;
- `/data/directives.json`, both CSV exports, and `/og.png` are available;
- `/evidence/` links back to the published article on `chelseakr.com`;
- HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and `Permissions-Policy` are present; and
- `/version.json` reports the deployed Git commit.
