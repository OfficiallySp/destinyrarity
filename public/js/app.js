(function () {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const errorEl = document.getElementById('error');
  const errorText = document.getElementById('error-text');
  const summary = document.getElementById('summary');
  const tabs = document.getElementById('tabs');
  const sections = document.getElementById('sections');

  const CATEGORY_LABELS = {
    emblems: 'Emblems',
    titles: 'Titles',
    shaders: 'Shaders',
    emotes: 'Emotes',
    finishers: 'Finishers',
    'transmat-effects': 'Transmat Effects',
    ships: 'Ships',
    sparrows: 'Sparrows',
    'ghost-shells': 'Ghost Shells',
    'ghost-projections': 'Ghost Projections',
    'weapon-ornaments': 'Weapon Ornaments',
    'armor-ornaments': 'Armor Ornaments',
    'weapon-mods': 'Weapon Mods',
    'armor-mods': 'Armor Mods',
    consumables: 'Consumables',
    vehicles: 'Vehicles',
    'auto-rifles': 'Auto Rifles',
    'hand-cannons': 'Hand Cannons',
    'pulse-rifles': 'Pulse Rifles',
    'scout-rifles': 'Scout Rifles',
    'fusion-rifles': 'Fusion Rifles',
    'sniper-rifles': 'Sniper Rifles',
    shotguns: 'Shotguns',
    sidearms: 'Sidearms',
    'submachine-guns': 'Submachine Guns',
    'machine-guns': 'Machine Guns',
    'rocket-launchers': 'Rocket Launchers',
    'grenade-launchers': 'Grenade Launchers',
    'linear-fusion-rifles': 'Linear Fusion Rifles',
    'trace-rifles': 'Trace Rifles',
    bows: 'Bows',
    glaives: 'Glaives',
    swords: 'Swords',
    other: 'Other',
  };

  function formatRarity(val) {
    if (val === undefined || val === null) return '—';
    if (val >= 100) return '—';
    if (val < 0.001) return '<0.001%';
    if (val < 0.01) return val.toFixed(3) + '%';
    if (val < 1) return val.toFixed(2) + '%';
    return val.toFixed(1) + '%';
  }

  function renderItem(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <img class="item-icon" src="${item.icon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22 fill=%22%23333%22><rect width=%2264%22 height=%2264%22 fill=%22%23181c24%22/></svg>'}" alt="" loading="lazy">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-rarity">${formatRarity(item.globalRarity)} global</div>
      <div class="item-stats">${item.totalRedeemed ? item.totalRedeemed.toLocaleString() + ' owners' : ''}</div>
    `;
    return card;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function buildSummary(categories) {
    let rarest = null;
    let rarestCat = '';
    for (const [cat, items] of Object.entries(categories)) {
      if (items.length && (!rarest || (items[0].globalRarity < rarest.globalRarity && items[0].globalRarity < 100))) {
        rarest = items[0];
        rarestCat = cat;
      }
    }
    if (rarest) {
      const label = CATEGORY_LABELS[rarestCat] || rarestCat;
      summary.innerHTML = `
        <p class="summary-title">Your rarest item</p>
        <p class="summary-text"><strong>${escapeHtml(rarest.name)}</strong> (${label}) — owned by only <strong>${formatRarity(rarest.globalRarity)}</strong> of guardians</p>
      `;
      summary.hidden = false;
    } else {
      summary.innerHTML = `
        <p class="summary-title">Your rarest items</p>
        <p class="summary-text">Browse your collectibles by category below. Run <code>npm run manifest</code> to improve matching.</p>
      `;
      summary.hidden = false;
    }
  }

  function render() {
    fetch('/api/get-rarest-items', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          // #region agent log
          fetch('http://127.0.0.1:7373/ingest/5ec052d7-2eb7-4035-9181-a1f067304a0b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5ae389'},body:JSON.stringify({sessionId:'5ae389',location:'app.js:401',message:'dashboard redirecting to home',data:{status:401},hypothesisId:'H3,H5',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          window.location.href = '/';
          return null;
        }
        const ct = r.headers.get('Content-Type') || '';
        const text = await r.text();
        if (!ct.includes('application/json') || text.trim().startsWith('<')) {
          throw new Error(r.ok ? 'Invalid response format' : `Request failed (${r.status})`);
        }
        try {
          return JSON.parse(text);
        } catch (_) {
          throw new Error('Invalid response format');
        }
      })
      .then((data) => {
        loading.hidden = true;
        if (!data) return;

        if (data.error) {
          errorText.textContent = data.error;
          errorEl.hidden = false;
          return;
        }

        const cats = data.categories || {};
        const sortedCats = Object.entries(cats)
          .filter(([, items]) => items.length > 0)
          .sort((a, b) => b[1].length - a[1].length);

        buildSummary(cats);

        sortedCats.forEach(([cat, items], i) => {
          const tab = document.createElement('button');
          tab.className = 'tab' + (i === 0 ? ' active' : '');
          tab.textContent = (CATEGORY_LABELS[cat] || cat) + ' (' + items.length + ')';
          tab.dataset.cat = cat;
          tabs.appendChild(tab);

          const section = document.createElement('section');
          section.className = 'category-section' + (i === 0 ? ' active' : '');
          section.id = 'cat-' + cat;
          section.innerHTML = '<h2>' + (CATEGORY_LABELS[cat] || cat) + '</h2>';
          const grid = document.createElement('div');
          grid.className = 'items-grid';
          items.forEach((item) => grid.appendChild(renderItem(item)));
          section.appendChild(grid);
          sections.appendChild(section);
        });

        tabs.addEventListener('click', (e) => {
          const t = e.target.closest('.tab');
          if (!t) return;
          tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
          sections.querySelectorAll('.category-section').forEach((x) => x.classList.remove('active'));
          t.classList.add('active');
          document.getElementById('cat-' + t.dataset.cat).classList.add('active');
        });

        content.hidden = false;
      })
      .catch((err) => {
        loading.hidden = true;
        errorText.textContent = err.message || 'Failed to load data';
        errorEl.hidden = false;
      });
  }

  render();
})();
