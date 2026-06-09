#!/usr/bin/env node
/**
 * Fetches item rarity data from the Charlemagne (warmind.io) API.
 * Run: npm run scrape
 * Output: data/rarity/*.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'rarity');

const API_BASE = 'https://api.warmind.io/in';
const DELAY_BETWEEN_REQUESTS = 500;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugToTypeName(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function typeNameToSlug(typeName) {
  return typeName.trim().replace(/\s+/g, '-').toLowerCase();
}

// Slugs that do not resolve via the default title-case mapping.
const CATEGORY_API_TYPES = {
  bows: ['Combat Bows'],
  sparrows: ['Vehicles'],
  vehicles: ['Vehicles'],
  'armor-mods': [
    'General Armor Mods',
    'Helmet Armor Mods',
    'Arms Armor Mods',
    'Chest Armor Mods',
    'Leg Armor Mods',
    'Class Item Armor Mods',
    'Activity Ghost Mods',
    'Economic Ghost Mods',
    'Experience Ghost Mods',
    'Tracking Ghost Mods',
  ],
};

const ITEM_CATEGORIES = [
  'emblems',
  'shaders',
  'emotes',
  'finishers',
  'transmat-effects',
  'ships',
  'sparrows',
  'ghost-shells',
  'ghost-projections',
  'weapon-ornaments',
  'armor-ornaments',
  'weapon-mods',
  'armor-mods',
  'consumables',
  'vehicles',
  'auto-rifles',
  'hand-cannons',
  'pulse-rifles',
  'scout-rifles',
  'fusion-rifles',
  'sniper-rifles',
  'shotguns',
  'sidearms',
  'submachine-guns',
  'machine-guns',
  'rocket-launchers',
  'grenade-launchers',
  'linear-fusion-rifles',
  'trace-rifles',
  'bows',
  'glaives',
  'swords',
];

async function fetchApi(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'DestinyRarity/1.1' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(json.errorMessage || `API error ${json.errorCode}`);
  }
  return json.response;
}

function parseItem(entry) {
  const common = entry?.rarityCommon;
  if (!common?.name) return null;

  return {
    name: common.name,
    totalRedeemed: common.cardinality ?? 0,
    globalRarity: (common.globalRarity?.floatValue ?? 0) * 100,
    adjustedRarity: (common.adjustedRarity?.floatValue ?? 0) * 100,
  };
}

function parseTitle(entry) {
  if (!entry?.title) return null;

  return {
    name: entry.title,
    totalRedeemed: entry.totalEarned ?? 0,
    globalRarity: (entry.percentTotalPop ?? 0) * 100,
    adjustedRarity: (entry.percentMinOnePop ?? 0) * 100,
  };
}

async function fetchItemTypes() {
  const response = await fetchApi('/rarity/itemTypes');
  const types = (response?.types || []).filter(Boolean);
  const bySlug = new Map(types.map((type) => [typeNameToSlug(type), type]));
  return { types, bySlug };
}

async function fetchCategoryItems(apiTypes) {
  const allItems = [];

  for (const apiType of apiTypes) {
    await delay(DELAY_BETWEEN_REQUESTS);
    const response = await fetchApi(`/rarity/items/${encodeURIComponent(apiType)}`);
    const itemList = Array.isArray(response?.itemList) ? response.itemList : [];
    for (const entry of itemList) {
      const item = parseItem(entry);
      if (item) allItems.push(item);
    }
  }

  return Array.from(new Map(allItems.map((item) => [item.name, item])).values())
    .sort((a, b) => a.globalRarity - b.globalRarity);
}

function resolveApiTypes(category, typeIndex) {
  if (CATEGORY_API_TYPES[category]) {
    return CATEGORY_API_TYPES[category];
  }

  const direct = typeIndex.bySlug.get(category);
  if (direct) return [direct];

  const fallback = slugToTypeName(category);
  if (typeIndex.types.includes(fallback)) return [fallback];

  throw new Error(`No API item type found for category "${category}"`);
}

async function scrapeTitles() {
  const response = await fetchApi('/sealAnalytics');
  const seals = Object.values(response?.sealAnalytics || {});
  const byName = new Map();

  for (const seal of seals) {
    const title = parseTitle(seal);
    if (!title) continue;

    const existing = byName.get(title.name);
    if (!existing || title.globalRarity < existing.globalRarity) {
      byName.set(title.name, title);
    }
  }

  return [...byName.values()].sort((a, b) => a.globalRarity - b.globalRarity);
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('Fetching item type index...');
  const typeIndex = await fetchItemTypes();
  console.log(`  ${typeIndex.types.length} item types available`);

  console.log('Fetching titles...');
  const titles = await scrapeTitles();
  writeFileSync(
    join(DATA_DIR, 'titles.json'),
    JSON.stringify({ category: 'titles', items: titles }, null, 2)
  );
  console.log(`  Saved ${titles.length} titles`);

  for (const category of ITEM_CATEGORIES) {
    console.log(`Fetching ${category}...`);
    try {
      const apiTypes = resolveApiTypes(category, typeIndex);
      const items = await fetchCategoryItems(apiTypes);
      writeFileSync(
        join(DATA_DIR, `${category}.json`),
        JSON.stringify({ category, items }, null, 2)
      );
      console.log(`  Saved ${items.length} items (${apiTypes.join(', ')})`);
    } catch (err) {
      console.error(`  Error fetching ${category}:`, err.message);
    }
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
