#!/usr/bin/env node
/**
 * Scrapes warmind.io analytics pages for item rarity data.
 * Run: npm run scrape
 * Output: data/rarity/*.json
 */

import { load } from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'rarity');

const BASE_URL = 'https://warmind.io';

// Item categories from warmind.io/analytics/item/
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

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DestinyRarity/1.0 (scraper)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function parseItemPage(html, category) {
  const $ = load(html);
  const items = [];

  // warmind.io structure: each item is in a .panel with panel-heading (h5) and panel-body (stats)
  $('.panel').each((_, el) => {
    const $panel = $(el);
    const $h5 = $panel.find('h5[id$="-name"]').first();
    const name = $h5.text().trim().replace(/\s+/g, ' ');
    if (!name || name === 'Next Page' || name.startsWith('Page:')) return;

    const text = $panel.text();

    const redeemedMatch = text.match(/Total Redeemed:\s*([\d,]+)/i) || text.match(/Total Earned:\s*([\d,]+)/i);
    const globalMatch = text.match(/Global Rarity:\s*([\d.]+)%/i);
    const adjustedMatch = text.match(/Adjusted Rarity:\s*([\d.]+)%/i);

    const totalRedeemed = redeemedMatch ? parseInt(redeemedMatch[1].replace(/,/g, ''), 10) : 0;
    const globalRarity = globalMatch ? parseFloat(globalMatch[1]) : 0;
    const adjustedRarity = adjustedMatch ? parseFloat(adjustedMatch[1]) : 0;

    items.push({
      name,
      totalRedeemed,
      globalRarity,
      adjustedRarity,
    });
  });

  return items;
}

function parseTitlePage(html) {
  const $ = load(html);
  const items = [];

  // Titles use .panel with h4 for name
  $('.panel').each((_, el) => {
    const $panel = $(el);
    const $h4 = $panel.find('h4').first();
    const name = $h4.text().trim();
    if (!name) return;

    const text = $panel.text();

    const earnedMatch = text.match(/Total Earned:\s*([\d,]+)/i);
    const globalMatch = text.match(/Global Rarity:\s*([\d.]+)%/i);
    const adjustedMatch = text.match(/Adjusted Rarity:\s*([\d.]+)%/i);

    const totalRedeemed = earnedMatch ? parseInt(earnedMatch[1].replace(/,/g, ''), 10) : 0;
    const globalRarity = globalMatch ? parseFloat(globalMatch[1]) : 0;
    const adjustedRarity = adjustedMatch ? parseFloat(adjustedMatch[1]) : 0;

    items.push({
      name,
      totalRedeemed,
      globalRarity,
      adjustedRarity,
    });
  });

  return items;
}

async function scrapeCategory(category, isTitle = false) {
  const allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = isTitle
      ? `${BASE_URL}/analytics/title${page > 1 ? `?page=${page}` : ''}`
      : `${BASE_URL}/analytics/item/${category}${page > 1 ? `?page=${page}` : ''}`;

    console.log(`  Fetching ${url}...`);
    const html = await fetchPage(url);

    const items = isTitle ? parseTitlePage(html) : parseItemPage(html, category);

    if (items.length === 0) {
      hasMore = false;
      break;
    }

    // Filter out "Next Page" and pagination items
    const validItems = items.filter(
      (i) => i.name && !i.name.startsWith('Page') && i.name !== 'Next Page'
    );
    allItems.push(...validItems);

    // Check if there's a next page
    const hasNextPage = html.includes('Next Page') || html.includes('page=' + (page + 1));
    if (!hasNextPage || validItems.length < 10) {
      hasMore = false;
    } else {
      page++;
      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }
  }

  return allItems;
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Scrape titles (different URL structure)
  console.log('Scraping titles...');
  const titles = await scrapeCategory('title', true);
  const titlesUnique = Array.from(
    new Map(titles.map((t) => [t.name, t])).values()
  ).sort((a, b) => a.globalRarity - b.globalRarity);
  writeFileSync(
    join(DATA_DIR, 'titles.json'),
    JSON.stringify({ category: 'titles', items: titlesUnique }, null, 2)
  );
  console.log(`  Saved ${titlesUnique.length} titles`);

  // Scrape item categories
  for (const category of ITEM_CATEGORIES) {
    console.log(`Scraping ${category}...`);
    try {
      const items = await scrapeCategory(category);
      const unique = Array.from(
        new Map(items.map((i) => [i.name, i])).values()
      ).sort((a, b) => a.globalRarity - b.globalRarity);

      writeFileSync(
        join(DATA_DIR, `${category}.json`),
        JSON.stringify({ category, items: unique }, null, 2)
      );
      console.log(`  Saved ${unique.length} items`);
    } catch (err) {
      console.error(`  Error scraping ${category}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 300)); // Rate limit between categories
  }

  console.log('Done!');
}

main().catch(console.error);
