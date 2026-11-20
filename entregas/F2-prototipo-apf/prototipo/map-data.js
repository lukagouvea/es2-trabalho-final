/* Referência: ponto do Google Maps enviado pelo usuário. Locais: OpenStreetMap. */
window.CampusGeo = (() => {
  const center = [-20.760506, -42.869627];
  const bounds = [[-20.774, -42.879], [-20.750, -42.853]];
  const places = [
    { id: 'biblioteca', name: 'Biblioteca Central', lat: -20.761367, lng: -42.8677889, source: 'way/292666798' },
    { id: 'ru', name: 'Restaurante Universitário I', lat: -20.7605309, lng: -42.8683881, source: 'way/292666797' },
    { id: 'cce', name: 'Centro de Ciências Exatas', lat: -20.7645023, lng: -42.8682372, source: 'way/149507970' },
    { id: 'pva', name: 'Pavilhão de Aulas I', lat: -20.7606768, lng: -42.8674828, source: 'node/8222713258' },
    { id: 'dce', name: 'Praça do DCE', lat: -20.7625072, lng: -42.8678067, source: 'way/309610538' },
    { id: 'esportes', name: 'Ginásio Poliesportivo', lat: -20.7646162, lng: -42.8654597, source: 'way/292822992' },
    { id: 'jardim', name: 'Praça P. H. Rolfs', lat: -20.7626668, lng: -42.869133, source: 'way/309610532' },
    { id: 'bernardes', name: 'Edifício Arthur Bernardes', lat: -20.7620272, lng: -42.86947, source: 'way/148819551' }
  ];
  const demoLocations = {
    '026': ['biblioteca', 0.00021, -0.00012], '027': ['ru', 0.00005, 0.00008],
    '025': ['cce', 0.00015, -0.00003], '024': ['jardim', 0.00006, 0.00014],
    '023': ['pva', 0, -0.00006], '022': ['dce', 0.00008, -0.00007],
    '021': ['esportes', 0.00015, -0.00014], '020': ['biblioteca', -0.00002, 0.00005],
    '019': ['cce', 0, 0.00013], '018': ['ru', -0.0001, -0.00006],
    '017': ['biblioteca', 0.00012, -0.00015], '016': ['dce', -0.00004, 0.00004]
  };
  const layers = {
    satellite: {
      label: 'Satélite',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagens © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri</a>, Vantor, Earthstar Geographics, GIS User Community · locais © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxNativeZoom: 19
    },
    streets: {
      label: 'Mapa', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxNativeZoom: 19
    }
  };
  function inArea(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= bounds[0][0] && lat <= bounds[1][0] && lng >= bounds[0][1] && lng <= bounds[1][1];
  }
  function migrate(data) {
    let changed = false;
    for (const occurrence of data.occurrences) {
      if (Number.isFinite(occurrence.lat) && Number.isFinite(occurrence.lng)) continue;
      const sample = demoLocations[occurrence.id];
      if (sample) {
        const place = places.find(p => p.id === sample[0]);
        occurrence.lat = +(place.lat + sample[1]).toFixed(7);
        occurrence.lng = +(place.lng + sample[2]).toFixed(7);
        occurrence.location = place.name;
        occurrence.coordinateSource = 'demo-near-landmark';
      } else {
        const oldNames = { 'Restaurante Universitário': 'ru', 'Centro de Ciências': 'cce', 'Pavilhão P. H. Rolfs': 'pva', 'DCE': 'dce', 'Área esportiva': 'esportes', 'Jardim central': 'jardim' };
        const place = places.find(p => p.name === occurrence.location || p.id === oldNames[occurrence.location] || occurrence.location?.includes(p.name));
        occurrence.lat = place?.lat ?? center[0];
        occurrence.lng = place?.lng ?? center[1];
        occurrence.coordinateSource = 'migrated-approximate';
      }
      delete occurrence.x; delete occurrence.y;
      changed = true;
    }
    if (data.geoVersion !== 1) { data.geoVersion = 1; changed = true; }
    return changed;
  }
  return { center, bounds, places, layers, inArea, migrate, googleUrl: 'https://www.google.com/maps?q=-20.760506,-42.869627&t=k', zoom: 16 };
})();
