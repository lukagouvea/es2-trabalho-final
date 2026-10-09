/* Consulta nomes nos dados atuais do mapa, somente após a seleção de um ponto. */
window.CampusGeocoder = (() => {
  const cacheKey = 'campus-geocoding-cache-v1';
  const cacheLifetime = 24 * 60 * 60 * 1000;
  const cache = new Map();
  let configPromise;
  let queue = Promise.resolve();
  let lastRequest = 0;
  try {
    const entries = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    if (Array.isArray(entries)) for (const [key, entry] of entries.slice(-100)) {
      if (entry?.expires > Date.now() && typeof entry.result?.label === 'string') cache.set(key, entry);
    }
  } catch { /* A consulta continua disponível sem cache persistente. */ }

  function aborted(signal) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  }
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      aborted(signal);
      const cancel = () => { clearTimeout(timer); reject(new DOMException('Consulta cancelada', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
  async function fetchJson(url, signal, timeout) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    aborted(signal);
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Não foi possível consultar o nome do local.');
      return await response.json();
    } catch (error) {
      aborted(signal);
      if (controller.signal.aborted) throw new Error('A consulta do nome demorou para responder.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  async function config() {
    if (!configPromise) {
      configPromise = fetchJson('assets/geocoding-config.json', null, 8000).then(settings => {
        const endpoint = new URL(settings.endpoint);
        if (endpoint.protocol !== 'https:' && endpoint.origin !== location.origin) throw new Error('Serviço de localização inválido.');
        return {
          endpoint: endpoint.href,
          radiusKm: Math.max(0.01, Math.min(1, Number(settings.radiusKm) || .2)),
          requestIntervalMs: Math.max(1100, Number(settings.requestIntervalMs) || 1100),
          timeoutMs: Math.max(1000, Math.min(15000, Number(settings.timeoutMs) || 8000))
        };
      }).catch(error => { configPromise = null; throw error; });
    }
    return configPromise;
  }
  function resultFrom(feature) {
    const properties = feature?.properties;
    if (!properties) throw new Error('Nenhum nome foi encontrado neste ponto.');
    const text = value => typeof value === 'string' ? value.trim() : '';
    const name = text(properties.name);
    const street = text(properties.street);
    const address = [street, text(properties.housenumber)].filter(Boolean).join(', ');
    const label = name && name !== street ? [name, address].filter(Boolean).join(' · ') : address || name;
    if (!label) throw new Error('Nenhum nome foi encontrado neste ponto.');
    const osmType = { N: 'node', W: 'way', R: 'relation' }[properties.osm_type];
    const osmId = String(properties.osm_id || '');
    return {
      label: label.slice(0, 160),
      provider: 'Photon / OpenStreetMap',
      osmType: osmType || null,
      osmId: /^\d+$/.test(osmId) ? osmId : null,
      fetchedAt: new Date().toISOString()
    };
  }
  function remember(key, result) {
    cache.delete(key);
    cache.set(key, { expires: Date.now() + cacheLifetime, result });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
    try { localStorage.setItem(cacheKey, JSON.stringify([...cache])); }
    catch { /* O nome identificado continua utilizável mesmo sem salvar o cache. */ }
  }
  function reverse(lat, lng, { signal } = {}) {
    const lookup = async () => {
      aborted(signal);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas inválidas.');
      const settings = await config();
      aborted(signal);
      const key = `${settings.endpoint}|${lat.toFixed(6)},${lng.toFixed(6)}`;
      const saved = cache.get(key);
      if (saved?.expires > Date.now()) return { ...saved.result };
      await delay(Math.max(0, settings.requestIntervalMs - (Date.now() - lastRequest)), signal);
      aborted(signal);
      const url = new URL(settings.endpoint);
      url.searchParams.set('lat', lat.toFixed(7));
      url.searchParams.set('lon', lng.toFixed(7));
      url.searchParams.set('limit', '1');
      url.searchParams.set('radius', String(settings.radiusKm));
      lastRequest = Date.now();
      const payload = await fetchJson(url.href, signal, settings.timeoutMs);
      aborted(signal);
      const result = resultFrom(payload.features?.[0]);
      remember(key, result);
      return result;
    };
    const pending = queue.then(lookup);
    queue = pending.catch(() => {});
    return pending;
  }
  return { reverse };
})();
