#!/usr/bin/env node
/**
 * Downloads Bungie Destiny 2 manifest and extracts collectibles + records.
 * Run: npm run manifest
 * Requires: BUNGIE_API_KEY in .env (or set env var)
 * Output: data/manifest/collectibles.json, data/manifest/records.json
 */

import { config } from 'dotenv';
config();

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'manifest');

const BUNGIE_BASE = 'https://www.bungie.net';
const API_KEY = process.env.BUNGIE_API_KEY;

if (!API_KEY) {
  console.error('Error: BUNGIE_API_KEY required. Add to .env or set env var.');
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.arrayBuffer();
}

async function main() {
  console.log('Fetching manifest metadata...');
  const manifestRes = await fetchJson(
    `${BUNGIE_BASE}/Platform/Destiny2/Manifest/`
  );

  const manifest = manifestRes?.Response;
  if (!manifest) {
    throw new Error('Invalid manifest response');
  }

  // Use mobile (smaller) or json paths - check what's available
  const contentPaths = manifest.jsonWorldContentPaths || manifest.mobileWorldContentPaths;
  const enPath = contentPaths?.en;
  if (!enPath) {
    throw new Error('No English content path in manifest');
  }

  const contentUrl = `${BUNGIE_BASE}${enPath}`;
  console.log('Downloading manifest content (this may take a minute)...', contentUrl);

  const collectibles = {};
  const records = {};

  if (enPath.endsWith('.json')) {
    // JSON manifest format (current Bungie API)
    const data = await fetchJson(contentUrl);

    const collectibleDefs = data.DestinyCollectibleDefinition || {};
    for (const [hash, def] of Object.entries(collectibleDefs)) {
      const name = def.displayProperties?.name || '';
      const icon = def.displayProperties?.icon || '';
      if (name) {
        collectibles[String(hash)] = { hash, name, icon };
      }
    }

    const recordDefs = data.DestinyRecordDefinition || {};
    for (const [hash, def] of Object.entries(recordDefs)) {
      const titleInfo = def.titleInfo?.titlesByGender;
      const name = (titleInfo && (titleInfo.Male || titleInfo.Female || Object.values(titleInfo)[0])) || def.displayProperties?.name || '';
      const icon = def.displayProperties?.icon || '';
      if (name) {
        records[String(hash)] = { hash, name, icon };
      }
    }

    console.log('Parsed JSON manifest');
  } else {
    // SQLite manifest format (legacy)
    const buffer = await fetchBuffer(contentUrl);
    let dbBuffer = new Uint8Array(buffer);

    const isGzip = dbBuffer[0] === 0x1f && dbBuffer[1] === 0x8b;
    if (isGzip) {
      const { gunzipSync } = await import('zlib');
      dbBuffer = new Uint8Array(gunzipSync(Buffer.from(dbBuffer)));
    }

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    const db = new SQL.Database(dbBuffer);

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = (tables[0]?.values?.map((r) => r[0]) || []).filter(Boolean);
    const collectiblesTable = tableNames.find((t) => t.includes('Collectible')) || 'DestinyCollectibleDefinition';
    const recordsTable = tableNames.find((t) => t.includes('Record')) || 'DestinyRecordDefinition';

    try {
      const collectibleRows = db.exec(`SELECT json FROM ${collectiblesTable}`);
      if (collectibleRows[0]?.values) {
        for (const row of collectibleRows[0].values) {
          try {
            const def = JSON.parse(row[0]);
            const hash = def.hash;
            const name = def.displayProperties?.name || '';
            const icon = def.displayProperties?.icon || '';
            if (hash && name) {
              collectibles[String(hash)] = { hash, name, icon };
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Collectibles:', e.message);
    }

    try {
      const recordRows = db.exec(`SELECT json FROM ${recordsTable}`);
      if (recordRows[0]?.values) {
        for (const row of recordRows[0].values) {
          try {
            const def = JSON.parse(row[0]);
            const hash = def.hash;
            const titleInfo = def.titleInfo?.titlesByGender;
            const name = (titleInfo && (titleInfo.Male || titleInfo.Female || Object.values(titleInfo)[0])) || def.displayProperties?.name || '';
            const icon = def.displayProperties?.icon || '';
            if (hash && name) {
              records[String(hash)] = { hash, name, icon };
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Records:', e.message);
    }

    db.close();
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  writeFileSync(
    join(DATA_DIR, 'collectibles.json'),
    JSON.stringify(collectibles, null, 0)
  );
  writeFileSync(
    join(DATA_DIR, 'records.json'),
    JSON.stringify(records, null, 0)
  );

  console.log(`Saved ${Object.keys(collectibles).length} collectibles`);
  console.log(`Saved ${Object.keys(records).length} records`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
