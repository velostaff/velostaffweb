# Velo Staff MongoDB deployment

This project uses a Cloudflare Pages Function at `/api/*`.

## Cloudflare Pages settings

In **Workers & Pages > velostaffweb > Settings > Builds & deployments**:

- Build command: `npm install`
- Build output directory: `.`

Keep the three production secrets already added:

- `MONGODB_URI`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`

Do not add secrets to GitHub, HTML files, or `catalog.js`.

## Deploy

Commit and push the `package.json` and `functions/` files. Cloudflare installs
the MongoDB driver, deploys the Pages Function, and makes `/api/state`
available on the same Velo Staff domain.

## First live check

After the deployment succeeds, open:

`https://velostaffweb.pages.dev/api/state`

It should return JSON. An empty plugin list is expected until the admin UI is
migrated from its current browser-local draft data into MongoDB.
