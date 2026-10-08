(() => {
  'use strict';
  const { initial, statuses, demoDate, storageKey } = window.CampusData;
  const geo = window.CampusGeo;
  const maps = window.CampusMaps;
  const app = document.querySelector('#app');
  const sheet = document.querySelector('#sheet');
  const paths = {
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    bulb: '<path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0L15 17H9l-.5-2.5Z"/><path d="M12 1V0M3 5l-1-1m19 1 1-1"/>',
    drop: '<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
    tool: '<path d="M14 6a6 6 0 0 0-8 8l-4 4a2.8 2.8 0 0 0 4 4l4-4a6 6 0 0 0 8-8l-4 4-4-4 4-4Z"/>',
    accessibility: '<circle cx="12" cy="3" r="2"/><path d="M4 8h16m-8 0v7m0-3-5 9m5-9 5 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    archive: '<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v13h14V7m-10 4h6"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 4 5v2"/>',
    shield: '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Z"/><path d="m8 11 3 3 5-6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    filter: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
    chart: '<path d="M4 3v17h17M8 16v-4m5 4V8m5 8V5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1" fill="var(--surface)"/><path d="M9 11h6m-6 5h6"/>',
    settings: '<path d="m10 2-.7 3-2.8 1L4 4.5 2 8l2 2v4l-2 2 2 3.5L6.5 18l2.8 1 .7 3h4l.7-3 2.8-1 2.5 1.5 2-3.5-2-2v-4l2-2-2-3.5L17.5 6l-2.8-1-.7-3h-4Z"/><circle cx="12" cy="12" r="3"/>',
    building: '<path d="M4 22V4l8-2 8 2v18M2 22h20M9 22v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
    logout: '<path d="M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
    message: '<path d="M21 3H3v15h5l4 4 4-4h5V3Z"/><path d="M7 8h10M7 12h7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    transfer: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
    leaf: '<path d="M4 20c-5-13 9-15 16-16 0 9-3 17-13 15m-3 1L16 8"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const date = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' });
  const dateTime = value => `${date(value)} · ${new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
  const now = () => new Date().toISOString();
  let data;
  let storageWarning = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    data = saved?.version === 1 ? saved : initial();
  }
  catch { data = initial(); storageWarning = true; }
  if (geo.migrate(data)) {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); }
    catch { storageWarning = true; }
  }
  let userId;
  try { userId = sessionStorage.getItem('campus-demo-session') ?? 'marina'; } catch { userId = 'marina'; }
  if (!data.users.some(u => u.id === userId)) userId = null;
  let filter = { category: '', status: 'ativas', sector: '' };
  let search = '';
  let mapList = false;
  let selectedId = '026';
  let detailTab = 'details';
  let mineTab = 'authored';
  let listStatus = '';
  let queueSector = '';
  let configTab = 'sectors';
  let period = 'month';
  let range = { start: '2026-10-01', end: demoDate };
  let backTarget = 'mapa';
  let draft = freshDraft();
  let toastTimer;
  let authBusy = false;

  function freshDraft() { return { location: '', lat: null, lng: null, category: '', description: '', reference: '', photo: null }; }
  const user = () => data.users.find(u => u.id === userId);
  const cat = id => data.categories.find(c => c.id === id);
  const sector = id => data.sectors.find(s => s.id === id);
  const personName = id => data.users.find(u => u.id === id)?.name || 'Usuário';
  const terminal = o => ['resolvida', 'encerrada'].includes(o.status);
  const canAttend = o => user()?.sectors.includes(o.sector) && !terminal(o);
  const roleLabel = u => u.role === 'admin' ? 'Administrador' : u.sectors.length ? 'Responsável de manutenção' : 'Membro da comunidade';
  const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const confirmationCount = o => o.baseConfirmations + o.confirmations.length;
  function route() { return location.hash.replace(/^#\/?/, '') || (userId ? 'mapa' : 'entrada'); }
  function go(target) { if (route() === target) render(); else location.hash = '/' + target; }
  function notify(message, error = false) {
    const toast = document.querySelector('#toast');
    toast.textContent = message; toast.className = `toast visible${error ? ' error' : ''}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), error ? 6000 : 3500);
  }
  function commit(mutate, message) {
    const next = JSON.parse(JSON.stringify(data));
    try {
      mutate(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      data = next;
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(error.message?.startsWith('Regra:') ? error.message.slice(6).trim() : 'Não foi possível salvar. Verifique o armazenamento do navegador e tente novamente.', true);
      return false;
    }
  }
  function setSession(id) { userId = id; try { sessionStorage.setItem('campus-demo-session', id || ''); } catch { /* A sessão continua em memória. */ } }
  function demoLogin(id) {
    if (!data.users.some(u => u.id === id)) return;
    if (sheet.open) sheet.close();
    setSession(id); listStatus = ''; queueSector = ''; search = ''; filter = { category: '', status: 'ativas', sector: '' }; draft = freshDraft();
    go(id === 'joao' ? 'demandas' : id === 'ana' ? 'configuracao' : 'mapa');
    notify(`Demonstração: ${personName(id).split(' ')[0]}.`);
  }
  const statusBadge = status => `<span class="badge tone-${statuses[status].tone}">${icon(statuses[status].icon)}${statuses[status].label}</span>`;
  const categoryIcon = (category, large = false) => `<span class="category-icon tone-${category.tone}${large ? ' large' : ''}">${icon(category.icon)}</span>`;
  const options = (items, selected, placeholder = 'Todos') => `<option value="">${esc(placeholder)}</option>${items.map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}`;
  function header(title, kicker = '') {
    return `<header class="app-header"><div>${kicker ? `<span class="header-kicker">${esc(kicker)}</span>` : ''}<h1>${esc(title)}</h1></div><button class="avatar-button" data-action="go" data-target="conta" aria-label="Minha conta">${initials(user().name)}</button></header>`;
  }
  function pageHeader(title, target, right = '') { return `<header class="page-header"><button class="icon-button" data-action="go" data-target="${esc(target)}" aria-label="Voltar">${icon('back')}</button><h1>${esc(title)}</h1>${right}</header>`; }
  function nav(active) {
    const items = [['mapa', 'map', 'Mapa'], ['acompanhar', 'clipboard', 'Acompanhar']];
    if (user().sectors.length) items.push(['demandas', 'tool', 'Demandas']);
    if (user().role === 'admin') items.push(['configuracao', 'settings', 'Gestão']);
    items.push(['estatisticas', 'chart', 'Panorama'], ['conta', 'user', 'Conta']);
    return `<nav class="bottom-nav" aria-label="Navegação principal">${items.map(([target, symbol, label]) => `<button class="nav-item${active === target ? ' active' : ''}" data-action="go" data-target="${target}"${active === target ? ' aria-current="page"' : ''}><span class="nav-icon">${icon(symbol)}</span>${label}</button>`).join('')}</nav>`;
  }
  function empty(title, text, action = '') { return `<div class="empty-state"><div class="empty-icon">${icon('leaf')}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`; }
  function row(o) {
    const c = cat(o.category);
    return `<button class="occurrence-row" data-action="detail" data-id="${o.id}" aria-label="Abrir ocorrência ${o.id}: ${esc(o.title)}">${categoryIcon(c)}<div class="row-content"><div class="row-meta"><small>#${o.id} · ${date(o.createdAt)}</small>${statusBadge(o.status)}</div><h3>${esc(o.title)}</h3><span class="row-location">${icon('pin')}${esc(o.location)} <span>· ${confirmationCount(o)} confirmações</span></span></div></button>`;
  }
  function filteredOccurrences() {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return data.occurrences.filter(o => (!filter.category || o.category === filter.category) && (!filter.sector || o.sector === filter.sector) && (!filter.status || (filter.status === 'ativas' ? !terminal(o) : o.status === filter.status)) && (!query || `${o.title} ${o.description} ${o.location} ${cat(o.category).name} ${o.id}`.toLocaleLowerCase('pt-BR').includes(query)));
  }
  function mapPreview(o) {
    if (!o) return `<div class="map-preview"><h2>Nenhuma ocorrência encontrada</h2><p class="subtle">Ajuste os filtros para explorar outros registros.</p><button class="text-button" data-action="clear-filters">Limpar filtros ${icon('arrow')}</button></div>`;
    const c = cat(o.category);
    return `<button class="map-preview" data-action="detail" data-id="${o.id}" aria-label="Ver detalhes de ${esc(o.title)}"><div class="preview-top">${categoryIcon(c)}<div><span class="category-name">${esc(c.name)}</span><small>OCORRÊNCIA #${o.id}</small></div>${statusBadge(o.status)}</div><h2>${esc(o.title)}</h2><div class="preview-bottom"><span>${icon('pin')}${esc(o.location)}</span><span>${icon('users')}${confirmationCount(o)}</span><span class="preview-arrow">${icon('arrow')}</span></div></button>`;
  }
  function selectOccurrence(id) {
    selectedId = id;
    maps.updateMarkers(filteredOccurrences(), selectedId);
    const preview = document.querySelector('#map-preview');
    if (preview) preview.innerHTML = mapPreview(data.occurrences.find(o => o.id === id));
  }
  function mountMaps() {
    if (document.querySelector('#campus-map')) maps.mountMain({ items: filteredOccurrences(), selected: selectedId, category: cat, icon, onSelect: selectOccurrence });
    if (document.querySelector('#location-picker')) maps.mountPicker({ draft, icon, onSelect: selectLocation });
    if (document.querySelector('#review-map')) maps.mountReview({ draft, icon });
  }
  function mapBody() {
    const items = filteredOccurrences();
    if (!items.some(o => o.id === selectedId)) selectedId = items[0]?.id;
    if (mapList) return `<div class="app-scroll map-list"><div class="list-meta">${items.length} ocorrências encontradas</div><div class="occurrence-list">${items.map(row).join('') || empty('Nada por aqui', 'Ajuste os filtros ou faça um novo registro.')}</div><div class="list-register"><button class="primary-button wide" data-action="new">${icon('plus')}Registrar ocorrência</button></div></div>`;
    return `<div class="map-stage"><div id="campus-map" class="real-campus-map" aria-label="Mapa real da UFV, campus Viçosa"></div><div class="map-summary">${items.length} ${filter.status === 'ativas' ? 'ocorrências ativas' : 'ocorrências no mapa'}</div>${maps.switcher()}<div class="map-tools"><button class="icon-button" data-action="zoom-in" aria-label="Aproximar mapa">${icon('plus')}</button><button class="icon-button" data-action="zoom-out" aria-label="Afastar mapa">${icon('minus')}</button><button class="icon-button" data-action="center-map" aria-label="Centralizar mapa do campus">${icon('target')}</button></div><div class="map-bottom"><button class="register-fab" data-action="new">${icon('plus')}Registrar ocorrência</button><div id="map-preview">${mapPreview(items.find(o => o.id === selectedId))}</div></div></div>`;
  }
  function mapScreen() {
    const count = [filter.category, filter.sector, filter.status !== 'ativas' ? filter.status : ''].filter(Boolean).length;
    return `${header('Nosso campus', `Olá, ${user().name.split(' ')[0]} ☀`)}<div class="map-controls"><label class="search-field">${icon('search')}<input type="search" id="map-search" placeholder="Busque um local ou ocorrência" aria-label="Buscar local ou ocorrência" value="${esc(search)}"></label><div class="map-filter-row"><div><button class="chip${filter.status === 'ativas' ? ' active' : ''}" data-action="active-filter">${icon('pin')}Em aberto</button><button class="chip" data-action="filters">${icon('filter')}Filtros${count ? ` · ${count}` : ''}</button></div><button class="chip" data-action="toggle-map">${icon(mapList ? 'map' : 'list')}${mapList ? 'Mapa' : 'Lista'}</button></div></div><div id="map-body" style="display:contents">${mapBody()}</div>${nav('mapa')}`;
  }
  function listScreen(queue = false) {
    const allowed = user().sectors;
    let items = data.occurrences.filter(o => queue ? allowed.includes(o.sector) && (!queueSector || o.sector === queueSector) : mineTab === 'authored' ? o.author === userId : o.confirmations.includes(userId));
    if (listStatus) items = items.filter(o => o.status === listStatus);
    const openCount = data.occurrences.filter(o => allowed.includes(o.sector) && !terminal(o)).length;
    return `${header(queue ? 'Demandas do setor' : 'Acompanhar', queue ? 'CUIDADO QUE VIRA AÇÃO' : 'SEUS REGISTROS, EM UM SÓ LUGAR')}${queue ? `<div class="queue-banner">${icon('tool')}<div><b>${openCount} demandas em aberto</b>Nos setores em que você atua.</div></div><div class="queue-sectors">${allowed.map(id => esc(sector(id).name)).join(' · ')}</div>` : `<div class="tab-row"><button class="tab${mineTab === 'authored' ? ' active' : ''}" data-action="mine-tab" data-value="authored" aria-pressed="${mineTab === 'authored'}">Meus registros</button><button class="tab${mineTab === 'confirmed' ? ' active' : ''}" data-action="mine-tab" data-value="confirmed" aria-pressed="${mineTab === 'confirmed'}">Confirmações</button></div>`}<div class="app-scroll"><div class="list-meta"><span>${items.length} registros</span><select id="list-status" aria-label="Filtrar por situação">${options(Object.entries(statuses).map(([id, s]) => ({ id, name: s.label })), listStatus, 'Todas as situações')}</select></div>${queue && allowed.length > 1 ? `<div class="page-content" style="padding-bottom:0;padding-top:12px"><label class="field" style="margin:0"><select id="queue-sector" aria-label="Filtrar setor">${options(data.sectors.filter(s => allowed.includes(s.id)), queueSector, 'Todos os meus setores')}</select></label></div>` : ''}<div class="occurrence-list">${items.map(row).join('') || empty(queue ? 'Nenhuma demanda encontrada' : mineTab === 'authored' ? 'Seu primeiro registro começa aqui' : 'Você ainda não confirmou ocorrências', queue ? 'Escolha outra situação ou setor para consultar.' : 'Explore o mapa para registrar ou confirmar um problema.', `<button class="secondary-button wide" data-action="go" data-target="mapa">Explorar o mapa ${icon('arrow')}</button>`)}</div></div>${nav(queue ? 'demandas' : 'acompanhar')}`;
  }
  function management(o) {
    if (!canAttend(o)) return '';
    const action = o.status === 'registrada' ? ['analise', 'Iniciar análise', 'search'] : o.status === 'analise' ? ['andamento', 'Iniciar atendimento', 'tool'] : ['resolvida', 'Registrar resolução', 'check'];
    return `<section class="manage-box"><h3>${icon('tool')} Atendimento do setor</h3><p>Você está vinculado a ${esc(sector(o.sector).name.toLowerCase())}.</p><button class="primary-button wide" data-action="attendance" data-id="${o.id}" data-status="${action[0]}">${icon(action[2])}${action[1]}</button>${['registrada', 'analise'].includes(o.status) ? `<div class="button-row"><button class="text-button" data-action="transfer" data-id="${o.id}">${icon('transfer')}Transferir</button><button class="text-button" data-action="attendance" data-id="${o.id}" data-status="encerrada">${icon('archive')}Encerrar</button></div>` : ''}</section>`;
  }
  function detailScreen(o) {
    const c = cat(o.category);
    const confirmed = o.confirmations.includes(userId);
    const main = detailTab === 'history' ? `<h2>A história deste registro</h2><p class="timeline-intro">Cada etapa preserva a data e quem realizou a ação.</p><div class="timeline">${o.history.slice().reverse().map(event => `<div class="timeline-item"><span class="tone-${statuses[event.status]?.tone || 'green'}">${icon(statuses[event.status]?.icon || 'message')}</span><div><h3>${esc(event.title)}</h3><p>${esc(event.text)}</p><small>${esc(personName(event.author))} · ${dateTime(event.date)}</small></div></div>`).join('')}</div>` : `<div class="detail-heading">${categoryIcon(c, true)}${statusBadge(o.status)}</div><h2 class="detail-title">${esc(o.title)}</h2><p class="detail-description">${esc(o.description)}</p>${o.photo ? `<img class="detail-photo" src="${esc(o.photo)}" alt="Foto do problema relatado">` : ''}<dl class="metadata-grid"><div class="full"><dt>LOCALIZAÇÃO</dt><dd>${icon('pin')}${esc(o.location)}${o.reference ? ` · ${esc(o.reference)}` : ''}</dd><dd class="coordinate-label">${o.lat.toFixed(6)}, ${o.lng.toFixed(6)} · <a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener">Ver no mapa</a></dd>${o.coordinateSource === 'migrated-approximate' ? '<small class="field-hint">Local aproximado do protótipo anterior.</small>' : ''}</div><div><dt>CATEGORIA</dt><dd>${esc(c.name)}</dd></div><div><dt>REGISTRADA EM</dt><dd>${date(o.createdAt)}</dd></div><div class="full"><dt>SETOR RESPONSÁVEL</dt><dd>${icon('building')}${esc(sector(o.sector).name)}</dd></div><div class="full"><dt>REGISTRADA POR</dt><dd>${esc(personName(o.author))}</dd></div></dl><section class="confirmation-block"><div class="confirmation-number">${icon('users')}<strong>${confirmationCount(o)}</strong> pessoas observaram este problema</div><button class="secondary-button wide" data-action="confirm" data-id="${o.id}"${confirmed ? ' disabled' : ''}>${icon(confirmed ? 'circleCheck' : 'check')}${confirmed ? 'Você já confirmou' : 'Também observei este problema'}</button></section>${management(o)}${terminal(o) ? `<div class="terminal-note">${icon('info')}<div><b>${statuses[o.status].label}</b><br>${esc(o.history[o.history.length - 1].text)}</div></div>` : ''}<section class="section-gap"><div class="section-title"><h3>Informações da comunidade</h3><small>${o.contributions.length}</small></div>${o.contributions.map(info => `<article class="contribution"><div class="contribution-head"><b>${esc(personName(info.author))}</b><span>${date(info.date)}</span></div><p>${esc(info.text)}</p></article>`).join('') || '<p class="contribution-empty">Uma informação sua pode ajudar o atendimento.</p>'}<button class="text-button" data-action="contribute" data-id="${o.id}">${icon('message')}Acrescentar informação</button></section>`;
    return `${pageHeader(`Ocorrência #${o.id}`, backTarget)}<div class="tab-row"><button class="tab${detailTab === 'details' ? ' active' : ''}" data-action="detail-tab" data-value="details" aria-pressed="${detailTab === 'details'}">Detalhes</button><button class="tab${detailTab === 'history' ? ' active' : ''}" data-action="detail-tab" data-value="history" aria-pressed="${detailTab === 'history'}">Histórico <small>(${o.history.length})</small></button></div><div class="app-scroll"><div class="page-content">${main}</div></div>`;
  }
  function stepper(step) { return `<div class="step-indicator">${['Local', 'Problema', 'Revisão'].map((label, i) => `${i ? '<i></i>' : ''}<span class="${step >= i + 1 ? 'active' : ''}"><b>${i + 1}</b>${label}</span>`).join('')}</div>`; }
  function newScreen(step) {
    let content, footer;
    if (step === 1) {
      content = `<h2 class="form-title">Onde está o problema?</h2><p class="form-intro">Arraste e aproxime o mapa real do campus. Toque para marcar o local.</p><div class="picker-map-wrap"><div class="picker-map" id="location-picker" tabindex="0" aria-label="Selecionar localização no campus. Use as setas para deslocar o mapa e Enter para marcar o centro."></div>${maps.switcher()}</div><div class="picker-helper" id="location-selection">${icon('pin')}<span>${draft.location ? esc(draft.location) : 'Nenhum local selecionado'}</span></div><small class="coordinate-label" id="selected-coordinates">${draft.lat !== null ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}` : 'A localização será salva com latitude e longitude.'}</small><span class="location-label">Ou escolha um ponto de referência:</span><div class="location-presets">${geo.places.slice(0, 3).map(place => `<button class="chip" data-action="location-preset" data-name="${esc(place.name)}" data-lat="${place.lat}" data-lng="${place.lng}">${esc(place.name)}</button>`).join('')}</div><div class="field-error" id="location-error" role="alert"></div>`;
      footer = `<button class="primary-button wide" data-action="new-next" data-step="1">Continuar ${icon('arrow')}</button>`;
    } else if (step === 2) {
      content = `<h2 class="form-title">Conte o que você encontrou.</h2><p class="form-intro">Um relato claro ajuda a equipe a entender o problema.</p><form id="occurrence-form"><span class="field-label">Qual é a categoria?</span><div class="category-options">${data.categories.filter(c => c.active && sector(c.sector)?.active).map(c => `<label class="category-option"><input type="radio" name="category" value="${c.id}"${draft.category === c.id ? ' checked' : ''} required><span>${icon(c.icon)}${esc(c.name)}</span></label>`).join('')}</div><label class="field"><span>O que aconteceu?</span><textarea name="description" placeholder="Descreva o problema e como encontrá-lo…" required minlength="10" maxlength="1500">${esc(draft.description)}</textarea><small class="field-hint">Pelo menos 10 caracteres.</small></label><label class="field"><span>Ponto de referência <small>opcional</small></span><input name="reference" value="${esc(draft.reference)}" placeholder="Ex.: entrada lateral, próximo à rampa" maxlength="160"></label><label class="upload-field" id="upload-label">${draft.photo ? `<img src="${esc(draft.photo)}" alt="Prévia da foto selecionada">` : icon('camera')}<span>${draft.photo ? 'Trocar foto' : 'Adicionar uma foto · opcional'}</span><input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp" aria-label="Adicionar foto do problema"><small class="field-hint">JPG, PNG ou WebP · até 2 MB</small></label><div id="routing-preview">${draft.category ? routingNote() : ''}</div></form>`;
      footer = `<button class="primary-button wide" type="submit" form="occurrence-form">Revisar ocorrência ${icon('arrow')}</button>`;
    } else {
      content = `<h2 class="form-title">Tudo certo para enviar?</h2><p class="form-intro">Revise o registro antes de compartilhá-lo com a comunidade.</p><div class="review-map-wrap"><div id="review-map" class="review-mini-map" aria-label="Local marcado no mapa real do campus"></div></div><div class="review-block"><small>LOCALIZAÇÃO</small><h3>${esc(draft.location)}</h3><small class="coordinate-label">${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}</small>${draft.reference ? `<p>${esc(draft.reference)}</p>` : ''}</div><div class="review-block"><small>CATEGORIA</small><h3>${esc(cat(draft.category)?.name)}</h3></div><div class="review-block"><small>DESCRIÇÃO</small><p>${esc(draft.description)}</p></div>${draft.photo ? `<img class="detail-photo" src="${esc(draft.photo)}" alt="Foto que será enviada">` : ''}${routingNote()}<p class="subtle">O registro ficará visível no mapa e seu andamento poderá ser acompanhado pelo histórico.</p>`;
      footer = `<button class="primary-button wide" data-action="publish-occurrence">${icon('check')}Enviar ocorrência</button>`;
    }
    return `${pageHeader('Registrar ocorrência', step === 1 ? 'mapa' : `novo/${step-1}`)}${stepper(step)}<div class="app-scroll"><div class="page-content">${content}</div></div><div class="form-bottom">${footer}</div>`;
  }
  function routingNote() { return `<div class="routing-note">${icon('transfer')}<span>Encaminhamento inicial:<br><b>${esc(sector(cat(draft.category)?.sector)?.name || 'Selecione uma categoria')}</b></span></div>`; }
  function selectLocation(lat, lng, name) {
    if (!geo.inArea(lat, lng)) {
      const el = document.querySelector('#location-error'); if (el) el.textContent = 'Marque um local na área de referência do campus Viçosa.'; return;
    }
    const nearest = geo.nearest(lat, lng);
    draft.lat = +lat.toFixed(7); draft.lng = +lng.toFixed(7); draft.location = name || `Próximo a ${nearest.name}`;
    maps.pickerPin(draft.lat, draft.lng, icon, Boolean(name));
    const label = document.querySelector('#location-selection span'); if (label) label.textContent = draft.location;
    const coordinates = document.querySelector('#selected-coordinates'); if (coordinates) coordinates.textContent = `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}`;
    const error = document.querySelector('#location-error'); if (error) error.textContent = '';
  }

  function localDate(value) { return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); }
  function statsScreen() {
    const inPeriod = value => value && localDate(value) >= range.start && localDate(value) <= range.end;
    const items = data.occurrences.filter(o => inPeriod(o.createdAt));
    const resolved = data.occurrences.filter(o => o.status === 'resolvida' && inPeriod(o.resolvedAt));
    const average = resolved.length ? resolved.reduce((sum, o) => sum + (new Date(o.resolvedAt) - new Date(o.createdAt)) / 86400000, 0) / resolved.length : null;
    const bars = entries => `<div class="bar-chart">${entries.map(([label, count]) => `<div><div class="bar-label"><span>${esc(label)}</span><strong>${count}</strong></div><div class="bar-track" role="img" aria-label="${esc(label)}: ${count} ocorrências"><div class="bar-fill" style="width:${items.length ? count/items.length*100 : 0}%"></div></div></div>`).join('')}</div>`;
    return `${header('Panorama do campus', 'ACOMPANHE O QUE ESTÁ MUDANDO')}<div class="stat-period"><label class="field"><select id="stats-period" aria-label="Período das estatísticas"><option value="month"${period === 'month' ? ' selected' : ''}>Este mês · outubro de 2026</option><option value="week"${period === 'week' ? ' selected' : ''}>Últimos 7 dias da demonstração</option><option value="all"${period === 'all' ? ' selected' : ''}>Todo o período</option><option value="custom"${period === 'custom' ? ' selected' : ''}>Escolher período</option></select></label>${period === 'custom' ? `<div class="date-range"><label class="field"><span>De</span><input type="date" id="stats-start" value="${range.start}"></label><label class="field"><span>Até</span><input type="date" id="stats-end" value="${range.end}"></label></div>` : ''}</div><div class="app-scroll"><div class="page-content"><div class="stat-hero"><div><div class="stat-total">${items.length}</div><p class="stat-total-label">registros no período</p></div><div class="stat-side"><b>${average === null ? '—' : average.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dias'}</b><small>tempo médio de resolução</small></div></div>${items.length ? '' : '<p class="subtle section-gap">Nenhuma ocorrência registrada neste período.</p>'}<section class="section-gap"><div class="section-title"><h2>Por situação</h2></div><div class="status-counts">${Object.keys(statuses).map(status => `<div class="status-count">${statusBadge(status)}<strong>${items.filter(o => o.status === status).length}</strong></div>`).join('')}</div></section><section class="section-gap"><div class="section-title"><h2>Por categoria</h2></div>${bars(data.categories.map(c => [c.name, items.filter(o => o.category === c.id).length]))}</section><section class="section-gap"><div class="section-title"><h2>Por setor</h2></div>${bars(data.sectors.map(s => [s.name, items.filter(o => o.sector === s.id).length]))}</section><p class="stat-explanation">As quantidades consideram a data de criação. A média considera apenas as ${resolved.length} ocorrências resolvidas no período, do registro à resolução, incluindo registros criados antes dele.</p><p class="stat-explanation">Dados fictícios · referência da demonstração: 07/10/2026.</p></div></div>${nav('estatisticas')}`;
  }
  function configScreen() {
    const groups = [['sectors', 'Setores'], ['categories', 'Categorias'], ['users', 'Responsáveis']];
    let content;
    if (configTab === 'sectors') content = data.sectors.map(s => {
      const responsibleCount = data.users.filter(u => u.sectors.includes(s.id)).length;
      const demandCount = data.occurrences.filter(o => o.sector === s.id && !terminal(o)).length;
      return `<div class="config-row${s.active ? '' : ' config-inactive'}"><span class="category-icon tone-green">${icon('building')}</span><div><h3>${esc(s.name)}</h3><p>${responsibleCount} responsáveis · ${demandCount} demandas abertas${s.active ? '' : ' · Inativo'}</p></div><button class="icon-button" data-action="edit-sector" data-id="${s.id}" aria-label="Editar ${esc(s.name)}">${icon('edit')}</button></div>`;
    }).join('');
    else if (configTab === 'categories') content = data.categories.map(c => `<div class="config-row${c.active ? '' : ' config-inactive'}">${categoryIcon(c)}<div><h3>${esc(c.name)}</h3><p>${esc(sector(c.sector).name)}${c.active ? '' : ' · Inativa'}</p></div><button class="icon-button" data-action="edit-category" data-id="${c.id}" aria-label="Editar ${esc(c.name)}">${icon('edit')}</button></div>`).join('');
    else content = data.users.map(u => `<div class="config-row"><span class="avatar">${initials(u.name)}</span><div><h3>${esc(u.name)}</h3><p>${u.sectors.length ? u.sectors.map(id => esc(sector(id).name)).join(' · ') : 'Sem vínculo de atendimento'}</p></div><button class="icon-button" data-action="edit-links" data-id="${u.id}" aria-label="Editar setores de ${esc(u.name)}">${icon('edit')}</button></div>`).join('');
    return `${header('Organizar manutenção', 'ADMINISTRAÇÃO')}<div class="tab-row">${groups.map(([key, label]) => `<button class="tab${configTab === key ? ' active' : ''}" data-action="config-tab" data-value="${key}" aria-pressed="${configTab === key}">${label}</button>`).join('')}</div><div class="app-scroll"><p class="admin-intro">${configTab === 'sectors' ? 'Organize os grupos que recebem e atendem as ocorrências.' : configTab === 'categories' ? 'Cada categoria define o encaminhamento inicial dos novos registros.' : 'Vincule contas existentes aos setores em que podem atender.'}</p><div class="config-list">${content}</div>${configTab !== 'users' ? `<div class="config-add"><button class="secondary-button wide" data-action="${configTab === 'sectors' ? 'edit-sector' : 'edit-category'}">${icon('plus')}${configTab === 'sectors' ? 'Criar setor' : 'Criar categoria'}</button></div>` : ''}<div class="page-content" style="padding-top:0"><p class="stat-explanation">Setores demonstrativos. A administração permite configurar a organização, mas o atendimento exige vínculo com o setor.</p></div></div>${nav('configuracao')}`;
  }
  function accountScreen() {
    const u = user();
    return `${header('Minha conta', 'SEU ESPAÇO NO CAMPUS')}<div class="app-scroll"><div class="page-content"><div class="account-heading"><div class="avatar large">${initials(u.name)}</div><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p><span class="badge tone-green">${roleLabel(u)}</span></div>${u.sectors.length ? `<div class="account-sector-list"><b>Seus setores de atendimento</b>${u.sectors.map(id => esc(sector(id).name)).join('<br>')}</div>` : ''}<div class="settings-list"><button class="settings-row" data-action="edit-account">${icon('edit')}<span>Editar meus dados</span>${icon('chevron')}</button><button class="settings-row" data-action="go" data-target="acompanhar">${icon('clipboard')}<span>Meus registros e confirmações</span>${icon('chevron')}</button>${u.sectors.length ? `<button class="settings-row" data-action="go" data-target="demandas">${icon('tool')}<span>Demandas dos meus setores</span>${icon('chevron')}</button>` : ''}${u.role === 'admin' ? `<button class="settings-row" data-action="go" data-target="configuracao">${icon('settings')}<span>Configurar manutenção</span>${icon('chevron')}</button>` : ''}<button class="settings-row" data-action="about">${icon('info')}<span>Sobre o Campus em dia</span>${icon('chevron')}</button><button class="settings-row" data-action="logout">${icon('logout')}<span>Sair da conta</span>${icon('chevron')}</button></div><p class="account-footer">Campus em dia · UFV, campus Viçosa<br>Protótipo acadêmico · Grupo 5</p></div></div>${nav('conta')}`;
  }
  function authScreen(signup = false) {
    return `<div class="app-scroll"><div class="auth-screen"><div class="auth-brand"><img src="assets/simbolo.svg" alt=""><span>campus <b>em dia</b></span></div><h1 class="auth-heading">${signup ? 'Faça parte desse cuidado.' : 'Nosso campus.\nNosso cuidado.'}</h1><p class="auth-description">${signup ? 'Crie sua conta para registrar problemas e acompanhar as melhorias no campus.' : 'Entre para observar, compartilhar e acompanhar o que acontece na UFV.'}</p><form id="auth-form" data-signup="${signup}">${signup ? '<label class="field"><span>Seu nome</span><input name="name" autocomplete="name" placeholder="Nome e sobrenome" required minlength="3" maxlength="80"></label>' : ''}<label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" placeholder="seu@email.com" required maxlength="120"></label><label class="field"><span>Senha</span><input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="Pelo menos 6 caracteres" minlength="6" required maxlength="128"></label><div id="auth-error" class="field-error" role="alert"></div><button class="primary-button wide" type="submit"${authBusy ? ' disabled' : ''}>${authBusy ? 'Aguarde…' : signup ? 'Criar minha conta' : 'Entrar'}${icon('arrow')}</button></form><div class="auth-switch">${signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}<button class="text-button" data-action="go" data-target="${signup ? 'entrada' : 'cadastro'}">${signup ? 'Entrar' : 'Cadastre-se'}</button></div>${signup ? '<p class="subtle">O cadastro é simples e presume vínculo com a comunidade universitária. Não exige e-mail institucional.</p>' : `<div class="auth-demo"><p>Explore com uma conta de demonstração:</p>${[['marina','Comunidade','user'],['joao','Manutenção','tool'],['ana','Administração','shield']].map(([id,label,symbol]) => `<button class="secondary-button wide" data-action="demo" data-id="${id}">${icon(symbol)}${label}</button>`).join('')}</div>`}<p class="auth-note">Demonstração local · sem autenticação institucional</p></div></div>`;
  }

  const guides = {
    mapa: ['01', 'O campus é o ponto de partida.', 'Veja os problemas no mapa antes de registrar uma nova ocorrência.', [['Explore os marcadores', 'Toque em um ponto para ver um resumo.'], ['Refine a busca', 'Combine categoria, situação e setor.'], ['Colabore ou registre', 'Abra os detalhes ou adicione um novo relato.']], 'Mapa real do campus Viçosa, com visão de satélite e ruas. As ocorrências e os setores são demonstrativos.'],
    ocorrencia: ['02', 'Um relato, várias contribuições.', 'Os detalhes conectam a observação da comunidade ao atendimento.', [['Confirme o problema', '“Também observei” adiciona sua confirmação.'], ['Complete o relato', 'Acrescente uma informação útil.'], ['Acompanhe cada etapa', 'Consulte o histórico de atendimento.']], 'Uma conta pode confirmar cada ocorrência uma única vez. O histórico preserva autor e data.'],
    novo: ['03', 'Do olhar ao registro.', 'Um fluxo em três passos para comunicar o problema sem perder o contexto.', [['Marque o local', 'Arraste o mapa real, aproxime e toque no ponto.'], ['Descreva o problema', 'Escolha uma categoria e adicione uma foto opcional.'], ['Revise e envie', 'Confira o setor de encaminhamento.']], 'A categoria define o setor inicial. Marcar um local não depende do GPS.'],
    acompanhar: ['04', 'Acompanhe sua participação.', 'Consulte o que você registrou e os problemas que também observou.', [['Meus registros', 'Reveja os relatos criados por esta conta.'], ['Confirmações', 'Veja as ocorrências que você confirmou.'], ['Abra o histórico', 'Entenda o andamento de cada demanda.']], 'O acompanhamento fica disponível para todos os perfis autenticados.'],
    demandas: ['05', 'O cuidado vira atendimento.', 'Os responsáveis encontram as demandas dos setores em que estão vinculados.', [['Escolha uma demanda', 'Filtre pelo setor ou pela situação.'], ['Analise e encaminhe', 'Inicie a análise ou corrija o setor.'], ['Registre a providência', 'Inicie o atendimento e descreva a resolução.']], 'João atende elétrica e equipamentos. Resolver exige uma providência; encerrar exige justificativa.'],
    configuracao: ['06', 'Uma organização que se adapta.', 'A administração configura grupos de manutenção, categorias e responsáveis.', [['Mantenha os setores', 'Crie ou edite um grupo de atendimento.'], ['Associe as categorias', 'Defina para onde novos relatos são enviados.'], ['Vincule responsáveis', 'Uma conta pode atuar em vários setores.']], 'Ana administra as configurações. Ela só pode atender quando também possui um vínculo de setor.'],
    estatisticas: ['07', 'Enxergue o conjunto.', 'Os registros formam um panorama das demandas e do atendimento.', [['Escolha um período', 'Use os intervalos prontos ou datas específicas.'], ['Compare as quantidades', 'Consulte situação, categoria e setor.'], ['Observe o tempo médio', 'Veja o intervalo entre registro e resolução.']], 'A média usa somente as ocorrências resolvidas no período escolhido.'],
    conta: ['08', 'Sua conta, seus vínculos.', 'Cada perfil tem as funções da comunidade e seus acessos específicos.', [['Atualize seus dados', 'Edite seu nome e e-mail.'], ['Veja seus setores', 'Os vínculos definem acesso ao atendimento.'], ['Entre e saia', 'Explore também as telas de autenticação.']], 'Os perfis são preparados para a demonstração. O cadastro cria uma conta da comunidade.'],
    entrada: ['09', 'Entre para participar.', 'O acesso representa o cadastro simples previsto na concepção.', [['Escolha uma conta pronta', 'Use os atalhos de demonstração.'], ['Teste a entrada', 'E-mails de exemplo e senha campus123.'], ['Crie uma conta', 'Nome, e-mail e senha; sem integração institucional.']], 'As alterações ficam neste navegador. Não há servidor compartilhado nem conexão com a UFV.'],
    cadastro: ['10', 'Uma conta para cada olhar.', 'O cadastro representa o vínculo presumido com a comunidade universitária.', [['Informe seus dados', 'Não é necessário um e-mail institucional.'], ['Crie sua senha', 'A senha não é salva em texto puro.'], ['Explore o mapa', 'Sua nova conta terá acesso como membro.']], 'Nenhum cadastro permite se autodeclarar administrador.']
  };
  function renderGuide(screen) {
    const g = guides[screen] || guides.mapa;
    document.querySelector('#screen-guide').innerHTML = `<div class="guide-counter">ROTEIRO DE EXPLORAÇÃO <span>${g[0]}</span></div><h2>${g[1]}</h2><p class="guide-description">${g[2]}</p><div class="guide-steps">${g[3].map(([title,text],i) => `<div class="guide-step"><span>0${i+1}</span><div><b>${title}</b>${text}</div></div>`).join('')}</div><div class="guide-rule">${icon('info')}${g[4]}</div><div class="guide-route"><span class="panel-label">CONTINUE EXPLORANDO</span><button class="text-button" data-action="go" data-target="${screen === 'mapa' ? 'acompanhar' : 'mapa'}">${screen === 'mapa' ? 'Ver acompanhamento' : 'Voltar para o mapa'} ${icon('arrow')}</button></div>`;
  }
  function renderProfiles() {
    document.querySelector('#demo-profiles').innerHTML = [['marina','Comunidade','Registra e colabora','user'],['joao','Manutenção','Analisa e atende demandas','tool'],['ana','Administração','Organiza setores e vínculos','shield']].map(([id,label,text,symbol]) => `<button class="demo-profile${id === userId ? ' active' : ''}" data-action="demo" data-id="${id}" aria-pressed="${id === userId}"><span class="profile-symbol">${icon(symbol)}</span><span><b>${label}</b><small>${text}</small></span>${id === userId ? icon('check') : ''}</button>`).join('');
    const mobile = document.querySelector('#mobile-profile');
    const oldCustom = mobile.querySelector('[data-custom]'); if (oldCustom) oldCustom.remove();
    if (userId && !['marina','joao','ana'].includes(userId)) { const option = new Option('Sua conta', userId); option.dataset.custom = 'true'; mobile.add(option); }
    mobile.value = userId || 'access';
  }
  function render() {
    const parts = route().split('/'); let screen = parts[0];
    if (!user() && !['entrada','cadastro'].includes(screen)) { go('entrada'); return; }
    if (screen === 'demandas' && !user().sectors.length) { notify('O atendimento exige vínculo com um setor.', true); go('mapa'); return; }
    if (screen === 'configuracao' && user().role !== 'admin') { notify('Esta área é exclusiva da administração.', true); go('mapa'); return; }
    maps.dispose();
    if (screen === 'mapa') app.innerHTML = mapScreen();
    else if (screen === 'acompanhar') app.innerHTML = listScreen();
    else if (screen === 'demandas') app.innerHTML = listScreen(true);
    else if (screen === 'estatisticas') app.innerHTML = statsScreen();
    else if (screen === 'configuracao') app.innerHTML = configScreen();
    else if (screen === 'conta') app.innerHTML = accountScreen();
    else if (screen === 'entrada' || screen === 'cadastro') app.innerHTML = authScreen(screen === 'cadastro');
    else if (screen === 'ocorrencia') {
      const occurrence = data.occurrences.find(o => o.id === parts[1]);
      if (!occurrence) { notify('Ocorrência não encontrada.', true); go('mapa'); return; }
      app.innerHTML = detailScreen(occurrence);
    } else if (screen === 'novo') {
      let step = Number(parts[1]) || 1;
      if (step < 1 || step > 3) { go('novo/1'); return; }
      if (step > 1 && draft.lat === null) { go('novo/1'); return; }
      if (step === 3 && (!draft.category || draft.description.trim().length < 10)) { go('novo/2'); return; }
      app.innerHTML = newScreen(step);
    } else { go('mapa'); return; }
    renderProfiles(); renderGuide(screen); mountMaps();
  }
  function openSheet(title, content) {
    sheet.innerHTML = `<div class="sheet-heading"><h2>${esc(title)}</h2><button class="icon-button" data-action="close-sheet" aria-label="Fechar">${icon('close')}</button></div>${content}`;
    if (!sheet.open) sheet.showModal();
  }
  function closeAndRender() { sheet.close(); render(); }
  function uniqueId(prefix) { return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2,7)}`; }
  function requireAdmin() { if (user()?.role === 'admin') return true; notify('Somente a administração pode alterar esta configuração.', true); return false; }

  function filterSheet() {
    openSheet('Encontrar ocorrências', `<form id="filter-form"><label class="field"><span>Categoria</span><select name="category">${options(data.categories, filter.category, 'Todas as categorias')}</select></label><label class="field"><span>Situação</span><select name="status"><option value="">Todas as situações</option><option value="ativas"${filter.status === 'ativas' ? ' selected' : ''}>Em aberto</option>${Object.entries(statuses).map(([id,s]) => `<option value="${id}"${filter.status === id ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label><label class="field"><span>Setor responsável</span><select name="sector">${options(data.sectors, filter.sector, 'Todos os setores')}</select></label><div class="button-row"><button class="secondary-button" type="button" data-action="clear-filters">Limpar</button><button class="primary-button" type="submit">Aplicar filtros</button></div></form>`);
  }
  function attendanceSheet(o, status) {
    if (!canAttend(o)) { notify('Você não possui vínculo com o setor atual desta ocorrência.', true); return; }
    const allowed = { registrada: ['analise','encerrada'], analise: ['andamento','encerrada'], andamento: ['resolvida'] };
    if (!allowed[o.status]?.includes(status)) { notify('Esta mudança não está disponível na situação atual.', true); return; }
    const resolve = status === 'resolvida', close = status === 'encerrada';
    const title = resolve ? 'Registrar resolução' : close ? 'Encerrar ocorrência' : status === 'analise' ? 'Iniciar análise' : 'Iniciar atendimento';
    openSheet(title, `<p>${resolve ? 'Descreva a providência realizada para concluir o atendimento.' : close ? 'Explique por que o registro não seguirá para atendimento.' : 'Esta ação atualiza a situação e registra uma nova etapa no histórico.'}</p><form id="attendance-form" data-id="${o.id}" data-status="${status}"><label class="field"><span>${resolve ? 'Providência adotada' : close ? 'Justificativa' : 'Observação'}${!resolve && !close ? ' <small>opcional</small>' : ''}</span><textarea name="note" placeholder="${resolve ? 'Ex.: substituímos as lâmpadas e verificamos o funcionamento.' : close ? 'Informe o motivo do encerramento…' : 'Acrescente um contexto para a comunidade…'}"${resolve || close ? ' required minlength="10"' : ''} maxlength="1500"></textarea></label>${close ? '<div class="sheet-tip">O encerramento é final nesta versão. O registro e o histórico serão preservados.</div>' : ''}<button class="${close ? 'danger-button' : 'primary-button'} wide" type="submit">${icon(close ? 'archive' : 'check')}${title}</button></form>`);
  }
  function transferSheet(o) {
    if (!canAttend(o) || !['registrada','analise'].includes(o.status)) return;
    openSheet('Transferir demanda', `<p>Corrija o encaminhamento. O histórico registrará o setor anterior, o novo setor e sua observação.</p><form id="transfer-form" data-id="${o.id}"><label class="field"><span>Novo setor responsável</span><select name="sector" required>${options(data.sectors.filter(s => s.active && s.id !== o.sector), '', 'Escolha um setor')}</select></label><label class="field"><span>Motivo da transferência</span><textarea name="note" required minlength="10" maxlength="1500" placeholder="Explique por que este setor é mais adequado…"></textarea></label><button class="primary-button wide" type="submit">${icon('transfer')}Confirmar transferência</button></form>`);
  }
  function editSector(id) {
    if (!requireAdmin()) return;
    const s = id ? sector(id) : null;
    openSheet(s ? 'Editar setor' : 'Criar setor', `<form id="sector-form" data-id="${esc(id || '')}"><label class="field"><span>Nome do setor</span><input name="name" value="${esc(s?.name)}" required minlength="3" maxlength="80"></label><label class="field"><span>Descrição <small>opcional</small></span><textarea name="description" maxlength="300">${esc(s?.description)}</textarea></label><label class="switch-row"><span>Disponível para encaminhamento</span><input type="checkbox" name="active"${!s || s.active ? ' checked' : ''}></label><div class="sheet-tip">Para desativar um setor, encaminhe suas demandas abertas e altere suas categorias ativas primeiro. O histórico será preservado.</div><button class="primary-button wide" type="submit">${icon('check')}Salvar setor</button></form>`);
  }
  function editCategory(id) {
    if (!requireAdmin()) return;
    const c = id ? cat(id) : null;
    openSheet(c ? 'Editar categoria' : 'Criar categoria', `<form id="category-form" data-id="${esc(id || '')}"><label class="field"><span>Nome da categoria</span><input name="name" value="${esc(c?.name)}" required minlength="3" maxlength="60"></label><label class="field"><span>Setor de encaminhamento inicial</span><select name="sector" required>${options(data.sectors.filter(s => s.active), c?.sector, 'Escolha um setor')}</select></label><label class="field"><span>Símbolo no mapa</span><select name="icon">${[['bulb','Iluminação'],['drop','Água'],['accessibility','Acessibilidade'],['tool','Equipamentos'],['building','Estrutura']].map(([id,label]) => `<option value="${id}"${c?.icon === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="switch-row"><span>Disponível em novos registros</span><input type="checkbox" name="active"${!c || c.active ? ' checked' : ''}></label><div class="sheet-tip">Mudar o setor desta categoria afeta apenas os novos registros. Ocorrências existentes mantêm seu setor atual.</div><button class="primary-button wide" type="submit">${icon('check')}Salvar categoria</button></form>`);
  }
  function editLinks(id) {
    if (!requireAdmin()) return;
    const u = data.users.find(person => person.id === id);
    openSheet('Vincular setores', `<p><b>${esc(u.name)}</b><br>${esc(u.email)}</p><form id="links-form" data-id="${id}">${data.sectors.filter(s => s.active || u.sectors.includes(s.id)).map(s => `<label class="sector-check"><input type="checkbox" name="sectors" value="${s.id}"${u.sectors.includes(s.id) ? ' checked' : ''}><span>${esc(s.name)}${s.active ? '' : ' · inativo'}</span></label>`).join('')}<div class="sheet-tip">A conta poderá analisar e atender ocorrências dos setores selecionados. Isso não concede acesso à administração.</div><button class="primary-button wide" type="submit">${icon('check')}Salvar vínculos</button></form>`);
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (!control || control.disabled) return;
    const { action, id, target, value } = control.dataset;
    const occurrence = id ? data.occurrences.find(o => o.id === id) : null;
    if (action === 'go') go(target);
    else if (action === 'demo') demoLogin(id);
    else if (action === 'access' || action === 'logout') { setSession(null); if (sheet.open) sheet.close(); go('entrada'); }
    else if (action === 'detail') { backTarget = route().split('/')[0]; detailTab = 'details'; go(`ocorrencia/${id}`); }
    else if (action === 'map-style') maps.setStyle(value);
    else if (action === 'toggle-map') { mapList = !mapList; render(); }
    else if (action === 'filters') filterSheet();
    else if (action === 'active-filter') { filter.status = filter.status === 'ativas' ? '' : 'ativas'; render(); }
    else if (action === 'clear-filters') { filter = { category: '', status: 'ativas', sector: '' }; search = ''; if (sheet.open) sheet.close(); render(); }
    else if (action === 'zoom-in' || action === 'zoom-out' || action === 'center-map') maps.control(action);
    else if (action === 'new') { draft = freshDraft(); go('novo/1'); }
    else if (action === 'new-next') { if (draft.lat === null) document.querySelector('#location-error').textContent = 'Selecione o local do problema para continuar.'; else go('novo/2'); }
    else if (action === 'location-preset') selectLocation(Number(control.dataset.lat), Number(control.dataset.lng), control.dataset.name);
    else if (action === 'publish-occurrence') publishOccurrence();
    else if (action === 'mine-tab') { mineTab = value; listStatus = ''; render(); }
    else if (action === 'detail-tab') { detailTab = value; render(); }
    else if (action === 'config-tab') { configTab = value; render(); }
    else if (action === 'confirm') {
      if (!user() || !occurrence || occurrence.confirmations.includes(userId)) return;
      if (commit(next => next.occurrences.find(o => o.id === id).confirmations.push(userId), 'Sua confirmação foi registrada.')) render();
    } else if (action === 'contribute') {
      openSheet('Acrescentar informação', `<p>Compartilhe um detalhe que ajude a entender ou localizar o problema.</p><form id="contribution-form" data-id="${id}"><label class="field"><span>Sua contribuição</span><textarea name="text" required minlength="5" maxlength="1500" placeholder="O que mais você observou?"></textarea></label><button class="primary-button wide" type="submit">${icon('message')}Publicar informação</button></form>`);
    } else if (action === 'attendance') attendanceSheet(occurrence, control.dataset.status);
    else if (action === 'transfer') transferSheet(occurrence);
    else if (action === 'edit-sector') editSector(id);
    else if (action === 'edit-category') editCategory(id);
    else if (action === 'edit-links') editLinks(id);
    else if (action === 'close-sheet') sheet.close();
    else if (action === 'edit-account') openSheet('Editar meus dados', `<form id="account-form"><label class="field"><span>Nome</span><input name="name" value="${esc(user().name)}" required minlength="3" maxlength="80"></label><label class="field"><span>E-mail</span><input type="email" name="email" value="${esc(user().email)}" required maxlength="120"></label><button class="primary-button wide" type="submit">${icon('check')}Salvar dados</button></form>`);
    else if (action === 'about') openSheet('Sobre o Campus em dia', '<p>Mapa colaborativo de ocorrências da UFV, campus Viçosa. Protótipo das telas de um aplicativo Android, desenvolvido a partir da concepção do Grupo 5.</p><p>Registre problemas de manutenção, colabore com a comunidade e acompanhe o atendimento.</p><div class="sheet-tip">Mapa real do campus; ocorrências, contas e setores de demonstração. As alterações são locais a este navegador; este protótipo não é um serviço oficial da UFV.</div><button class="secondary-button wide" data-action="close-sheet">Entendi</button>');
    else if (action === 'reset') openSheet('Restaurar demonstração?', '<p>Isso remove os registros, contas e alterações que você criou neste protótipo e recupera os dados de exemplo.</p><div class="button-row"><button class="secondary-button" data-action="close-sheet">Cancelar</button><button class="danger-button" data-action="confirm-reset">Restaurar</button></div>');
    else if (action === 'confirm-reset') {
      try { const next = initial(); localStorage.setItem(storageKey, JSON.stringify(next)); data = next; sheet.close(); configTab = 'sectors'; mineTab = 'authored'; period = 'month'; range = { start: '2026-10-01', end: demoDate }; demoLogin('marina'); notify('Dados de demonstração restaurados.'); }
      catch { notify('Não foi possível restaurar os dados.', true); }
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'map-search') {
      search = event.target.value;
      const items = filteredOccurrences();
      if (!items.some(o => o.id === selectedId)) selectedId = items[0]?.id;
      if (mapList) document.querySelector('#map-body').innerHTML = mapBody();
      else {
        maps.updateMarkers(items, selectedId);
        document.querySelector('#map-preview').innerHTML = mapPreview(items.find(o => o.id === selectedId));
        document.querySelector('.map-summary').textContent = `${items.length} ${filter.status === 'ativas' ? 'ocorrências ativas' : 'ocorrências no mapa'}`;
      }
    }
    if (event.target.closest('#occurrence-form')) {
      if (['description','reference'].includes(event.target.name)) draft[event.target.name] = event.target.value;
    }
  });
  document.addEventListener('change', event => {
    const element = event.target;
    if (element.id === 'mobile-profile') { if (element.value === 'access') { setSession(null); go('entrada'); } else demoLogin(element.value); }
    else if (element.id === 'list-status') { listStatus = element.value; render(); }
    else if (element.id === 'queue-sector') { queueSector = element.value; render(); }
    else if (element.name === 'category' && element.closest('#occurrence-form')) { draft.category = element.value; document.querySelector('#routing-preview').innerHTML = routingNote(); }
    else if (element.id === 'photo-input') loadPhoto(element.files[0]);
    else if (element.id === 'stats-period') {
      period = element.value;
      if (period === 'month') range = { start: '2026-10-01', end: demoDate };
      else if (period === 'week') range = { start: '2026-10-01', end: demoDate };
      else if (period === 'all') range = { start: '2000-01-01', end: '2099-12-31' };
      else range = { start: '2026-10-01', end: demoDate };
      render();
    } else if (element.id === 'stats-start' || element.id === 'stats-end') {
      const start = document.querySelector('#stats-start').value;
      const end = document.querySelector('#stats-end').value;
      if (!start || !end || start > end) { notify('Escolha um período válido: a data inicial deve vir antes da final.', true); element.value = element.id === 'stats-start' ? range.start : range.end; return; }
      range = { start, end }; render();
    }
  });
  sheet.addEventListener('click', event => { if (event.target === sheet) { const r = sheet.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) sheet.close(); } });
  window.addEventListener('hashchange', render);

  async function loadPhoto(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { notify('Selecione uma imagem JPG, PNG ou WebP.', true); return; }
    if (file.size > 2*1024*1024) { notify('A foto deve ter no máximo 2 MB.', true); return; }
    try {
      const reader = new FileReader();
      const result = await new Promise((resolve,reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = new Image();
      await new Promise((resolve,reject) => { image.onload = resolve; image.onerror = reject; image.src = result; });
      draft.photo = result;
      const label = document.querySelector('#upload-label');
      if (label) label.innerHTML = `<img src="${esc(result)}" alt="Prévia da foto selecionada"><span>Trocar foto</span><input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp" aria-label="Trocar foto do problema"><small class="field-hint">JPG, PNG ou WebP · até 2 MB</small>`;
    } catch { notify('Não foi possível ler esta imagem. Escolha outra foto.', true); }
  }
  function publishOccurrence() {
    if (!user() || draft.lat === null || !geo.inArea(draft.lat, draft.lng) || draft.description.trim().length < 10 || !cat(draft.category)?.active || !sector(cat(draft.category).sector)?.active) { notify('Revise o local, a categoria e a descrição antes de enviar.', true); return; }
    let newId;
    const success = commit(next => {
      newId = String(next.nextId++).padStart(3,'0');
      const timestamp = now(); const category = next.categories.find(c => c.id === draft.category);
      const description = draft.description.trim();
      const firstSentence = description.split(/[.!?\n]/)[0];
      next.occurrences.unshift({ id: newId, title: firstSentence.length > 76 ? firstSentence.slice(0,73)+'…' : firstSentence, description, category: category.id, sector: category.sector, status: 'registrada', location: draft.location, lat: draft.lat, lng: draft.lng, coordinateSource: 'map-click', reference: draft.reference.trim(), photo: draft.photo, author: userId, createdAt: timestamp, resolvedAt: null, baseConfirmations: 0, confirmations: [], contributions: [], history: [{ title: 'Ocorrência registrada', text: `Encaminhada para ${next.sectors.find(s => s.id === category.sector).name.toLowerCase()}.`, author: userId, date: timestamp, status: 'registrada' }] });
    }, 'Ocorrência registrada e encaminhada ao setor.');
    if (success) { draft = freshDraft(); selectedId = newId; detailTab = 'details'; backTarget = 'acompanhar'; go(`ocorrencia/${newId}`); }
  }
  async function passwordHash(password, salt) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
  }
  async function authenticate(form, values) {
    if (authBusy) return;
    authBusy = true; const button = form.querySelector('[type="submit"]'); button.disabled = true;
    const signup = form.dataset.signup === 'true';
    const email = values.get('email').trim().toLowerCase(); const password = values.get('password');
    const error = form.querySelector('#auth-error');
    try {
      const existing = data.users.find(u => u.email.toLowerCase() === email);
      if (signup) {
        if (existing) { error.textContent = 'Já existe uma conta com este e-mail. Entre ou use outro endereço.'; return; }
        const salt = uniqueId('salt'); const hash = await passwordHash(password, salt); const id = uniqueId('user');
        const name = values.get('name').trim();
        if (name.length < 3) { error.textContent = 'Informe um nome com pelo menos 3 caracteres.'; return; }
        if (commit(next => next.users.push({ id, name, email, role: 'member', sectors: [], passwordHash: hash, salt }), 'Conta criada. Bem-vindo ao campus!')) { setSession(id); go('mapa'); }
      } else {
        const valid = existing && (existing.passwordHash ? await passwordHash(password,existing.salt) === existing.passwordHash : password === 'campus123');
        if (!valid) { error.textContent = 'E-mail ou senha incorretos. Para as contas de exemplo, use campus123.'; return; }
        setSession(existing.id); go('mapa'); notify('Você entrou na sua conta.');
      }
    } catch { error.textContent = 'Não foi possível concluir o acesso. Use localhost ou uma conta de demonstração.'; }
    finally { authBusy = false; button.disabled = false; form.querySelector('[name="password"]').value = ''; }
  }
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    if (form.id === 'auth-form') { await authenticate(form,values); return; }
    if (!user()) { notify('Entre na sua conta para continuar.',true); return; }
    if (form.id === 'occurrence-form') { draft.category = values.get('category'); draft.description = values.get('description').trim(); draft.reference = values.get('reference').trim(); go('novo/3'); }
    else if (form.id === 'filter-form') { filter = { category: values.get('category'), status: values.get('status'), sector: values.get('sector') }; closeAndRender(); }
    else if (form.id === 'contribution-form') {
      const text = values.get('text').trim();
      if (text.length < 5) { notify('Escreva uma informação com pelo menos 5 caracteres.',true); return; }
      if (commit(next => next.occurrences.find(o => o.id === form.dataset.id).contributions.push({ id: uniqueId('info'), author: userId, text, date: now() }), 'Sua informação foi publicada.')) closeAndRender();
    } else if (form.id === 'attendance-form') {
      const o = data.occurrences.find(item => item.id === form.dataset.id); const status = form.dataset.status; const note = values.get('note').trim();
      if (!canAttend(o)) { notify('Você não pode atender esta ocorrência.',true); return; }
      const allowed = { registrada:['analise','encerrada'], analise:['andamento','encerrada'], andamento:['resolvida'] };
      if (!allowed[o.status]?.includes(status)) { notify('Esta mudança não está disponível.',true); return; }
      if (['resolvida','encerrada'].includes(status) && note.length < 10) { notify('Descreva a providência ou justificativa com pelo menos 10 caracteres.',true); return; }
      const titles = { analise:'Análise iniciada', andamento:'Atendimento iniciado', resolvida:'Ocorrência resolvida', encerrada:'Ocorrência encerrada' };
      if (commit(next => {
        const occurrence = next.occurrences.find(item => item.id === o.id); const timestamp = now();
        occurrence.status = status;
        if (status === 'resolvida') occurrence.resolvedAt = timestamp;
        occurrence.history.push({ title: titles[status], text: note || (status === 'analise' ? 'O setor iniciou a análise desta demanda.' : 'O setor iniciou o atendimento no local.'), author: userId, date: timestamp, status });
      }, 'Situação e histórico atualizados.')) closeAndRender();
    } else if (form.id === 'transfer-form') {
      const o = data.occurrences.find(item => item.id === form.dataset.id); const sectorId = values.get('sector'); const note = values.get('note').trim();
      if (!canAttend(o) || !['registrada','analise'].includes(o.status) || !sector(sectorId)?.active || sectorId === o.sector || note.length < 10) { notify('Revise o setor e o motivo da transferência.',true); return; }
      if (commit(next => {
        const occurrence = next.occurrences.find(item => item.id === o.id); const previous = sector(occurrence.sector).name;
        occurrence.sector = sectorId;
        occurrence.history.push({ title:'Setor responsável alterado', text:`${previous} → ${sector(sectorId).name}. ${note}`, author:userId, date:now(), status:occurrence.status });
      }, 'Demanda transferida.')) closeAndRender();
    } else if (form.id === 'account-form') {
      const name = values.get('name').trim(), email = values.get('email').trim().toLowerCase();
      if (name.length < 3) { notify('Informe um nome com pelo menos 3 caracteres.',true); return; }
      if (data.users.some(u => u.id !== userId && u.email.toLowerCase() === email)) { notify('Este e-mail já está vinculado a outra conta.',true); return; }
      if (commit(next => Object.assign(next.users.find(u => u.id === userId), { name,email }), 'Seus dados foram atualizados.')) closeAndRender();
    } else if (form.id === 'sector-form' && requireAdmin()) {
      const id = form.dataset.id; const name = values.get('name').trim(); const active = values.has('active');
      if (name.length < 3) { notify('Informe um nome com pelo menos 3 caracteres.',true); return; }
      if (data.sectors.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) { notify('Já existe um setor com esse nome.',true); return; }
      if (id && !active && (data.categories.some(c => c.sector === id && c.active) || data.occurrences.some(o => o.sector === id && !terminal(o)))) { notify('Transfira as demandas abertas e altere as categorias ativas antes de desativar este setor.',true); return; }
      if (commit(next => {
        const info = { name, description:values.get('description').trim(), active };
        if (id) Object.assign(next.sectors.find(s => s.id === id),info); else next.sectors.push({ id:uniqueId('setor'), ...info });
      }, 'Setor salvo.')) closeAndRender();
    } else if (form.id === 'category-form' && requireAdmin()) {
      const id = form.dataset.id, name = values.get('name').trim(), sectorId = values.get('sector'), symbol = values.get('icon');
      if (name.length < 3 || !sector(sectorId)?.active) { notify('Revise o nome e o setor da categoria.',true); return; }
      if (data.categories.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) { notify('Já existe uma categoria com esse nome.',true); return; }
      if (commit(next => {
        const info = { name, sector:sectorId, icon:symbol, active:values.has('active'), tone:({ bulb:'amber',drop:'blue',accessibility:'green',tool:'orange',building:'green' })[symbol] };
        if (id) Object.assign(next.categories.find(c => c.id === id),info); else next.categories.push({ id:uniqueId('categoria'), ...info });
      }, 'Categoria salva. Novos registros usarão este encaminhamento.')) closeAndRender();
    } else if (form.id === 'links-form' && requireAdmin()) {
      if (commit(next => next.users.find(u => u.id === form.dataset.id).sectors = values.getAll('sectors'), 'Vínculos de atendimento atualizados.')) closeAndRender();
    }
  });
  render();
  if (storageWarning) notify('O navegador não disponibilizou os dados salvos. A demonstração foi carregada; operações precisam de armazenamento local.',true);
})();
