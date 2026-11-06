(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const key = 'velostaff-direct-admin-v3';
  const backup = window.KV_CATALOG || {plugins: [], settings: {}};
  let state, page = 'overview', editor = null, emergencyEditor = null, analyticsPeriod = 'day';
  const online = location.protocol !== 'file:';
  let token = sessionStorage.getItem('velostaff-api-token') || '';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = os => os === 'mac' ? 'MAC' : 'WINDOWS';

  async function api(path, method = 'GET', payload) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    if (payload !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`/api${path}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Server error');
    return data;
  }
  async function loadOnline() {
    const data = await api('/admin/bootstrap');
    state = { plugins:data.plugins || [], settings:data.settings || {}, emergency:data.emergency || {enabled:false,plugins:[]}, requests:data.requests || [], moderators:data.moderators || [], actor:data.actor || {role:'admin',name:'Admin'}, analytics:data.analytics || {liveVisitors:0,pageViews24h:0} };
    state.plugins.forEach(p => { p.platformCategories ??= {}; p.platformCategories.mac ??= p.category || 'General'; p.platformCategories.windows ??= p.category || 'General'; });
  }
  function load() {
    try { state = JSON.parse(localStorage.getItem(key) || ''); } catch (_) {}
    state ??= {plugins: backup.plugins || [], settings: backup.settings || {}, emergency: {enabled:false,plugins:[]}, requests:[], moderators:[], actor:{role:'admin',name:'Admin'},analytics:{liveVisitors:0,pageViews24h:0}};
    state.plugins ??= []; state.requests ??= [];
    state.emergency ??= {enabled:false,plugins:[]}; state.emergency.plugins ??= [];
    // Old shared categories are copied once, then Mac and Windows stay independent.
    state.plugins.forEach(p => {
      p.platformCategories ??= {};
      p.platformCategories.mac ??= p.category || 'General';
      p.platformCategories.windows ??= p.category || 'General';
    });
    save();
  }
  function save() { if (!online) localStorage.setItem(key, JSON.stringify(state)); }
  function toast(msg) { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2300); }
  function cat(p, os) { return p.platformCategories?.[os] || p.category || 'General'; }
  function nav() {
    const links = [['overview','◇','OVERVIEW'],['plugins','▦','PLUGINS'],['messages','✉','MESSAGES'],['emergency','!','EMERGENCY'],['settings','◎','SETTINGS'],['security','⌘','SECURITY']];
    const isAdmin = state?.actor?.role !== 'moderator';
    const visible = isAdmin ? links : links.filter(([id]) => ['plugins','messages'].includes(id));
    return `<aside class="sidebar"><div class="side-brand"><div class="brand-square">VS</div><div>VELO STAFF<small>${isAdmin?'ADMIN ACCESS':'MODERATOR ACCESS'}</small></div></div><div class="sidebar-label">WORKSPACE</div><nav class="side-nav">${visible.map(([id,i,n]) => `<button data-page="${id}" class="${page===id?'active':''}"><i>${i}</i>${n}</button>`).join('')}</nav><div class="side-spacer"></div><a class="outside-link" href="index.html" target="_blank">OPEN WEBSITE ↗</a></aside>`;
  }
  function alt(v='') { return `<div class="link-row"><input type="url" value="${esc(v)}" placeholder="Alternative link"><button class="secondary compact" type="button" data-remove>REMOVE</button></div>`; }
  function pluginRow(p, os) {
    const n = 1 + (p.platforms?.[os]?.alternatives || []).filter(Boolean).length;
    const remove = state.actor?.role === 'moderator' ? '' : `<button class="table-action danger" data-delete="${esc(p.id)}">DELETE</button>`;
    return `<div class="plugin-row"><div><strong>${esc(p.title)}</strong><small>v${esc(p.version||'1.0')} · ${n} link${n===1?'':'s'}</small></div><div><button class="table-action" data-edit="${esc(p.id)}" data-os="${os}">EDIT</button>${remove}</div></div>`;
  }
  function categories(os) {
    const names = [...new Set(state.plugins.filter(p => p.platforms?.[os]?.url).map(p => cat(p,os)))].sort((a,b)=>a.localeCompare(b));
    if (!names.length) return '<div class="empty">No plugins yet. Add your first plugin above.</div>';
    return names.map(name => {
      const items = state.plugins.filter(p => p.platforms?.[os]?.url && cat(p,os) === name);
      return `<details class="plugin-category" open><summary><span>${esc(name)}</span><b>${items.length}</b><button class="category-pencil" type="button" title="Rename ${title(os)} category" data-rename-category="${esc(name)}" data-os="${os}">✎</button><i>⌄</i></summary>${items.map(p=>pluginRow(p,os)).join('')}</details>`;
    }).join('');
  }
  function form(os) {
    if (!editor || editor.os !== os) return '';
    const p = editor.plugin || {title:'',version:'1.0',platforms:{[os]:{url:'',alternatives:[]}}};
    const d = p.platforms?.[os] || {};
    const options = [...new Set(state.plugins.filter(x=>x.platforms?.[os]?.url).map(x=>cat(x,os)))].sort();
    return `<form class="inline-plugin-form" data-form data-os="${os}"><div class="inline-head">${editor.plugin?'EDIT':'ADD'} ${title(os)} PLUGIN</div><div class="inline-fields"><label>PLUGIN NAME<input name="pluginTitle" required value="${esc(p.title)}"></label><label>VERSION<input name="version" required value="${esc(p.version||'1.0')}"></label><label>CATEGORY<input name="category" list="category-${os}" required value="${esc(cat(p,os))}"><datalist id="category-${os}">${options.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label><label>PRIMARY LINK<input name="url" type="url" required value="${esc(d.url||'')}"></label></div><label class="alt-title">ALTERNATIVE LINKS</label><div class="alternatives">${(d.alternatives||[]).map(alt).join('')}</div><button class="secondary compact" type="button" data-add>+ ADD MORE</button><button class="primary inline-save">${editor.plugin?'UPDATE':'ADD'} ${title(os)} PLUGIN</button></form>`;
  }
  function panel(os) {
    const count = state.plugins.filter(p=>p.platforms?.[os]?.url).length;
    return `<section class="platform-card"><div class="platform-title"><h4>${title(os)}</h4><span>${count} PLUGIN${count===1?'':'S'}</span></div><button class="primary" data-start="${os}">+ ADD ${title(os)} PLUGIN</button>${form(os)}<div class="plugin-list categorized-list">${categories(os)}</div></section>`;
  }
  function plugins() { return `<div class="section-row"><div><div class="red-label">ORGANISED LIBRARY</div><h3>PLUGINS<span>.</span></h3><p>Mac and Windows categories are separate. Editing one never changes the other.</p></div></div><div class="platform-columns">${panel('mac')}${panel('windows')}</div>`; }
  function overview() {
    const p = state.plugins, m = p.filter(x=>x.platforms?.mac?.url).length, w = p.filter(x=>x.platforms?.windows?.url).length;
    const live=state.analytics?.liveVisitors||0, views=state.analytics?.pageViews24h||0, month=state.analytics?.views30d||0, series=state.analytics?.series||[], peak=Math.max(1,...series.map(item=>item.value||0));
    const bars=series.map(item=>{const height=Math.max(4,Math.round((item.value/peak)*100));return `<div class="analytics-bar-wrap" style="--bar-height:${height}%" title="${esc(item.label)}: ${item.value} visit${item.value===1?'':'s'}"><span class="analytics-bar-value">${item.value}</span><i class="analytics-bar" style="height:${height}%"></i><small>${esc(item.label)}</small></div>`}).join('');
    return `<div class="intro"><div><div class="red-label">SYSTEM OVERVIEW</div><h3>COMMAND<br><em>CENTER.</em></h3><p>Manage your plugin library from one workspace.</p></div><div class="intro-mark">V<span>S</span></div></div><div class="stats analytics-stats"><article><span>ALL PLUGINS</span><strong>${String(p.length).padStart(2,'0')}</strong><small>Saved plugins</small></article><article><span>WINDOWS PLUGINS</span><strong>${String(w).padStart(2,'0')}</strong><small>Windows records</small></article><article><span>MAC PLUGINS</span><strong>${String(m).padStart(2,'0')}</strong><small>Mac records</small></article><article><span>LIVE VISITORS <i class="mini-pulse"></i></span><strong>${String(live).padStart(2,'0')}</strong><small>Active in the last 90 seconds</small></article><article><span>LAST 30 DAYS</span><strong>${String(month).padStart(2,'0')}</strong><small>${views} page view${views===1?'':'s'} · last 24h</small></article></div><section class="analytics-board"><div class="analytics-chart-card"><div class="analytics-head"><div><span class="red-label">VISITOR HISTORY</span><h4>TRAFFIC OVER TIME</h4></div><select id="analyticsPeriod" aria-label="Analytics period"><option value="day" ${analyticsPeriod==='day'?'selected':''}>DAYS · 30</option><option value="week" ${analyticsPeriod==='week'?'selected':''}>WEEKS · 12</option><option value="month" ${analyticsPeriod==='month'?'selected':''}>MONTHS · 12</option><option value="year" ${analyticsPeriod==='year'?'selected':''}>YEARS · 5</option></select></div><div class="analytics-bars">${bars}</div></div><div class="live-orbit-card"><span class="red-label">LIVE NOW</span><div class="live-orbit" title="${live} visitors active right now"><div class="live-orbit-count">${String(live).padStart(2,'0')}<small>VISITORS</small></div><i class="orbit-dot one">${live}</i><i class="orbit-dot two">LIVE</i></div><p>Auto-updates every 15 seconds</p></div></section>`;
  }
  function messages() {
    const rows=state.requests.map(r=>`<article class="message-row"><label class="message-check" title="Select message"><input type="checkbox" data-request-select value="${esc(r.id)}"><i></i></label><div class="message-copy"><strong>${esc(r.pluginName||r.name||'Untitled request')}</strong><small>${esc(r.platform||'')} ${r.email?`· ${esc(r.email)}`:''}${r.name?` · ${esc(r.name)}`:''}</small>${r.message?`<p>${esc(r.message)}</p>`:''}</div><time>${r.createdAt?esc(new Date(r.createdAt).toLocaleString()):''}</time><button class="table-action danger" type="button" data-delete-request="${esc(r.id)}">DELETE</button></article>`).join('');
    return `<div class="section-row"><div><div class="red-label">VISITOR REQUESTS</div><h3>MESSAGES<span>.</span></h3><p>${state.requests.length} saved request${state.requests.length===1?'':'s'}.</p></div></div><section class="content-box messages-box">${state.requests.length?`<div class="message-toolbar"><label class="select-all"><input id="selectAllRequests" type="checkbox"> SELECT ALL</label><span id="selectedRequestCount">0 SELECTED</span><button id="deleteSelectedRequests" class="secondary compact" type="button" disabled>DELETE SELECTED</button><button id="deleteAllRequests" class="table-action danger" type="button">DELETE ALL</button></div><div class="message-list">${rows}</div>`:'<div class="empty">No plugin requests yet.</div>'}</section>`;
  }
  function emergencyForm(os) {
    if (!emergencyEditor || emergencyEditor.os !== os) return '';
    const p=emergencyEditor.plugin, d=p.platforms[os]||{};
    return `<form class="inline-plugin-form" data-emergency-form data-os="${os}"><div class="inline-head">ADD ${title(os)} EMERGENCY PLUGIN</div><div class="inline-fields"><label>PLUGIN NAME<input name="title" required value="${esc(p.title)}"></label><label>VERSION<input name="version" required value="${esc(p.version||'1.0')}"></label><label>PRIMARY LINK<input name="url" type="url" required value="${esc(d.url||'')}"></label></div><label class="alt-title">ALTERNATIVE LINKS</label><div class="alternatives">${(d.alternatives||[]).map(alt).join('')}</div><button class="secondary compact" type="button" data-emergency-add>+ ADD MORE</button><button class="primary inline-save">ADD ${title(os)} EMERGENCY PLUGIN</button></form>`;
  }
  function emergencyPanel(os) {
    const items=(state.emergency.plugins||[]).filter(p=>p.platforms?.[os]?.url), links=items.reduce((sum,p)=>sum+1+(p.platforms[os].alternatives||[]).filter(Boolean).length,0);
    return `<section class="platform-card emergency-card"><div class="platform-title"><h4>${title(os)} EMERGENCY PLUGINS</h4><span>${links} LINK${links===1?'':'S'}</span></div><button class="primary" data-emergency-start="${os}">+ ADD ${title(os)} EMERGENCY PLUGIN</button>${emergencyForm(os)}<div class="plugin-list">${items.length?items.map(p=>`<div class="plugin-row"><div><strong>${esc(p.title)}</strong><small>v${esc(p.version||'1.0')} · ${1+(p.platforms[os].alternatives||[]).filter(Boolean).length} links</small></div><button class="table-action danger" data-emergency-delete="${esc(p.id)}">DELETE</button></div>`).join(''):'<div class="empty">No emergency plugins</div>'}</div></section>`;
  }
  function emergency() { const e=state.emergency; return `<div class="section-row"><div><div class="red-label">ADMIN ONLY</div><h3>EMERGENCY<span>.</span></h3></div></div><div class="danger-box"><div class="red-label">CURRENT MODE</div><div class="emergency-state">${e.enabled?'ON':'OFF'}</div><p>Normal plugins are hidden only while this mode is active. Emergency plugins remain available.</p><button id="toggleEmergency" class="primary">${e.enabled?'DEACTIVATE':'ACTIVATE'} EMERGENCY MODE</button></div><div class="platform-columns emergency-panels">${emergencyPanel('mac')}${emergencyPanel('windows')}</div>`; }
  function settings() { const s=state.settings; return `<div class="section-row"><div><div class="red-label">PUBLIC WEBSITE</div><h3>SETTINGS<span>.</span></h3></div></div><form id="settingsForm" class="content-box admin-form"><label>SITE NAME<input name="siteName" value="${esc(s.siteName||'VELO STAFF')}"></label><label>DISCORD LINK<input name="discordUrl" value="${esc(s.discordUrl||'')}"></label><label>TAGLINE<input name="tagline" value="${esc(s.tagline||'')}"></label><label>HEADER ANNOUNCEMENT<input name="announcement" value="${esc(s.announcement||'')}"></label><button class="primary">SAVE SETTINGS</button></form>`; }
  function security() {
    const mods = state.moderators || [];
    return `<div class="section-row"><div><div class="red-label">ADMIN ACCESS CONTROL</div><h3>SECURITY<span>.</span></h3><p>Create moderator accounts for Plugins and Messages only. Settings, Emergency and Security stay admin-only.</p></div></div><section class="content-box security-box"><h4>RESET ADMIN PASSWORD</h4><p>Set a new 8+ character admin password. Your Cloudflare emergency password remains a recovery login.</p><form id="adminPasswordForm" class="admin-form"><label>NEW ADMIN PASSWORD<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="primary">SAVE ADMIN PASSWORD</button></form></section><section class="content-box security-box"><h4>ADD MODERATOR</h4><form id="moderatorForm" class="admin-form two-col"><label>USERNAME<input name="username" required minlength="3" maxlength="40" placeholder="e.g. shivam"></label><label>PASSWORD<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="primary">CREATE MODERATOR</button></form><div class="plugin-list">${mods.length ? mods.map(m=>`<div class="plugin-row"><div><strong>${esc(m.username)}</strong><small>Moderator · Plugins + Messages only</small></div><div><button class="table-action" data-reset-mod="${esc(m.id)}">RESET PASSWORD</button><button class="table-action danger" data-delete-mod="${esc(m.id)}">REMOVE</button></div></div>`).join('') : '<div class="empty">No moderators created yet.</div>'}</div></section>`;
  }
  function render() {
    const view={overview,plugins,messages,emergency,settings,security}[page]();
    $('#app').innerHTML = `${nav()}<div class="admin-main"><header class="admin-top"><div><span class="red-label">VELO STAFF / ${esc(state.actor?.name||'ADMIN')}</span><h2>${page[0].toUpperCase()+page.slice(1)}</h2></div><button id="quickAdd" class="primary">+ ADD PLUGIN</button></header><div class="app-content">${view}</div><footer class="admin-footer"><span>VELO STAFF</span><span>${online?'D1 LIVE SYNC':'DIRECT BROWSER STORAGE'}</span></footer></div>`;
    $('#app').classList.remove('hidden'); $('#login').classList.add('hidden');
    $('#quickAdd').onclick=()=>{page='plugins';editor={os:'windows',plugin:null};render()};
    if(page==='overview'&&$('#analyticsPeriod')) $('#analyticsPeriod').onchange=async e=>{analyticsPeriod=e.target.value;try{state.analytics=(await api(`/admin/analytics?period=${analyticsPeriod}`)).analytics;render()}catch(error){toast(error.message)}};
    if(page==='messages'&&state.requests.length){
      const boxes=[...document.querySelectorAll('[data-request-select]')], all=$('#selectAllRequests'), selected=$('#selectedRequestCount'), removeSelected=$('#deleteSelectedRequests');
      const syncSelection=()=>{const count=boxes.filter(box=>box.checked).length;selected.textContent=`${count} SELECTED`;removeSelected.disabled=!count;all.checked=count===boxes.length;all.indeterminate=count>0&&count<boxes.length};
      all.onchange=()=>{boxes.forEach(box=>box.checked=all.checked);syncSelection()};boxes.forEach(box=>box.onchange=syncSelection);
      removeSelected.onclick=()=>deleteRequests(boxes.filter(box=>box.checked).map(box=>box.value),false);
      $('#deleteAllRequests').onclick=()=>deleteRequests([],true);
      document.querySelectorAll('[data-delete-request]').forEach(button=>button.onclick=()=>deleteRequests([button.dataset.deleteRequest],false));
    }
    if(page==='settings') $('#settingsForm').onsubmit=async e=>{e.preventDefault();const next={...state.settings,...Object.fromEntries(new FormData(e.currentTarget))};try{if(online){state.settings=(await api('/admin/settings','POST',next)).settings}else{state.settings=next;save()}toast('Settings saved')}catch(error){toast(error.message)}};
    if(page==='emergency') $('#toggleEmergency').onclick=async()=>{try{const enabled=!state.emergency.enabled;if(online){state.emergency=(await api('/admin/emergency/toggle','POST',{enabled})).emergency}else{state.emergency.enabled=enabled;save()}render();toast('Emergency Mode updated')}catch(error){toast(error.message)}};
    if(page==='security') {
      $('#adminPasswordForm').onsubmit=async e=>{e.preventDefault();try{await api('/admin/security/admin-password','POST',{password:new FormData(e.currentTarget).get('password')});e.currentTarget.reset();toast('Admin password updated')}catch(error){toast(error.message)}};
      $('#moderatorForm').onsubmit=async e=>{e.preventDefault();try{const data=await api('/admin/moderators','POST',Object.fromEntries(new FormData(e.currentTarget)));state.moderators=data.moderators||[];render();toast('Moderator created')}catch(error){toast(error.message)}};
    }
  }
  async function deleteRequests(ids, all) {
    const count=all?state.requests.length:ids.length;if(!count)return;
    if(!confirm(all?`Delete all ${count} messages permanently?`:`Delete ${count} selected message${count===1?'':'s'} permanently?`))return;
    try{
      if(online){const data=await api('/admin/requests','DELETE',{ids,all});state.requests=data.requests||[]}
      else{state.requests=all?[]:state.requests.filter(request=>!ids.includes(request.id));save()}
      render();toast(`${count} message${count===1?'':'s'} deleted`)
    }catch(error){toast(error.message)}
  }
  $('#app').addEventListener('click', e => {
    const pageBtn=e.target.closest('[data-page]');
    if(pageBtn){page=pageBtn.dataset.page;editor=null;render();return}
    const b=e.target.closest('[data-start],[data-add],[data-remove],[data-edit],[data-delete],[data-rename-category],[data-reset-mod],[data-delete-mod],[data-emergency-start],[data-emergency-add],[data-emergency-delete]');
    if(!b)return;
    if(b.dataset.start){editor={os:b.dataset.start,plugin:null};render();return}
    if(b.dataset.emergencyStart){const os=b.dataset.emergencyStart;emergencyEditor={os,plugin:{title:'',version:'1.0',platforms:{mac:{},windows:{},[os]:{url:'',alternatives:[]}}}};render();return}
    if(b.hasAttribute('data-emergency-add')){b.previousElementSibling.insertAdjacentHTML('beforeend',alt());return}
    if(b.dataset.emergencyDelete){if(!confirm('Delete this emergency plugin?'))return;api(`/admin/emergency/plugins/${encodeURIComponent(b.dataset.emergencyDelete)}`,'DELETE').then(loadOnline).then(()=>{render();toast('Emergency plugin deleted')}).catch(error=>toast(error.message));return}
    if(b.hasAttribute('data-add')){b.previousElementSibling.insertAdjacentHTML('beforeend',alt());return}
    if(b.hasAttribute('data-remove')){b.closest('.link-row')?.remove();return}
    if(b.dataset.edit){editor={os:b.dataset.os,plugin:state.plugins.find(p=>p.id===b.dataset.edit)};render();return}
    if(b.dataset.delete){if(!confirm('Delete this plugin?'))return;if(online){api(`/admin/plugins/${encodeURIComponent(b.dataset.delete)}`,'DELETE').then(loadOnline).then(()=>{render();toast('Plugin deleted')}).catch(error=>toast(error.message))}else{state.plugins=state.plugins.filter(p=>p.id!==b.dataset.delete);save();render();toast('Plugin deleted')}return}
    if(b.dataset.resetMod){const password=prompt('New moderator password (minimum 8 characters)');if(!password)return;if(password.length<8){toast('Password needs at least 8 characters');return}api(`/admin/moderators/${encodeURIComponent(b.dataset.resetMod)}`,'PUT',{password}).then(data=>{state.moderators=data.moderators||[];render();toast('Moderator password reset')}).catch(error=>toast(error.message));return}
    if(b.dataset.deleteMod){if(!confirm('Remove this moderator?'))return;api(`/admin/moderators/${encodeURIComponent(b.dataset.deleteMod)}`,'DELETE').then(()=>{state.moderators=state.moderators.filter(m=>m.id!==b.dataset.deleteMod);render();toast('Moderator removed')}).catch(error=>toast(error.message));return}
    if(b.dataset.renameCategory){
      e.preventDefault();e.stopPropagation();
      const old=b.dataset.renameCategory, os=b.dataset.os, next=prompt(`Rename ${title(os)} category`,old)?.trim();
      if(!next||next===old)return;
      state.plugins.forEach(p=>{if(p.platforms?.[os]?.url&&cat(p,os)===old){p.platformCategories??={};p.platformCategories[os]=next}});
      if(online){Promise.all(state.plugins.filter(p=>p.platforms?.[os]?.url&&cat(p,os)===old).map(p=>api(`/admin/plugins/${encodeURIComponent(p.id)}`,'PUT',p))).then(loadOnline).then(()=>{render();toast(`${title(os)} category renamed`)}).catch(error=>toast(error.message))}else{save();render();toast(`${title(os)} category renamed`)}
    }
  });
  $('#app').addEventListener('submit', async e => {
    const f=e.target;if(!f.matches('[data-form],[data-emergency-form]'))return;e.preventDefault();
    if(f.matches('[data-emergency-form]')){
      const os=f.dataset.os, fd=new FormData(f), p={title:fd.get('title').trim(),version:fd.get('version').trim(),description:'',platforms:{mac:{},windows:{}}};
      p.platforms[os]={url:fd.get('url').trim(),alternatives:[...f.querySelectorAll('.alternatives input')].map(x=>x.value.trim()).filter(Boolean)};
      try{await api('/admin/emergency/plugins','POST',p);await loadOnline();emergencyEditor=null;render();toast('Emergency plugin saved — live now')}catch(error){toast(error.message)}
      return;
    }
    const os=f.dataset.os, fd=new FormData(f), old=editor?.plugin;
    const p=old?structuredClone(old):{id:crypto.randomUUID(),platforms:{mac:{},windows:{}},createdAt:new Date().toISOString(),updatedBy:'Admin'};
    p.title=fd.get('pluginTitle').trim();p.version=fd.get('version').trim();p.description??='';
    p.platforms??={mac:{},windows:{}};p.platforms[os]={url:fd.get('url').trim(),alternatives:[...f.querySelectorAll('.alternatives input')].map(x=>x.value.trim()).filter(Boolean)};
    p.platformCategories??={};p.platformCategories[os]=fd.get('category').trim()||'General';p.category??=p.platformCategories[os];p.updatedAt=new Date().toISOString();
    try{if(online){await api(old?`/admin/plugins/${encodeURIComponent(old.id)}`:'/admin/plugins',old?'PUT':'POST',p);await loadOnline()}else{if(old)state.plugins[state.plugins.findIndex(x=>x.id===old.id)]=p;else state.plugins.unshift(p);save()}editor=null;render();toast(online?'Plugin saved — live now':'Plugin saved — refresh index.html')}catch(error){toast(error.message)}
  });
  async function startOnline(){
    const login=$('#login'), app=$('#app'), form=$('#loginForm');
    const refreshAnalytics=()=>setInterval(async()=>{if(!token||page!=='overview'||state.actor?.role==='moderator')return;try{state.analytics=(await api(`/admin/analytics?period=${analyticsPeriod}`)).analytics;render()}catch(_){/* retain the latest visible count */}},15000);
    async function enter(){try{await loadOnline();render()}catch(_){app.classList.add('hidden');login.classList.remove('hidden')}}
    if(token){await enter();if(!app.classList.contains('hidden')){refreshAnalytics();return}}
    app.classList.add('hidden');login.classList.remove('hidden');
    form.addEventListener('submit',async event=>{event.preventDefault();const error=$('#loginError');error.textContent='';try{const data=await api('/login','POST',{username:$('#username').value.trim(),password:$('#password').value});token=data.token;sessionStorage.setItem('velostaff-api-token',token);await loadOnline();render();$('#password').value=''}catch(err){error.textContent=err.message}});
    refreshAnalytics();
  }
  if(online)startOnline();else{load();render()}
})();
