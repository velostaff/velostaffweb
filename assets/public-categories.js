(() => {
  'use strict';
  const key = 'velostaff-direct-admin-v3';
  function directPlugins() {
    try { return JSON.parse(localStorage.getItem(key) || '{}').plugins || []; } catch (_) { return []; }
  }
  function categoryOf(card) {
    const button = card.querySelector('[data-id][data-os]');
    const id = button?.dataset.id, os = button?.dataset.os;
    const plugin = directPlugins().find(item => String(item.id) === String(id));
    if (plugin && os) return plugin.platformCategories?.[os] || plugin.category || 'General';
    const meta = card.querySelector('.card-meta')?.textContent || '';
    return meta.replace(/^\s*\d+\s*\/\s*/,'').replace(/\s*V[\d.]+\s*$/i,'').trim() || 'General';
  }
  function organise() {
    const grid = document.querySelector('#pluginGrid');
    if (!grid || grid.dataset.organising) return;
    const cards = [...grid.children].filter(item => item.classList?.contains('plugin-card'));
    if (!cards.length || cards.every(card => card.closest('.public-category'))) return;
    grid.dataset.organising = 'yes';
    const groups = {};
    cards.forEach(card => { const name = categoryOf(card); (groups[name] ??= []).push(card); });
    const fragment = document.createDocumentFragment();
    Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).forEach(([name, items]) => {
      const details = document.createElement('details');
      details.className = 'public-category'; details.open = true;
      const summary = document.createElement('summary');
      summary.innerHTML = `<span>${name}</span><b>${items.length}</b><i>⌄</i>`;
      const rows = document.createElement('div'); rows.className = 'public-category-rows';
      items.forEach(card => rows.appendChild(card));
      details.append(summary, rows); fragment.appendChild(details);
    });
    grid.replaceChildren(fragment);
    delete grid.dataset.organising;
  }
  const grid = document.querySelector('#pluginGrid');
  if (grid) {
    new MutationObserver(() => setTimeout(organise, 0)).observe(grid, {childList:true});
    setTimeout(organise, 50);
  }
})();
