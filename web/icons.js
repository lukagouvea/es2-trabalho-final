const paths = {
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0L15 17H9l-.5-2.5Z"/><path d="M12 1V0M3 5l-1-1m19 1 1-1"/>',
  drop: '<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  tool: '<path d="M14 6a6 6 0 0 0-8 8l-4 4a2.8 2.8 0 0 0 4 4l4-4a6 6 0 0 0 8-8l-4 4-4-4 4-4Z"/>',
  accessibility:
    '<circle cx="12" cy="3" r="2"/><path d="M4 8h16m-8 0v7m0-3-5 9m5-9 5 9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  archive:
    '<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v13h14V7m-10 4h6"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 4 5v2"/>',
  shield:
    '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Z"/><path d="m8 11 3 3 5-6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  filter:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  chart: '<path d="M4 3v17h17M8 16v-4m5 4V8m5 8V5"/>',
  clipboard:
    '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1" fill="var(--surface)"/><path d="M9 11h6m-6 5h6"/>',
  settings:
    '<path d="m10 2-.7 3-2.8 1L4 4.5 2 8l2 2v4l-2 2 2 3.5L6.5 18l2.8 1 .7 3h4l.7-3 2.8-1 2.5 1.5 2-3.5-2-2v-4l2-2-2-3.5L17.5 6l-2.8-1-.7-3h-4Z"/><circle cx="12" cy="12" r="3"/>',
  building:
    '<path d="M4 22V4l8-2 8 2v18M2 22h20M9 22v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
  logout: '<path d="M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5"/>',
  camera:
    '<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  message: '<path d="M21 3H3v15h5l4 4 4-4h5V3Z"/><path d="M7 8h10M7 12h7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  transfer: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
  leaf: '<path d="M4 20c-5-13 9-15 16-16 0 9-3 17-13 15m-3 1L16 8"/>',
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
