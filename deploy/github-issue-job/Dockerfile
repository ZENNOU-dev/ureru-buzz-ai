# Requirement-gap GitHub Issue creator — runs on Cloud Run Job with GITHUB_TOKEN from Secret Manager.
FROM node:22-alpine
WORKDIR /app

COPY scripts/create-requirement-gap-issues.mjs scripts/requirement-gap-issues.json ./scripts/

ENV NODE_ENV=production

# Optional: override target repo (default in script is BONNOU-inc/ureru-buzz-ai)
# ENV GITHUB_REPOSITORY=owner/repo

CMD ["node", "scripts/create-requirement-gap-issues.mjs"]
