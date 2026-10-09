/* Consultas simuladas para verificar nomes, cache, cancelamento e falhas sem usar o serviço público. */
const { chromium } = require(process.env.CAMPUS_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const result = name => ({ features: [{ properties: { name, street: 'Avenida Purdue', osm_type: 'W', osm_id: 123456 } }] });
const passed = [];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CAMPUS_CHROME || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const check = name => { passed.push(name); console.log('OK: ' + name); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ready = page => page.waitForFunction(() => document.querySelector('#location-selection').getAttribute('aria-busy') === 'false');
  const preset = (page, name = 'Biblioteca Central') => page.locator(`[data-action="location-preset"][data-name="${name}"]`).click();
  async function newPage(handler, options = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ...options });
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/https:\/\/(?:tile\.openstreetmap\.org\/|services\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/)/, route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await page.route('https://photon.komoot.io/reverse?**', async route => {
      try { await handler(route, new URL(route.request().url())); }
      catch { /* Uma seleção cancelada pode encerrar a requisição antes da resposta simulada. */ }
    });
    await page.goto('http://127.0.0.1:5173');
    await page.locator('[data-action="new"]').click();
    return page;
  }
  async function publish(page) {
    await page.locator('[data-action="new-next"]').click();
    await page.locator('.category-option:has([value="iluminacao"])').click();
    await page.locator('#occurrence-form [name="description"]').fill('Luminária apagada no ponto selecionado do campus.');
    await page.locator('[type="submit"]').click();
    await page.locator('[data-action="publish-occurrence"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/ocorrencia/'));
    return page.evaluate(() => JSON.parse(localStorage.getItem('campus-em-dia-prototipo-v1')).occurrences[0]);
  }
  try {
    const requests = [];
    const page = await newPage(async (route, url) => { requests.push(url); await route.fulfill({ json: result('Prédio consultado no mapa') }); });
    assert.equal(requests.length, 0);
    await preset(page, 'Restaurante Universitário I');
    await preset(page);
    assert.equal(await page.locator('[data-action="new-next"]').isDisabled(), true);
    await ready(page);
    assert.equal(await page.locator('#location-name').inputValue(), 'Prédio consultado no mapa · Avenida Purdue');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get('lat'), '-20.7613670');
    assert.equal(requests[0].searchParams.get('lon'), '-42.8677889');
    check('Nome vem da resposta nas coordenadas escolhidas; cliques rápidos consultam apenas o último ponto');
    await preset(page); await ready(page);
    assert.equal(requests.length, 1);
    await page.reload();
    await page.locator('#location-picker').waitFor();
    await preset(page); await ready(page);
    assert.equal(requests.length, 1);
    const occurrence = await publish(page);
    assert.equal(occurrence.location, 'Prédio consultado no mapa · Avenida Purdue');
    assert.equal(occurrence.locationSource, 'photon');
    assert.equal(occurrence.locationMetadata.osmId, '123456');
    assert.equal(occurrence.lat, -20.761367); assert.equal(occurrence.lng, -42.8677889);
    await page.reload();
    assert.match(await page.locator('.metadata-grid').textContent(), /Prédio consultado no mapa/);
    check('Cache sobrevive à recarga; registro preserva nome consultado, origem e coordenadas do clique');
    await page.close();

    let oldStarted;
    const started = new Promise(resolve => oldStarted = resolve);
    const race = await newPage(async (route, url) => {
      const old = url.searchParams.get('lat') === '-20.7613670';
      if (old) { oldStarted(); await pause(1800); }
      await route.fulfill({ json: result(old ? 'Resposta antiga' : 'Restaurante consultado') });
    });
    await preset(race); await started;
    await preset(race, 'Restaurante Universitário I'); await ready(race);
    assert.match(await race.locator('#location-name').inputValue(), /Restaurante consultado/);
    await pause(800);
    assert.doesNotMatch(await race.locator('#location-selection').textContent(), /Resposta antiga/);
    check('Resposta atrasada de um ponto anterior não substitui o novo local');
    await race.close();

    let manualStarted;
    const manualPending = new Promise(resolve => manualStarted = resolve);
    const manual = await newPage(async route => { manualStarted(); await pause(1200); await route.fulfill({ json: result('Nome automático atrasado') }); });
    await preset(manual);
    await manualPending;
    await manual.locator('#location-name').fill('Entrada lateral do laboratório');
    assert.equal(await manual.locator('[data-action="new-next"]').isDisabled(), false);
    await pause(1700);
    assert.equal(await manual.locator('#location-name').inputValue(), 'Entrada lateral do laboratório');
    const typed = await publish(manual);
    assert.equal(typed.location, 'Entrada lateral do laboratório');
    assert.equal(typed.locationSource, 'manual'); assert.equal(typed.locationMetadata, null);
    check('Correção manual cancela a consulta e permanece na revisão e no registro');
    await manual.close();

    const offline = await newPage(route => route.abort('internetdisconnected'));
    await preset(offline); await ready(offline);
    assert.match(await offline.locator('#location-name-help').textContent(), /coordenadas estão preservadas/);
    assert.equal(await offline.locator('#location-name').inputValue(), '');
    assert.equal(await offline.locator('[data-action="new-next"]').isDisabled(), false);
    const fallback = await publish(offline);
    assert.equal(fallback.locationSource, 'coordinates');
    assert.equal(fallback.location, 'Ponto selecionado no campus');
    assert.equal(fallback.lat, -20.761367);
    check('Falha de rede permite registrar pelas coordenadas sem inventar um ponto de referência');
    await offline.close();

    let attempts = 0;
    const empty = await newPage(route => route.fulfill({ json: ++attempts === 1 ? { features: [] } : result('Nome recuperado') }));
    await preset(empty); await ready(empty);
    assert.equal(await empty.locator('[data-action="retry-location-name"]').isVisible(), true);
    await empty.locator('[data-action="retry-location-name"]').click(); await ready(empty);
    assert.match(await empty.locator('#location-name').inputValue(), /Nome recuperado/);
    assert.equal(attempts, 2);
    check('Local sem nome mantém as coordenadas e permite repetir a consulta');
    await empty.close();

    const timeout = await newPage(async route => { await pause(1800); await route.fulfill({ json: result('Resposta após o limite') }); });
    await timeout.route('**/assets/geocoding-config.json', route => route.fulfill({ json: { endpoint: 'https://photon.komoot.io/reverse', timeoutMs: 1000 } }));
    await preset(timeout); await ready(timeout);
    assert.equal(await timeout.locator('[data-action="retry-location-name"]').isVisible(), true);
    assert.equal(await timeout.locator('[data-action="new-next"]').isDisabled(), false);
    check('Consulta com tempo excedido libera o formulário e oferece nova tentativa');
    await timeout.close();
    assert.deepEqual(errors, []);
    console.log(`\n${passed.length} grupos de localização passaram, sem erros JavaScript.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
