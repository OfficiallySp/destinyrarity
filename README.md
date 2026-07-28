# Destiny Rarity Checker

See your rarest Destiny 2 items — emblems, titles, shaders, and more. Rarity data is sourced from the [Charlemagne API](https://warmind.io) (warmind.io).

## Setup

### 1. Bungie API Application

Register an application at [bungie.net/en/Application](https://www.bungie.net/en/Application):

- **Application Type**: Confidential
- **Redirect URL**: `https://lightledger.officiallysp.net/api/auth-callback` (or `http://localhost:8888/api/auth-callback` for local dev). This must match the domain you actually visit — the app deploys to its own subdomain, not to a path under officiallysp.net.
- **OAuth2 Scopes**: Enable `ReadBasicUserProfile` and `ReadDestinyInventoryAndVault`

Save your **API Key**, **Client ID**, and **Client Secret**.

### 2. Environment Variables

Create a `.env` file (or set in Netlify Dashboard):

```
BUNGIE_API_KEY=your_api_key
BUNGIE_CLIENT_ID=your_client_id
BUNGIE_CLIENT_SECRET=your_client_secret
COOKIE_SECRET=your_32_byte_hex  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SITE_URL=http://localhost:8888  # Local-dev fallback only; in production OAuth uses the request's own host
```

### 3. Rarity Data (Pre-scraped)

Rarity data is already in `data/rarity/`. To refresh after a Destiny 2 update:

```bash
npm run scrape
```

This pulls live rarity stats from `https://api.warmind.io/in` (Charlemagne). No API key is required.

### 4. Bungie Manifest (Required for item names)

The manifest maps collectible hashes to names and includes item types for correct categorization. Run once before deploying:

```bash
npm run manifest
```

This requires `BUNGIE_API_KEY` in `.env`. Commit the generated `data/manifest/*.json` files. Re-run after major Destiny 2 updates (e.g. Monument of Triumph / 9.7.0) so new collectibles and titles resolve correctly.

### 5. Local Development

```bash
npm run dev
```

Visit `http://localhost:8888`. Set `SITE_URL=http://localhost:8888` in `.env` and use that exact URL as the Bungie redirect URI for local testing.

### 6. Deploy to Netlify

1. Connect your repo to Netlify
2. Set environment variables in the Netlify dashboard
3. Deploy — no build step needed (static site + functions)

## Project Structure

```
public/           # Static site (HTML, CSS, JS)
netlify/functions/  # Serverless functions (OAuth, API)
data/rarity/      # Scraped warmind.io data
data/manifest/    # Bungie manifest (collectibles, records)
scripts/          # Local scripts (scrape, manifest)
```

## License

MIT
