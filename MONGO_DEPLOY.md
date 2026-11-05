# Velo Staff MongoDB deployment

This project uses a Cloudflare Pages Function as an HTTPS proxy at `/api/*` and
a dedicated Cloudflare Worker for the MongoDB connection.

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

Commit and push the files. Then deploy the dedicated API Worker:

`npx wrangler deploy --config worker/wrangler.toml`

Set `MONGODB_URI`, `ADMIN_PASSWORD`, and `AUTH_SECRET` as Worker secrets.
Copy the deployed Worker URL and save it in the Pages project as the production
text variable `API_WORKER_URL`. The Pages Function proxies `/api/*` to it.

## First live check

After the deployment succeeds, open:

`https://velostaffweb.pages.dev/api/state`

It should return JSON. An empty plugin list is expected until the admin UI is
migrated from its current browser-local draft data into MongoDB.
