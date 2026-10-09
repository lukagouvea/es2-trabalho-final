/* Mapas reais com Leaflet 1.9.4; as ocorrências continuam sendo exemplos. */
window.CampusMaps = (() => {
  const geo = window.CampusGeo;
  let style = 'satellite';
  let mainView = { center: geo.center, zoom: geo.zoom, initial: true };
  const instances = new Map();
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function cleanup(id) {
    const entry = instances.get(id);
    if (!entry) return;
    clearTimeout(entry.loadTimer);
    entry.observer?.disconnect();
    entry.map.stop();
    entry.map.remove();
    entry.credits.remove();
    instances.delete(id);
  }
  function dispose() { for (const id of [...instances.keys()]) cleanup(id); }
  function message(entry, text, type) {
    const root = entry.map.getContainer().parentElement;
    let notice = root.querySelector('.map-network-notice');
    if (!text) { notice?.remove(); return; }
    if (!notice) { notice = document.createElement('div'); notice.className = 'map-network-notice'; notice.setAttribute('role', 'status'); root.append(notice); }
    notice.className = `map-network-notice ${type || ''}`;
    notice.textContent = text;
    if (type === 'error') {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'map-retry'; retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => applyLayer(entry)); notice.append(retry);
    }
  }
  function applyLayer(entry) {
    if (entry.layer) entry.map.removeLayer(entry.layer);
    clearTimeout(entry.loadTimer);
    entry.loaded = false;
    if (style === 'streets' && location.protocol === 'file:') {
      message(entry, 'Para carregar o mapa de ruas, abra http://localhost:5173. A visão Satélite também está disponível.', 'error');
      return;
    }
    const source = geo.layers[style];
    const layer = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: 20, maxNativeZoom: source.maxNativeZoom, keepBuffer: 1, referrerPolicy: 'strict-origin-when-cross-origin' });
    entry.layer = layer;
    message(entry, 'Carregando mapa…', 'loading');
    entry.loadTimer = setTimeout(() => { if (!entry.loaded) message(entry, 'O mapa está demorando para carregar. Confira sua conexão com a internet.', 'error'); }, 10000);
    layer.on('tileload', () => { entry.loaded = true; clearTimeout(entry.loadTimer); message(entry, ''); });
    layer.on('tileerror', () => { if (!entry.loaded) message(entry, 'Não foi possível carregar o mapa. Confira sua conexão com a internet.', 'error'); });
    layer.addTo(entry.map);
    entry.map.getContainer().dataset.layer = style;
    const switcher = entry.map.getContainer().parentElement.querySelector('.map-style-switch');
    switcher?.querySelectorAll('button').forEach(button => { const active = button.dataset.value === style; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  }
  function create(id, { center = geo.center, zoom = geo.zoom, interactive = true, remember = false } = {}) {
    const node = document.getElementById(id);
    if (!node || !window.L) return null;
    cleanup(id);
    const map = L.map(node, { zoomControl: false, attributionControl: true, minZoom: 14, maxZoom: 20, dragging: interactive, touchZoom: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, maxBounds: [[geo.bounds[0][0] - .015, geo.bounds[0][1] - .015], [geo.bounds[1][0] + .015, geo.bounds[1][1] + .015]], maxBoundsViscosity: .8 });
    map.attributionControl.setPrefix(false);
    // Mantém os créditos visíveis junto ao mapa, sem sobrepor a área navegável.
    const credits = document.createElement('div');
    credits.className = 'map-credits';
    credits.setAttribute('aria-label', 'Créditos do mapa');
    credits.append(map.attributionControl.getContainer());
    if (remember) node.parentElement.after(credits);
    else node.after(credits);
    const entry = { map, credits, layer: null, markers: L.layerGroup().addTo(map), pin: null, remember };
    instances.set(id, entry);
    map.setView(center, zoom, { animate: false });
    if (remember && mainView.initial) {
      map.panBy([0, 80], { animate: false });
      mainView = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom(), initial: false };
    }
    if (remember) map.on('moveend', () => { mainView = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom(), initial: false }; });
    entry.observer = new ResizeObserver(() => { if (node.isConnected) map.invalidateSize({ pan: false }); });
    entry.observer.observe(node);
    applyLayer(entry);
    return entry;
  }
  function switcher() {
    return `<div class="map-style-switch" aria-label="Tipo de mapa">${Object.entries(geo.layers).map(([id, layer]) => `<button type="button" data-action="map-style" data-value="${id}" aria-pressed="${style === id}" class="${style === id ? 'active' : ''}">${layer.label}</button>`).join('')}</div>`;
  }
  function mountMain({ items, selected, category, icon, onSelect, onDeselect }) {
    const entry = create('campus-map', { ...mainView, remember: true });
    if (!entry) return;
    entry.onSelect = onSelect; entry.category = category; entry.icon = icon;
    entry.map.on('click', () => onDeselect?.());
    updateMarkers(items, selected);
  }
  function updateMarkers(items, selected) {
    const entry = instances.get('campus-map');
    if (!entry) return;
    entry.markers.clearLayers();
    for (const occurrence of items) {
      if (!geo.inArea(occurrence.lat, occurrence.lng)) continue;
      const category = entry.category(occurrence.category);
      const button = document.createElement('button');
      button.type = 'button'; button.className = `map-marker${occurrence.id === selected ? ' selected' : ''}`;
      button.dataset.id = occurrence.id; button.dataset.tone = category.tone;
      button.setAttribute('aria-label', `Selecionar ${occurrence.title}`); button.setAttribute('aria-pressed', occurrence.id === selected);
      button.innerHTML = entry.icon(category.icon);
      L.DomEvent.disableClickPropagation(button); L.DomEvent.disableScrollPropagation(button);
      button.addEventListener('click', () => entry.onSelect(occurrence.id));
      const marker = L.marker([occurrence.lat, occurrence.lng], { icon: L.divIcon({ html: button, className: 'campus-marker-container', iconSize: [38, 38], iconAnchor: [19, 38] }), interactive: true, keyboard: false, zIndexOffset: occurrence.id === selected ? 1000 : 0 }).addTo(entry.markers);
      marker.bindTooltip(esc(occurrence.title), { direction: 'top', offset: [0, -40] });
    }
  }
  function setPin(entry, lat, lng, icon) {
    if (entry.pin) entry.map.removeLayer(entry.pin);
    entry.pin = L.marker([lat, lng], { icon: L.divIcon({ html: icon('pin'), className: 'real-selection-pin', iconSize: [38, 46], iconAnchor: [19, 44] }), interactive: false }).addTo(entry.map);
  }
  function mountPicker({ draft, icon, onSelect }) {
    const center = draft.lat === null ? geo.center : [draft.lat, draft.lng];
    const entry = create('location-picker', { center, zoom: 16 });
    if (!entry) return;
    entry.map.on('click', event => onSelect(event.latlng.lat, event.latlng.lng));
    entry.map.getContainer().addEventListener('keydown', event => {
      if (event.target !== entry.map.getContainer() || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); const position = entry.map.getCenter(); onSelect(position.lat, position.lng);
    });
    if (draft.lat !== null) setPin(entry, draft.lat, draft.lng, icon);
    L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar mapa', zoomOutTitle: 'Afastar mapa' }).addTo(entry.map);
  }
  function pickerPin(lat, lng, icon, center = false) {
    const entry = instances.get('location-picker');
    if (!entry) return;
    setPin(entry, lat, lng, icon);
    if (center) entry.map.setView([lat, lng], Math.max(16, entry.map.getZoom()));
  }
  function mountReview({ draft, icon }) {
    const entry = create('review-map', { center: [draft.lat, draft.lng], zoom: 17, interactive: false });
    if (entry) setPin(entry, draft.lat, draft.lng, icon);
  }
  function setStyle(value) { if (!geo.layers[value]) return; style = value; instances.forEach(applyLayer); }
  function control(action) {
    const entry = instances.get('campus-map'); if (!entry) return;
    if (action === 'zoom-in') entry.map.zoomIn();
    else if (action === 'zoom-out') entry.map.zoomOut();
    else { entry.map.setView(geo.center, geo.zoom, { animate: false }); entry.map.panBy([0, 80], { animate: false }); }
  }
  function state(id = 'campus-map') { const entry = instances.get(id); return entry ? { center: [entry.map.getCenter().lat, entry.map.getCenter().lng], zoom: entry.map.getZoom(), layer: style } : null; }
  return { dispose, cleanup, switcher, mountMain, updateMarkers, mountPicker, pickerPin, mountReview, setStyle, control, state };
})();
