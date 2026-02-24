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

function findRarity(rarityData, name) {
  if (!name) return null;
  const normalized = normalizeName(name);

  for (const cat of Object.keys(rarityData)) {
    for (const item of rarityData[cat]) {
      if (normalizeName(item.name) === normalized) {
        return { ...item, category: cat };
      }
    }
  }
  return null;
}

// DestinyCollectibleState: bit 0 = NotAcquired (0 = owned, 1 = not owned)
const NOT_ACQUIRED = 0;
function isCollectibleOwned(state) {
  return state !== undefined && (state & (1 << NOT_ACQUIRED)) === 0;
}

// DestinyRecordState: bit 1 = ObjectiveNotCompleted
const OBJECTIVE_NOT_COMPLETED = 1;
function isRecordCompleted(state) {
  return state !== undefined && (state & (1 << OBJECTIVE_NOT_COMPLETED)) === 0;
}

export function matchRarestItems(profileData, manifest, rarityData) {
  const { collectibles: manifestCollectibles, records: manifestRecords } = manifest;
  const results = {};

  const profileCollectibles = profileData.profileCollectibles || profileData.ProfileCollectibles;
  if (profileCollectibles?.data) {
    const collectibles = profileCollectibles.data.collectibles || {};
    for (const [hash, data] of Object.entries(collectibles)) {
      if (!isCollectibleOwned(data.state)) continue;

      const def = manifestCollectibles[hash] || manifestCollectibles[String(hash)];
      const name = def?.name;
      const icon = def?.icon ? `https://www.bungie.net${def.icon}` : null;

      const rarity = name ? findRarity(rarityData, name) : null;
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
      const name = def?.name;
      const icon = def?.icon ? `https://www.bungie.net${def.icon}` : null;

      const rarity = name ? findRarity(rarityData, name) : null;
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
