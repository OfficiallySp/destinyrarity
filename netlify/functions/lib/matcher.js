/**
 * Cross-references user's owned collectibles/records with rarity data.
 * Returns items grouped by category, sorted rarest-first.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = typeof import.meta?.url !== 'undefined'
  ? dirname(fileURLToPath(import.meta.url))
  : process.cwd();
const projectRoot = join(__dirname, '..', '..', '..');
const cwdData = join(process.cwd(), 'data');
const relData = join(projectRoot, 'data');
const DATA_ROOT = existsSync(cwdData) ? cwdData : existsSync(relData) ? relData : cwdData;

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadRarity() {
  const rarityDir = join(DATA_ROOT, 'rarity');
  const rarity = {};
  const categories = [
    'emblems', 'titles', 'shaders', 'emotes', 'finishers', 'transmat-effects',
    'ships', 'sparrows', 'ghost-shells', 'ghost-projections',
    'weapon-ornaments', 'armor-ornaments', 'weapon-mods', 'armor-mods',
    'consumables', 'vehicles',
    'auto-rifles', 'hand-cannons', 'pulse-rifles', 'scout-rifles',
    'fusion-rifles', 'sniper-rifles', 'shotguns', 'sidearms',
    'submachine-guns', 'machine-guns', 'rocket-launchers', 'grenade-launchers',
    'linear-fusion-rifles', 'trace-rifles', 'bows', 'glaives', 'swords',
  ];

  for (const cat of categories) {
    const file = join(rarityDir, `${cat}.json`);
    const data = loadJson(file);
    if (data?.items) {
      rarity[cat] = data.items;
    }
  }

  return rarity;
}

function loadManifest() {
  const manifestDir = join(DATA_ROOT, 'manifest');
  const collectibles = loadJson(join(manifestDir, 'collectibles.json')) || {};
  const records = loadJson(join(manifestDir, 'records.json')) || {};
  return { collectibles, records };
}

// DestinyItemSubType enum -> our rarity category
const ITEM_SUBTYPE_TO_CATEGORY = {
  6: 'auto-rifles', 7: 'shotguns', 8: 'machine-guns', 9: 'hand-cannons',
  10: 'rocket-launchers', 11: 'fusion-rifles', 12: 'sniper-rifles', 13: 'pulse-rifles',
  14: 'scout-rifles', 17: 'sidearms', 18: 'swords', 22: 'linear-fusion-rifles',
  23: 'grenade-launchers', 24: 'submachine-guns', 25: 'trace-rifles', 31: 'bows',
  33: 'glaives',
};
const WEAPON_CATEGORIES = new Set(Object.values(ITEM_SUBTYPE_TO_CATEGORY));

// DestinyItemType -> allowed rarity categories (reject mismatches, e.g. mod in emblems)
const ITEM_TYPE_ALLOWED_CATEGORIES = {
  2: new Set(['armor-ornaments']),
  3: new Set([...WEAPON_CATEGORIES, 'weapon-ornaments']),
  9: new Set(['consumables']),
  14: new Set(['emblems']),
  19: new Set(['weapon-mods', 'armor-mods']),
  21: new Set(['ships']),
  22: new Set(['vehicles', 'sparrows']),
  23: new Set(['emotes']),
  24: new Set(['ghost-shells', 'ghost-projections']),
  29: new Set(['finishers']),
};

/** Build a Map of normalized name -> [{ ...item, category }] for lookup (allows duplicates) */
function buildRarityLookup(rarityData) {
  const map = new Map();
  for (const cat of Object.keys(rarityData)) {
    for (const item of rarityData[cat]) {
      const key = normalizeName(item.name);
      if (!key) continue;
      const entry = { ...item, category: cat };
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
  }
  return map;
}

function findRarity(rarityLookup, name, itemType, itemSubType) {
  if (!name) return null;
  const entries = rarityLookup.get(normalizeName(name));
  if (!entries?.length) return null;
  if (entries.length === 1) return entries[0];

  // Disambiguate by item type when we have multiple matches (e.g. "Heretic" in emblems and rocket-launchers)
  const preferredCategory = itemSubType != null ? ITEM_SUBTYPE_TO_CATEGORY[itemSubType] : null;
  if (preferredCategory) {
    const match = entries.find((e) => e.category === preferredCategory);
    if (match) return match;
  }
  if (itemType === 14) {
    const match = entries.find((e) => e.category === 'emblems');
    if (match) return match;
  }
  if (itemType === 3 && WEAPON_CATEGORIES.size) {
    const match = entries.find((e) => WEAPON_CATEGORIES.has(e.category));
    if (match) return match;
  }
  return entries[0];
}

function isCategoryValidForItemType(itemType, category) {
  if (itemType == null) return true;
  const allowed = ITEM_TYPE_ALLOWED_CATEGORIES[itemType];
  if (!allowed) return true;
  return allowed.has(category);
}

// DestinyCollectibleState: bit 0 = NotAcquired (0 = owned, 1 = not owned)
const NOT_ACQUIRED = 0;
function isCollectibleOwned(state) {
  return state !== undefined && (state & (1 << NOT_ACQUIRED)) === 0;
}

// DestinyRecordState: ObjectiveNotCompleted = 4 (when set, objectives are NOT done)
const OBJECTIVE_NOT_COMPLETED = 4;
function isRecordCompleted(state) {
  return state !== undefined && (state & OBJECTIVE_NOT_COMPLETED) === 0;
}

export function matchRarestItems(profileData, manifest, rarityData) {
  const { collectibles: manifestCollectibles, records: manifestRecords } = manifest;
  const rarityLookup = buildRarityLookup(rarityData);
  const results = {};

  const profileCollectibles = profileData.profileCollectibles || profileData.ProfileCollectibles;
  if (profileCollectibles?.data) {
    const collectibles = profileCollectibles.data.collectibles || {};
    for (const [hash, data] of Object.entries(collectibles)) {
      if (!isCollectibleOwned(data.state)) continue;

      const def = manifestCollectibles[hash] || manifestCollectibles[String(hash)];
      const name = def?.name;
      const icon = def?.icon ? `https://www.bungie.net${def.icon}` : null;

      let rarity = name ? findRarity(rarityLookup, name, def?.itemType, def?.itemSubType) : null;
      if (rarity && !isCategoryValidForItemType(def?.itemType, rarity.category)) rarity = null;
      const category = rarity?.category || 'other';
      if (!results[category]) results[category] = [];

      results[category].push({
        name: name || `Hash ${hash}`,
        icon,
        hash,
        totalRedeemed: rarity?.totalRedeemed ?? 0,
        globalRarity: rarity?.globalRarity ?? 100,
        adjustedRarity: rarity?.adjustedRarity ?? 100,
      });
    }
  }

  const profileRecords = profileData.profileRecords || profileData.ProfileRecords;
  if (profileRecords?.data?.records) {
    const records = profileRecords.data.records;
    for (const [hash, data] of Object.entries(records)) {
      if (!isRecordCompleted(data.state)) continue;

      const def = manifestRecords[hash] || manifestRecords[String(hash)];
      if (def?.hasTitle !== true) continue;

      const name = def?.name;
      const icon = def?.icon ? `https://www.bungie.net${def.icon}` : null;

      const rarity = name ? findRarity(rarityLookup, name) : null;
      const category = 'titles';
      if (!results[category]) results[category] = [];

      results[category].push({
        name: name || `Record ${hash}`,
        icon,
        hash,
        totalRedeemed: rarity?.totalRedeemed ?? 0,
        globalRarity: rarity?.globalRarity ?? 100,
        adjustedRarity: rarity?.adjustedRarity ?? 100,
      });
    }
  }

  // Sort each category by globalRarity ascending (rarest first)
  for (const cat of Object.keys(results)) {
    results[cat].sort((a, b) => a.globalRarity - b.globalRarity);
  }

  return results;
}

export function getMatcherData() {
  return {
    manifest: loadManifest(),
    rarity: loadRarity(),
  };
}
