/* Verificação visual opcional, usando o Playwright já disponível nesta máquina. */
const { chromium } = require(process.env.CAMPUS_PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CAMPUS_CHROME || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => document.querySelectorAll('#campus-map .leaflet-tile-loaded').length > 0, null, { timeout: 25000 });
  await page.screenshot({ path: 'prototipo/verificacao/desktop.png', fullPage: true });
  console.log(JSON.stringify({ title: await page.title(), header: await page.locator('#app h1').textContent(), tiles: await page.locator('#campus-map .leaflet-tile-loaded').count(), map: await page.evaluate(() => CampusMaps.state()), errors }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'prototipo/verificacao/celular.png', fullPage: true });
  await page.locator('#app [data-action="new"]').click();
  await page.locator('#location-picker').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('#location-picker .leaflet-tile-loaded').length > 0);
  await page.screenshot({ path: 'prototipo/verificacao/mapa-local.png', fullPage: true });
  await page.locator('#app [data-action="location-preset"][data-name="Biblioteca Central"]').click();
  await page.locator('#app [data-action="new-next"]').click();
  await page.locator('.category-option:has([value="iluminacao"])').click();
  await page.locator('#occurrence-form [name="description"]').fill('Poste apagado próximo à entrada da Biblioteca Central. O caminho fica escuro ao anoitecer.');
  await page.locator('#app [type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#review-map .leaflet-tile-loaded').length > 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(200);
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll('#review-map .leaflet-tile')];
    return tiles.length > 0 && tiles.every(tile => tile.complete && tile.naturalWidth > 0 && tile.classList.contains('leaflet-tile-loaded'));
  }, null, { timeout: 25000 });
  await page.screenshot({ path: 'prototipo/verificacao/registro.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
