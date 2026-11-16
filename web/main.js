import {
  supabase,
  configured,
  api,
  allPages,
  invalidateRequests,
  onMutation,
  StaleRequest,
} from "./client.js";
import { icon } from "./icons.js";

const app = document.querySelector("#app");
const sheet = document.querySelector("#sheet");
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const date = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const statuses = {
  registrada: { name: "Registrada", tone: "amber" },
  analise: { name: "Em análise", tone: "blue" },
  andamento: { name: "Em atendimento", tone: "orange" },
  resolvida: { name: "Resolvida", tone: "green" },
  encerrada: { name: "Encerrada", tone: "gray" },
};
const statusItems = Object.entries(statuses).map(([id, s]) => ({
  id,
  name: s.name,
}));
const tones = {
  bulb: "amber",
  drop: "blue",
  tool: "orange",
  accessibility: "green",
  leaf: "green",
};
let session = null,
  me = null,
  catalog = { sectors: [], categories: [] },
  items = [],
  detail = null;
let events = [],
  contributions = [],
  stats = null,
  users = [];
let loading = true,
  loadError = "",
  loadVersion = 0,
  controller;
let filters = { categoryId: "", sectorId: "", status: "", q: "" },
  mapList = false,
  scope = "authored",
  configTab = "sectors";
let selected = null,
  detailTab = "details";
let dates = { from: today().slice(0, 8) + "01", to: today() };
let draft = freshDraft(),
  lookup,
  lookupVersion = 0,
  toastTimer,
  authMode = "signin";
let authGeneration = 0;
function freshDraft() {
  return {
    requestId: crypto.randomUUID(),
    categoryId: "",
    description: "",
    locationName: "",
    reference: "",
    lat: null,
    lng: null,
    locationSource: "coordinates",
    locationMetadata: null,
    photo: null,
    photoPath: null,
    photoPreview: null,
  };
}
const category = (id) =>
  catalog.categories.find((c) => c.id === id) || {
    name: "Categoria",
    icon: "pin",
    tone: "green",
  };
const sector = (id) =>
  catalog.sectors.find((s) => s.id === id) || { name: "Setor" };
const activeSectors = () => catalog.sectors.filter((s) => s.active);
const activeCategories = () =>
  catalog.categories.filter((c) => c.active && sector(c.sectorId).active);
const title = (o) =>
  o.description?.split(/[.!?\n]/)[0]?.slice(0, 70) || "Ocorrência";
const terminal = (o) => ["resolvida", "encerrada"].includes(o.status);
const canAttend = (o) => me?.sectorIds.includes(o.sectorId) && !terminal(o);
const badge = (status) =>
  `<span class="badge tone-${statuses[status]?.tone || "gray"}">${esc(statuses[status]?.name || status)}</span>`;
const catIcon = (c) =>
  `<span class="category-icon tone-${tones[c.icon] || "green"}">${icon(c.icon)}</span>`;
const options = (list, value = "", placeholder = "Todos") =>
  `<option value="">${esc(placeholder)}</option>${list.map((i) => `<option value="${esc(i.id)}"${i.id === value ? " selected" : ""}>${esc(i.name)}</option>`).join("")}`;
const button = (text, action, extra = "", cls = "secondary-button") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const field = (label, name, value = "", attrs = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const textarea = (label, name, value = "", min = 0) =>
  `<label class="field"><span>${label}</span><textarea name="${name}" maxlength="1500" ${min ? `required minlength="${min}"` : ""}>${esc(value)}</textarea></label>`;
const formError = () => '<p class="form-error" role="alert"></p>';
function route() {
  return location.hash.replace(/^#\/?/, "") || "mapa";
}
function go(path) {
  if (route() === path) refresh();
  else location.hash = `/${path}`;
}
function notify(message, error = false) {
  const node = document.querySelector("#toast");
  clearTimeout(toastTimer);
  node.textContent = message;
  node.className = `toast visible${error ? " error" : ""}`;
  toastTimer = setTimeout(() => {
    node.className = "toast";
  }, 6000);
}
function header(text, kicker = "") {
  return `<header class="app-header"><div><span class="header-kicker">${esc(kicker)}</span><h1>${esc(text)}</h1></div>${button(icon("user"), "go", 'data-target="conta" aria-label="Minha conta"', "avatar-button")}</header>`;
}
function pageHeader(text, back = "mapa") {
  return `<header class="page-header">${button(icon("back"), "go", `data-target="${back}" aria-label="Voltar"`, "icon-button")}<h1>${esc(text)}</h1></header>`;
}
function nav(active) {
  const links = [
    ["mapa", "map", "Mapa"],
    ["acompanhar", "clipboard", "Acompanhar"],
  ];
  if (me?.sectorIds.length) links.push(["demandas", "tool", "Demandas"]);
  if (me?.isAdmin) links.push(["configuracao", "settings", "Gestão"]);
  links.push(["estatisticas", "chart", "Panorama"], ["conta", "user", "Conta"]);
  return `<nav class="bottom-nav" aria-label="Navegação principal">${links.map(([target, symbol, label]) => `<button type="button" class="nav-item ${active === target ? "active" : ""}" data-action="go" data-target="${target}" ${active === target ? 'aria-current="page"' : ""}><span class="nav-icon">${icon(symbol)}</span>${label}</button>`).join("")}</nav>`;
}
const empty = (text = "Nenhuma ocorrência encontrada") =>
  `<div class="empty-state"><div class="empty-icon">${icon("leaf")}</div><h2>${esc(text)}</h2><p>Explore o mapa ou ajuste os filtros da consulta.</p></div>`;
const plural = (count, one, many) => (Number(count) === 1 ? one : many);
function resolutionDuration(hours) {
  if (hours == null) return "—";
  const value = Number(hours);
  if (value < 1 / 60) return "< 1 min";
  if (value < 1) return `${Math.floor(value * 60)} min`;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}
function row(o) {
  return `<button type="button" class="occurrence-row" data-action="detail" data-id="${o.id}">${catIcon(category(o.categoryId))}<div class="row-content"><div class="row-meta"><small>#${o.number} · ${date(o.createdAt)}</small>${badge(o.status)}</div><h3>${esc(title(o))}</h3><span class="row-location">${icon("pin")}${esc(o.locationName)} · ${o.confirmationCount} ${plural(o.confirmationCount, "confirmação", "confirmações")}</span></div>${icon("chevron")}</button>`;
}
function filterFields(queue = false) {
  return `<div class="filter-grid"><label class="field"><span>Categoria</span><select name="categoryId">${options(catalog.categories, filters.categoryId, "Todas as categorias")}</select></label><label class="field"><span>Situação</span><select name="status">${options(statusItems, filters.status, "Todas as situações")}</select></label><label class="field"><span>Setor</span><select name="sectorId">${options(queue ? catalog.sectors.filter((s) => me.sectorIds.includes(s.id)) : catalog.sectors, filters.sectorId, queue ? "Meus setores" : "Todos os setores")}</select></label></div>`;
}
function searchForm(queue = false) {
  return `<form id="search-form" class="map-controls"><label class="search-field">${icon("search")}<input type="search" name="q" value="${esc(filters.q)}" placeholder="Busque um local ou ocorrência" aria-label="Buscar local ou ocorrência"></label>${window.matchMedia("(max-width:700px)").matches ? `<details class="filter-panel"><summary>${icon("filter")}Filtros de categoria, situação e setor</summary>${filterFields(queue)}</details>` : filterFields(queue)}<div class="inline-actions"><button class="secondary-button" type="submit">${icon("search")}Aplicar filtros</button>${button("Limpar", "clear-filters", "", "text-button")}${route() === "mapa" ? button(`${icon(mapList ? "map" : "list")}${mapList ? "Ver mapa" : "Ver lista"}`, "toggle-map", "", "text-button") : ""}</div></form>`;
}
function mapPreview(o) {
  return o
    ? `<button class="map-preview" data-action="detail" data-id="${o.id}"><div class="preview-top">${catIcon(category(o.categoryId))}<div><span class="category-name">${esc(category(o.categoryId).name)}</span><small>OCORRÊNCIA #${o.number}</small></div>${badge(o.status)}</div><h2>${esc(title(o))}</h2><div class="preview-bottom"><span>${icon("pin")}${esc(o.locationName)}</span><span>${icon("users")}${o.confirmationCount}</span>${icon("arrow")}</div></button>`
    : "";
}
function mapScreen() {
  if (!items.some((o) => o.id === selected)) selected = items[0]?.id;
  return `${header("Nosso campus", `Olá, ${me.name.split(" ")[0]}`)}${searchForm()}<div class="map-results-heading"><h2>${items.length} ${items.length === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}</h2>${button(`${icon("plus")}Registrar ocorrência`, "new", "", "primary-button")}</div>${mapList ? `<div class="app-scroll occurrence-list">${items.map(row).join("") || empty()}</div>` : `<div class="map-stage"><div id="campus-map" class="real-campus-map" aria-label="Mapa da UFV, campus Viçosa"></div>${window.CampusMaps.switcher()}<div class="map-tools">${button(icon("plus"), "zoom-in", 'aria-label="Aproximar mapa"', "icon-button")}${button(icon("minus"), "zoom-out", 'aria-label="Afastar mapa"', "icon-button")}${button(icon("target"), "center-map", 'aria-label="Centralizar mapa"', "icon-button")}</div><div class="map-bottom"><div id="map-preview">${mapPreview(items.find((o) => o.id === selected))}</div></div></div>${!items.length ? empty() : ""}`}${nav("mapa")}`;
}
function listScreen(queue) {
  return `${header(queue ? "Demandas do setor" : "Acompanhar", queue ? "CUIDADO QUE VIRA AÇÃO" : "SEUS REGISTROS, EM UM SÓ LUGAR")}${queue ? `<p class="queue-sectors">${me.sectorIds.map((id) => esc(sector(id).name)).join(" · ")}</p>` : `<div class="tab-row"><button class="tab ${scope === "authored" ? "active" : ""}" data-action="scope" data-value="authored">Meus registros</button><button class="tab ${scope === "confirmed" ? "active" : ""}" data-action="scope" data-value="confirmed">Confirmações</button></div>`}${searchForm(queue)}<div class="list-meta">${items.length} ${plural(items.length, "registro", "registros")}</div><div class="app-scroll occurrence-list">${items.map(row).join("") || empty(queue ? "Nenhuma demanda encontrada" : "Nenhum registro nesta consulta")}</div>${nav(queue ? "demandas" : "acompanhar")}`;
}
function management(o) {
  if (!canAttend(o)) return "";
  const next = {
    registrada: ["analise", "Iniciar análise"],
    analise: ["andamento", "Iniciar atendimento"],
    andamento: ["resolvida", "Registrar resolução"],
  }[o.status];
  return `<section class="manage-box"><h3>${icon("tool")}Atendimento do setor</h3><p>Você está vinculado a ${esc(sector(o.sectorId).name)}.</p>${button(next[1], "transition", `data-status="${next[0]}"`, "primary-button wide")}${["registrada", "analise"].includes(o.status) ? `<div class="button-row">${button("Transferir", "transfer", "", "text-button")}${button("Encerrar com justificativa", "transition", 'data-status="encerrada"', "text-button")}</div>` : ""}</section>`;
}
function detailScreen(o) {
  if (!o) return empty("Ocorrência não encontrada");
  const history = `<h2>A história deste registro</h2><p class="timeline-intro">Cada etapa preserva a data e quem realizou a ação.</p><div class="timeline">${events.map((e) => `<article class="timeline-item"><span class="tone-green">${icon("clock")}</span><div><h3>${esc(eventLabel(e))}</h3><p class="text-prewrap">${esc(e.text)}</p>${e.previousSectorId && e.sectorId !== e.previousSectorId ? `<p>${esc(sector(e.previousSectorId).name)} → ${esc(sector(e.sectorId).name)}</p>` : ""}<small>${esc(e.author?.name || "Usuário")} · ${date(e.createdAt)}</small></div></article>`).join("") || "<p>Nenhum evento disponível.</p>"}</div>`;
  return `${pageHeader(`Ocorrência #${o.number}`)}<div class="tab-row"><button class="tab ${detailTab === "details" ? "active" : ""}" data-action="detail-tab" data-value="details">Detalhes</button><button class="tab ${detailTab === "history" ? "active" : ""}" data-action="detail-tab" data-value="history">Histórico</button></div><div class="app-scroll page-content">${detailTab === "history" ? history : `<div class="detail-heading">${catIcon(category(o.categoryId))}${badge(o.status)}</div><h2 class="detail-title">${esc(title(o))}</h2><p class="detail-description text-prewrap">${esc(o.description)}</p>${o.photoUrl ? `<img class="detail-photo" src="${esc(o.photoUrl)}" alt="Foto do problema relatado">` : ""}<dl class="metadata-grid"><div class="full"><dt>LOCALIZAÇÃO</dt><dd>${icon("pin")}${esc(o.locationName)}</dd><dd>${esc(o.reference)}</dd><dd class="coordinate-label">${Number(o.latitude).toFixed(6)}, ${Number(o.longitude).toFixed(6)}</dd></div><div><dt>CATEGORIA</dt><dd>${esc(category(o.categoryId).name)}</dd></div><div><dt>REGISTRADA EM</dt><dd>${date(o.createdAt)}</dd></div><div class="full"><dt>SETOR RESPONSÁVEL</dt><dd>${esc(sector(o.sectorId).name)}</dd></div><div class="full"><dt>REGISTRADA POR</dt><dd>${esc(o.author?.name || "Usuário")}</dd></div></dl><section class="confirmation-block"><div class="confirmation-number">${icon("users")}<strong>${o.confirmationCount}</strong> ${plural(o.confirmationCount, "pessoa observou", "pessoas observaram")} este problema</div>${button(o.authorId === me.id ? "Você registrou esta ocorrência" : o.hasConfirmed ? "Você já confirmou" : "Também observei este problema", "confirm", o.hasConfirmed || o.authorId === me.id ? "disabled" : "", "secondary-button wide")}</section>${management(o)}${terminal(o) ? `<div class="terminal-note">${icon("info")}<div><b>${esc(statuses[o.status].name)}</b><p class="text-prewrap">${esc([...events].reverse().find((e) => e.status === o.status && ["transition", "status_changed"].includes(e.type))?.text || "Consulte a providência e a justificativa no histórico.")}</p></div></div>` : ""}<section class="section-gap"><div class="section-title"><h3>Informações da comunidade</h3><small>${o.contributionCount}</small></div>${contributions.map((c) => `<article class="contribution"><div class="contribution-head"><b>${esc(c.author?.name || "Usuário")}</b><span>${date(c.createdAt)}</span></div><p class="text-prewrap">${esc(c.text)}</p></article>`).join("") || '<p class="contribution-empty">Uma informação sua pode ajudar o atendimento.</p>'}${button(`${icon("message")}Acrescentar informação`, "contribute", "", "text-button")}</section>`}</div>${nav("mapa")}`;
}
function eventLabel(e) {
  return (
    {
      created: "Ocorrência registrada",
      confirmation: "Problema confirmado",
      confirmed: "Problema confirmado",
      contribution: "Informação acrescentada",
      contributed: "Informação acrescentada",
      transition: statuses[e.status]?.name || "Situação atualizada",
      transferred: "Ocorrência transferida",
      transfer: "Ocorrência transferida",
    }[e.type] ||
    statuses[e.status]?.name ||
    "Atualização do registro"
  );
}
function registerScreen() {
  let step = Math.max(1, Math.min(3, Number(route().split("/")[1]) || 1));
  if (draft.lat === null || draft.lng === null) step = 1;
  else if (
    step === 3 &&
    (!draft.categoryId || draft.description.trim().length < 10)
  )
    step = 2;
  const stepper = `<div class="step-indicator">${["Local", "Problema", "Revisão"].map((label, i) => `${i ? "<i></i>" : ""}<span class="${step >= i + 1 ? "active" : ""}"><b>${i + 1}</b>${label}</span>`).join("")}</div>`;
  const location = `<span class="eyebrow">1 · LOCAL DO PROBLEMA</span><h2>Onde você observou?</h2><p class="picker-helper">Clique no mapa ou pressione Enter no centro para marcar o ponto. Você também pode preencher as coordenadas.</p><div class="picker-map-wrap"><div id="location-picker" class="picker-map" tabindex="0" aria-label="Selecionar local do problema"></div>${window.CampusMaps.switcher()}</div><div class="field-row">${field("Latitude", "latitude", draft.lat ?? "", 'type="number" step="any" min="-20.774" max="-20.750" required')}${field("Longitude", "longitude", draft.lng ?? "", 'type="number" step="any" min="-42.879" max="-42.853" required')}</div><p id="location-state" class="location-state">${draft.lat === null ? "Selecione um ponto na área do campus." : "Ponto selecionado. Você pode ajustar o nome abaixo."}</p>${field("Nome do local (opcional)", "locationName", draft.locationName, 'maxlength="160"')}${field("Ponto de referência (opcional)", "reference", draft.reference, 'maxlength="160"')}${button("Consultar nome do ponto novamente", "retry-location", "", "text-button")}`;
  const problem = `<span class="eyebrow">2 · O QUE VOCÊ OBSERVOU</span><h2>Conte o que aconteceu.</h2><label class="field"><span>Categoria</span><select name="categoryId" required>${options(activeCategories(), draft.categoryId, "Selecione uma categoria")}</select></label><p id="routing-note" class="notice">Encaminhamento inicial: ${draft.categoryId ? esc(sector(category(draft.categoryId).sectorId).name) : "selecione uma categoria"}</p>${textarea("Descrição do problema", "description", draft.description, 10)}<label class="field"><span>Foto (opcional)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><small class="input-help">JPG, PNG ou WebP, até 2 MB.</small></label><div class="draft-photo" ${draft.photo ? "" : "hidden"}><p id="photo-name">${esc(draft.photo?.name)}</p><img id="photo-preview" class="photo-preview" src="${draft.photoPreview || ""}" alt="Prévia da foto selecionada">${button("Remover foto", "remove-photo", "", "text-button")}</div>`;
  const review = `<span class="eyebrow">3 · REVISÃO</span><h2>Está tudo certo?</h2><p class="notice">Confira o ponto e a descrição antes de publicar. O relato original será preservado no histórico.</p><div class="review-map-wrap"><div id="review-map" class="review-mini-map" aria-label="Local selecionado no mapa"></div></div><dl class="metadata-grid"><div class="full"><dt>LOCALIZAÇÃO</dt><dd>${esc(draft.locationName || "Ponto selecionado no campus")}</dd><dd class="coordinate-label">${draft.lat}, ${draft.lng}</dd><dd>${esc(draft.reference)}</dd></div><div><dt>CATEGORIA</dt><dd>${esc(category(draft.categoryId).name)}</dd></div><div><dt>SETOR INICIAL</dt><dd>${esc(sector(category(draft.categoryId).sectorId).name)}</dd></div></dl><h3>Descrição</h3><p class="detail-description text-prewrap">${esc(draft.description)}</p>${draft.photoPreview ? `<img class="photo-preview" src="${draft.photoPreview}" alt="Foto selecionada para publicação">` : ""}`;
  return `${pageHeader("Registrar ocorrência", step === 1 ? "mapa" : `novo/${step - 1}`)}${stepper}<div class="app-scroll page-content"><form id="${step === 1 ? "occurrence-location-form" : step === 2 ? "occurrence-problem-form" : "occurrence-form"}" class="form-width">${step === 1 ? location : step === 2 ? problem : review}${formError()}<button type="submit" class="primary-button wide">${icon(step === 3 ? "check" : "arrow")}${step === 3 ? "Publicar ocorrência" : step === 1 ? "Continuar para o problema" : "Revisar ocorrência"}</button></form></div>${nav("mapa")}`;
}
function accountScreen() {
  return `${header("Minha conta")}<div class="app-scroll page-content"><div class="form-width"><section class="account-summary"><h2>${esc(me.name)}</h2><p>${esc(session.user.email)}</p><p>${me.isAdmin ? "Administrador" : "Membro da comunidade"}${me.sectorIds.length ? " · Responsável de manutenção" : ""}</p>${me.sectorIds.length ? `<p>${me.sectorIds.map((id) => esc(sector(id).name)).join(" · ")}</p>` : ""}</section><form id="account-form">${field("Nome", "name", me.name, 'required minlength="3" maxlength="80"')}${field("E-mail", "email", session.user.email, 'type="email" required maxlength="254"')}${formError()}<p class="form-success" role="status"></p><button class="primary-button wide" type="submit">Salvar meus dados</button></form><div class="section-gap">${button(`${icon("logout")}Sair da conta`, "logout", "", "secondary-button wide")}</div><p class="account-footer">Campus em dia · Projeto acadêmico do Grupo 5<br>Mapa colaborativo da UFV, campus Viçosa.</p></div></div>${nav("conta")}`;
}
function authScreen() {
  const signup = authMode === "signup";
  return `<div class="auth-screen"><div class="auth-brand"><img src="/assets/simbolo.svg" alt=""><span>campus <strong>em dia</strong></span></div><h1 class="auth-heading">${signup ? "Seu olhar faz diferença." : "Bom ter você por aqui."}</h1><p class="auth-description">${signup ? "Crie sua conta para registrar problemas e acompanhar o cuidado com o campus." : "Entre para colaborar com a comunidade e acompanhar cada registro."}</p><form id="auth-form">${signup ? field("Nome completo", "name", "", 'autocomplete="name" required minlength="3" maxlength="80"') : ""}${field("E-mail", "email", "", 'type="email" autocomplete="email" required maxlength="254"')}${field("Senha", "password", "", `type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8" maxlength="128"`)}${formError()}<button type="submit" class="primary-button wide">${signup ? "Criar minha conta" : "Entrar"}${icon("arrow")}</button></form><div class="auth-switch">${signup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}${button(signup ? "Entrar" : "Criar conta", "auth-mode", "", "text-button")}</div><p class="auth-note">Projeto acadêmico · UFV, campus Viçosa</p></div>`;
}
function statisticsScreen() {
  if (!stats) return "";
  const total = stats.total ?? stats.totalOccurrences ?? 0;
  const average =
    stats.averageResolutionHours ??
    stats.averageResolutionTimeHours ??
    (stats.averageResolutionSeconds == null
      ? null
      : stats.averageResolutionSeconds / 3600);
  const group = (heading, values, label) =>
    `<section class="stats-group"><h2>${heading}</h2><div class="bar-chart">${(Array.isArray(values) ? values : Object.entries(values || {}).map(([id, count]) => ({ id, count }))).map((v) => `<div><div class="bar-label"><span>${esc(v.name || label(v))}</span><strong>${v.count}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (100 * v.count) / Math.max(1, total)))}%"></div></div></div>`).join("") || "<p>Sem registros no período.</p>"}</div></section>`;
  return `${header("Panorama do campus", "ACOMPANHE O CUIDADO COM O CAMPUS")}<div class="app-scroll page-content"><form id="statistics-form"><div class="field-row">${field("Data inicial", "from", dates.from, 'type="date" required')}${field("Data final", "to", dates.to, 'type="date" required')}</div><button type="submit" class="secondary-button">Consultar período</button>${formError()}</form><div class="section-gap stat-hero"><div><strong class="stat-total">${total}</strong><p class="stat-total-label">${plural(total, "ocorrência registrada", "ocorrências registradas")} no período</p></div><div class="stat-side"><b>${resolutionDuration(average)}</b><small>tempo médio até a resolução</small></div></div>${group("Por situação", stats.byStatus, (v) => statuses[v.status || v.id]?.name || v.status || v.id)}<div class="stat-grid">${group("Por categoria", stats.byCategory, (v) => category(v.categoryId || v.id).name)}${group("Por setor", stats.bySector, (v) => sector(v.sectorId || v.id).name)}</div><p class="stat-explanation">Contagens consideram a data de criação e a classificação atual. A média considera as ocorrências resolvidas no período, inclusive as criadas antes dele. Datas no horário de São Paulo.</p></div>${nav("estatisticas")}`;
}
function configurationScreen() {
  const configs = configTab === "users" ? users : catalog[configTab];
  return `${header("Gestão", "CONFIGURAÇÃO DO CAMPUS")}<div class="tab-row">${[
    ["sectors", "Setores"],
    ["categories", "Categorias"],
    ["users", "Responsáveis"],
  ]
    .map(
      ([value, text]) =>
        `<button class="tab ${configTab === value ? "active" : ""}" data-action="config-tab" data-value="${value}">${text}</button>`,
    )
    .join(
      "",
    )}</div><div class="app-scroll page-content">${configTab === "users" ? `<form id="users-search"><label class="search-field">${icon("search")}<input type="search" name="q" aria-label="Buscar contas" placeholder="Buscar nome ou e-mail"></label><button class="secondary-button" type="submit">Buscar contas</button></form>` : `<div class="inline-actions">${button(`${icon("plus")}Adicionar ${configTab === "sectors" ? "setor" : "categoria"}`, "edit-config", "", "primary-button")}</div>`}${configs.map((c) => `<article class="config-item${c.active === false ? " config-inactive" : ""}"><div><h3>${esc(c.name)}${c.active === false ? " · Inativo" : ""}</h3><p>${esc(configTab === "sectors" ? c.description : configTab === "categories" ? sector(c.sectorId).name : c.email)}</p>${configTab === "users" ? `<p>${c.sectorIds.map((id) => esc(sector(id).name)).join(" · ") || "Sem vínculo de atendimento"}</p>` : ""}</div>${button(configTab === "users" ? "Vínculos" : "Editar", configTab === "users" ? "edit-memberships" : "edit-config", `data-id="${c.id}"`, "text-button")}</article>`).join("") || '<p class="notice">Nenhum resultado nesta consulta.</p>'}</div>${nav("configuracao")}`;
}
function render() {
  app.classList.toggle(
    "map-screen",
    Boolean(
      session && !loading && !loadError && route() === "mapa" && !mapList,
    ),
  );
  window.CampusMaps?.dispose();
  if (!configured) {
    app.innerHTML = `<div class="page-content"><h1>Configure a conexão para começar.</h1><p class="notice">Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente e reinicie a aplicação.</p></div>`;
    return;
  }
  if (!session) {
    app.innerHTML = authScreen();
    return;
  }
  if (loading) {
    app.innerHTML = `${header("Campus em dia")}<p class="page-loading" role="status">Carregando dados…</p>${me ? nav(route().split("/")[0]) : ""}`;
    return;
  }
  if (loadError) {
    app.innerHTML = `${header("Não foi possível carregar")}<div class="result-error"><p class="form-error" role="alert">${esc(loadError)}</p><div class="inline-actions error-actions">${button("Tentar novamente", "refresh")}${button("Sair da conta", "logout", "", "text-button")}</div></div>${me ? nav(route().split("/")[0]) : ""}`;
    return;
  }
  const path = route();
  if (path === "mapa") app.innerHTML = mapScreen();
  else if (path === "acompanhar" || path === "demandas")
    app.innerHTML = listScreen(path === "demandas");
  else if (path.startsWith("ocorrencia/")) app.innerHTML = detailScreen(detail);
  else if (path === "novo" || path.startsWith("novo/"))
    app.innerHTML = registerScreen();
  else if (path === "conta") app.innerHTML = accountScreen();
  else if (path === "estatisticas") app.innerHTML = statisticsScreen();
  else if (path === "configuracao" && me.isAdmin)
    app.innerHTML = configurationScreen();
  else
    app.innerHTML = `${pageHeader("Página indisponível")}${empty("Esta página não está disponível")}${nav("mapa")}`;
  mountMaps();
}
function mountMaps() {
  const maps = window.CampusMaps;
  if (document.querySelector("#campus-map"))
    maps.mountMain({
      items: items.map((o) => ({
        ...o,
        lat: o.latitude,
        lng: o.longitude,
        category: o.categoryId,
        title: title(o),
      })),
      selected,
      category: (id) => ({
        ...category(id),
        tone: tones[category(id).icon] || "green",
      }),
      icon,
      onSelect: (id) => {
        selected = id;
        maps.updateMarkers(
          items.map((o) => ({
            ...o,
            lat: o.latitude,
            lng: o.longitude,
            category: o.categoryId,
            title: title(o),
          })),
          selected,
        );
        document.querySelector("#map-preview").innerHTML = mapPreview(
          items.find((o) => o.id === id),
        );
      },
    });
  if (document.querySelector("#location-picker"))
    maps.mountPicker({ draft, icon, onSelect: selectLocation });
  if (document.querySelector("#review-map")) maps.mountReview({ draft, icon });
}
// Business data lives only in this session's memory. Signed photo URLs expire
// after five minutes; the shorter view TTL also applies to occurrence details.
const cacheTtl = 30_000;
let contextFetchedAt = 0,
  contextPending = null,
  viewGeneration = 0,
  adminUserQuery = "";
const viewCache = new Map();
const contextIsFresh = () =>
  Boolean(me && Date.now() - contextFetchedAt < cacheTtl);
function invalidateViews({ context = false } = {}) {
  viewGeneration++;
  viewCache.clear();
  ++loadVersion;
  controller?.abort();
  contextPending?.controller.abort();
  contextPending = null;
  if (context) contextFetchedAt = 0;
}
onMutation((path) =>
  invalidateViews({ context: /^\/(me|admin)(\/|$)/.test(path) }),
);
function ensureContext() {
  if (contextIsFresh()) return Promise.resolve();
  if (contextPending) return contextPending.promise;
  const pending = {
    controller: new AbortController(),
    generation: viewGeneration,
    auth: authGeneration,
    promise: null,
  };
  contextPending = pending;
  pending.promise = api("/bootstrap", { signal: pending.controller.signal })
    .then((result) => {
      if (
        pending.auth !== authGeneration ||
        pending.generation !== viewGeneration
      )
        throw new StaleRequest();
      if (
        !result?.profile ||
        !Array.isArray(result.catalog?.sectors) ||
        !Array.isArray(result.catalog?.categories)
      )
        throw new Error("Não foi possível carregar os dados da conta.");
      me = result.profile;
      catalog = result.catalog;
      contextFetchedAt = Date.now();
    })
    .finally(() => {
      if (contextPending === pending) contextPending = null;
    });
  return pending.promise;
}
function requestedView(path) {
  let keyParts = [session.user.id, path],
    load = null;
  if (["mapa", "acompanhar", "demandas"].includes(path)) {
    const requestedScope =
      path === "demandas" ? "assigned" : path === "acompanhar" ? scope : "all";
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value),
    );
    params.set("scope", requestedScope);
    keyParts.push(params.toString());
    load = async (signal) => ({
      items: await allPages(`/occurrences?${params}`, signal),
    });
  } else if (path.startsWith("ocorrencia/")) {
    const id = encodeURIComponent(path.split("/")[1]);
    load = async (signal) => {
      const [detail, events, contributions] = await Promise.all([
        api(`/occurrences/${id}`, { signal }),
        allPages(`/occurrences/${id}/events`, signal),
        allPages(`/occurrences/${id}/contributions`, signal),
      ]);
      return { detail, events, contributions };
    };
  } else if (path === "estatisticas") {
    const params = new URLSearchParams(dates);
    keyParts.push(params.toString());
    load = async (signal) => ({
      stats: await api(`/statistics?${params}`, { signal }),
    });
  } else if (path === "configuracao") {
    keyParts.push(configTab, adminUserQuery);
    if (configTab === "users" && (!me || me.isAdmin))
      load = async (signal) => ({
        users: await allPages(
          `/admin/users?q=${encodeURIComponent(adminUserQuery)}`,
          signal,
        ),
      });
  }
  return { key: JSON.stringify(keyParts), load };
}
function cachedView(key) {
  const cached = viewCache.get(key);
  if (!cached || Date.now() - cached.at >= cacheTtl) {
    viewCache.delete(key);
    return null;
  }
  return cached;
}
function rememberView(key, data) {
  for (const [oldKey, value] of viewCache)
    if (Date.now() - value.at >= cacheTtl) viewCache.delete(oldKey);
  if (viewCache.size >= 50) viewCache.delete(viewCache.keys().next().value);
  viewCache.set(key, { at: Date.now(), data });
}
function applyView(data) {
  if ("items" in data) items = data.items;
  if ("detail" in data) {
    detail = data.detail;
    events = data.events;
    contributions = data.contributions;
  }
  if ("stats" in data) stats = data.stats;
  if ("users" in data) users = data.users;
}
async function refresh({ userQuery, force = false, onlyIfStale = false } = {}) {
  if (!session || !configured) {
    loading = false;
    render();
    return;
  }
  if (userQuery !== undefined) adminUserQuery = userQuery;
  if (force) invalidateViews({ context: true });
  const view = requestedView(route()),
    cached = force ? null : cachedView(view.key);
  if (onlyIfStale && contextIsFresh() && (!view.load || cached)) return;
  const version = ++loadVersion,
    generation = viewGeneration,
    auth = authGeneration;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const valid = () =>
    version === loadVersion &&
    generation === viewGeneration &&
    auth === authGeneration;
  let ready = !view.load || Boolean(cached),
    failed = false;
  if (cached) applyView(cached.data);
  loadError = "";
  if (contextIsFresh() && ready) {
    loading = false;
    render();
    return;
  }
  const showReady = () => {
    if (!valid() || failed || !me || !ready) return;
    loading = false;
    loadError = "";
    if (!routeDirty && !sheet.open && !app.querySelector("[data-busy]"))
      render();
  };
  loading = !(me && ready);
  render();
  // Bootstrap is shared between navigations and has its own cancellation. Route
  // requests start independently, so cold navigation costs the slower request.
  const contextTask = ensureContext()
    .then(showReady)
    .catch((error) => {
      if (
        !valid() ||
        error.name === "AbortError" ||
        error instanceof StaleRequest
      )
        throw error;
      if (me) {
        notify(error.message, true);
        showReady();
        return;
      }
      throw error;
    });
  const viewTask = ready
    ? Promise.resolve()
    : view.load(signal).then((data) => {
        if (!valid()) throw new StaleRequest();
        rememberView(view.key, data);
        applyView(data);
        ready = true;
        showReady();
      });
  try {
    await Promise.all([contextTask, viewTask]);
  } catch (error) {
    if (
      !valid() ||
      error.name === "AbortError" ||
      error instanceof StaleRequest
    )
      return;
    failed = true;
    loading = false;
    loadError = error.message;
    render();
  }
}

function openSheet(titleText, content) {
  sheet.innerHTML = `<div class="sheet-heading"><h2 id="sheet-title">${esc(titleText)}</h2>${button(icon("close"), "close-sheet", 'aria-label="Fechar"', "icon-button")}</div>${content}`;
  if (!sheet.open) sheet.showModal();
}
function transitionSheet(status) {
  const required = ["resolvida", "encerrada"].includes(status);
  openSheet(
    statuses[status].name,
    `<form id="transition-form" data-status="${status}" data-id="${detail.id}" data-expected-status="${detail.status}" data-expected-sector="${detail.sectorId}">${textarea(required ? (status === "resolvida" ? "Providência adotada" : "Justificativa do encerramento") : "Observação (opcional)", "note", "", required ? 10 : 0)}${formError()}<button type="submit" class="primary-button wide">Confirmar ${status === "resolvida" ? "resolução" : status === "encerrada" ? "encerramento" : "alteração"}</button></form>`,
  );
}
function transferSheet() {
  openSheet(
    "Transferir ocorrência",
    `<form id="transfer-form" data-id="${detail.id}" data-expected-status="${detail.status}" data-expected-sector="${detail.sectorId}"><label class="field"><span>Setor de destino</span><select name="sectorId" required>${options(
      activeSectors().filter((s) => s.id !== detail.sectorId),
      "",
      "Selecione o setor",
    )}</select></label>${textarea("Motivo da transferência", "reason", "", 10)}${formError()}<button type="submit" class="primary-button wide">Transferir ocorrência</button></form>`,
  );
}
function editConfig(id) {
  const type = configTab,
    current = catalog[type]?.find((i) => i.id === id);
  openSheet(
    `${current ? "Editar" : "Adicionar"} ${type === "sectors" ? "setor" : "categoria"}`,
    `<form id="config-form" data-kind="${type}" data-id="${id || ""}">${field("Nome", "name", current?.name, `required minlength="3" maxlength="${type === "sectors" ? 80 : 60}"`)}${
      type === "sectors"
        ? `<label class="field"><span>Descrição</span><textarea name="description" maxlength="300">${esc(current?.description)}</textarea></label>`
        : `<label class="field"><span>Setor responsável</span><select name="sectorId" required>${options(
            catalog.sectors.filter(
              (s) => s.active || s.id === current?.sectorId,
            ),
            current?.sectorId,
            "Selecione o setor",
          )}</select></label><label class="field"><span>Ícone</span><select name="icon">${options(
            ["bulb", "drop", "tool", "accessibility", "building"].map(
              (value) => ({
                id: value,
                name: {
                  bulb: "Iluminação",
                  drop: "Água",
                  tool: "Manutenção",
                  accessibility: "Acessibilidade",
                  building: "Edificação",
                }[value],
              }),
            ),
            current?.icon || "tool",
            "Selecione",
          )}</select></label>`
    }<label class="sector-check"><input name="active" type="checkbox" ${current?.active !== false ? "checked" : ""}> ${type === "sectors" ? "Setor ativo" : "Categoria ativa"}</label>${formError()}<button type="submit" class="primary-button wide">Salvar ${type === "sectors" ? "setor" : "categoria"}</button></form>`,
  );
}
function editMemberships(id) {
  const user = users.find((u) => u.id === id);
  if (!user) return;
  openSheet(
    "Vínculos de atendimento",
    `<p>${esc(user.name)} · ${esc(user.email)}</p><form id="memberships-form" data-id="${id}">${catalog.sectors
      .filter((s) => s.active || user.sectorIds.includes(s.id))
      .map(
        (s) =>
          `<label class="sector-check"><input type="checkbox" name="sectorIds" value="${s.id}" ${user.sectorIds.includes(s.id) ? "checked" : ""}>${esc(s.name)}${s.active ? "" : " (inativo)"}</label>`,
      )
      .join(
        "",
      )}${formError()}<button type="submit" class="primary-button wide">Salvar vínculos</button></form>`,
  );
}
async function selectLocation(lat, lng) {
  if (!window.CampusGeo.inArea(lat, lng)) {
    notify("Selecione um ponto dentro da área aproximada do campus.", true);
    return;
  }
  lookup?.abort();
  lookup = new AbortController();
  const version = ++lookupVersion;
  draft.lat = lat;
  draft.lng = lng;
  draft.locationName = "Ponto selecionado no campus";
  draft.locationSource = "coordinates";
  draft.locationMetadata = null;
  const form = document.querySelector("#occurrence-location-form");
  if (!form) return;
  form.elements.latitude.value = lat.toFixed(7);
  form.elements.longitude.value = lng.toFixed(7);
  form.elements.locationName.value = draft.locationName;
  window.CampusMaps.pickerPin(lat, lng, icon);
  const state = document.querySelector("#location-state");
  state.textContent =
    "Consultando nome do local… Você pode preenchê-lo manualmente.";
  try {
    const result = await window.CampusGeocoder.reverse(lat, lng, {
      signal: lookup.signal,
    });
    if (version !== lookupVersion || !form.isConnected) return;
    if (result?.label) {
      draft.locationName = result.label.slice(0, 160);
      draft.locationSource = result.source || "photon";
      draft.locationMetadata = {
        provider: result.provider,
        osmType: result.osmType,
        osmId: result.osmId,
        fetchedAt: result.fetchedAt,
      };
      form.elements.locationName.value = draft.locationName;
      state.textContent =
        "Nome sugerido pelo mapa. Confira e corrija se necessário.";
    } else
      state.textContent =
        "Sem nome neste ponto. Preencha um nome ou use as coordenadas.";
  } catch (error) {
    if (
      version !== lookupVersion ||
      error.name === "AbortError" ||
      !state.isConnected
    )
      return;
    state.textContent =
      "Não foi possível consultar o nome. O ponto continua selecionado; preencha o nome manualmente.";
  }
}
function syncDraft(form) {
  for (const name of ["categoryId", "description", "reference", "locationName"])
    if (form.elements[name]) draft[name] = form.elements[name].value;
  if (form.elements.latitude)
    draft.lat =
      form.elements.latitude.value === ""
        ? null
        : Number(form.elements.latitude.value);
  if (form.elements.longitude)
    draft.lng =
      form.elements.longitude.value === ""
        ? null
        : Number(form.elements.longitude.value);
}
function clearDraft() {
  lookup?.abort();
  lookupVersion++;
  if (draft.photoPreview) URL.revokeObjectURL(draft.photoPreview);
  draft = freshDraft();
}
function cleanPhoto() {
  if (draft.photoPreview) URL.revokeObjectURL(draft.photoPreview);
  draft.photo = null;
  draft.photoPreview = null;
  draft.photoPath = null;
}
async function publish(form) {
  syncDraft(form);
  if (!window.CampusGeo.inArea(draft.lat, draft.lng))
    throw new Error("Selecione um ponto válido na área aproximada do campus.");
  const owner = session.user.id,
    currentDraft = draft;
  lookup?.abort();
  lookupVersion++;
  if (currentDraft.photo && !currentDraft.photoPath) {
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[currentDraft.photo.type];
    if (!ext || currentDraft.photo.size > 2 * 1024 * 1024)
      throw new Error("Escolha uma foto JPG, PNG ou WebP de até 2 MB.");
    const path = `${owner}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("occurrence-photos")
      .upload(path, currentDraft.photo, {
        contentType: currentDraft.photo.type,
        upsert: false,
      });
    if (error)
      throw new Error(`Não foi possível enviar a foto. ${error.message}`);
    currentDraft.photoPath = path;
  }
  if (session?.user.id !== owner || draft !== currentDraft)
    throw new StaleRequest();
  const payload = {
    requestId: currentDraft.requestId,
    categoryId: currentDraft.categoryId,
    description: currentDraft.description,
    locationName: currentDraft.locationName,
    reference: currentDraft.reference,
    latitude: currentDraft.lat,
    longitude: currentDraft.lng,
    locationSource: currentDraft.locationSource,
    locationMetadata: currentDraft.locationMetadata,
    photoPath: currentDraft.photoPath,
  };
  // A UUID remains stable while retrying the same form, including a response lost after persistence.
  const fingerprint = JSON.stringify({ ...payload, requestId: undefined });
  if (
    currentDraft.lastFingerprint &&
    currentDraft.lastFingerprint !== fingerprint
  )
    payload.requestId = currentDraft.requestId = crypto.randomUUID();
  currentDraft.lastFingerprint = fingerprint;
  let result;
  try {
    result = await api("/occurrences", { method: "POST", body: payload });
  } catch (error) {
    if (
      currentDraft.photoPath &&
      session?.user.id === owner &&
      [400, 401, 403, 404, 413, 422].includes(error.status)
    ) {
      const { error: cleanupError } = await supabase.storage
        .from("occurrence-photos")
        .remove([currentDraft.photoPath]);
      if (!cleanupError) {
        currentDraft.photoPath = null;
        currentDraft.lastFingerprint = null;
      }
    }
    throw error;
  }
  if (session?.user.id !== owner || draft !== currentDraft)
    throw new StaleRequest();
  clearDraft();
  notify("Ocorrência registrada.");
  go(`ocorrencia/${result.id}`);
}
function friendlyAuthError(error) {
  if (/invalid login credentials/i.test(error.message))
    return "E-mail ou senha incorretos.";
  if (/already registered/i.test(error.message))
    return "Já existe uma conta com este e-mail.";
  if (/email not confirmed/i.test(error.message))
    return "Confirme seu e-mail antes de entrar.";
  if (/rate limit/i.test(error.message))
    return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  return error.message || "Não foi possível entrar. Tente novamente.";
}
async function authenticate(form, values) {
  const signup = authMode === "signup";
  const { data, error } = signup
    ? await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { name: values.name } },
      })
    : await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
  if (error) throw new Error(friendlyAuthError(error));
  if (!data.session) {
    const node = form.querySelector(".form-error");
    node.textContent = signup
      ? "Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar."
      : "Sua sessão ainda não foi iniciada. Tente entrar novamente.";
    form.elements.password.value = "";
    return;
  }
  setSession(data.session);
  go("mapa");
}
async function updateAccount(form, values) {
  const owner = session.user.id;
  const result = await api("/me", {
    method: "PATCH",
    body: { name: values.name },
  });
  if (session?.user.id !== owner) throw new StaleRequest();
  me.name = result.name || values.name;
  const success = form.querySelector(".form-success");
  success.textContent = "Nome salvo.";
  if (values.email !== session.user.email) {
    const { data, error } = await supabase.auth.updateUser({
      email: values.email,
    });
    if (session?.user.id !== owner) throw new StaleRequest();
    if (error) {
      throw new Error(
        `Nome salvo. Não foi possível atualizar o e-mail: ${friendlyAuthError(error)}`,
      );
    }
    success.textContent =
      data.user.email === values.email
        ? "Nome e e-mail salvos."
        : "Nome salvo. Confirme a alteração pelos links enviados ao e-mail; até lá, use o e-mail atual para entrar.";
    if (data.user.email === values.email) session.user.email = values.email;
  }
  document.querySelector(".account-summary h2").textContent = me.name;
  document.querySelector(".account-summary p").textContent = session.user.email;
}
async function mutate(
  form,
  path,
  body,
  method = "POST",
  message = "Alteração salva.",
) {
  const currentRoute = route(),
    owner = session.user.id;
  await api(path, { method, body });
  if (session?.user.id !== owner) throw new StaleRequest();
  if (sheet.contains(form) && sheet.open) sheet.close();
  notify(message);
  if (route() === currentRoute) await refresh();
}
async function submit(form) {
  if (form.dataset.busy) return;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData);
  if (
    form.id === "occurrence-location-form" ||
    form.id === "occurrence-problem-form"
  ) {
    syncDraft(form);
    if (
      form.id === "occurrence-location-form" &&
      !window.CampusGeo.inArea(draft.lat, draft.lng)
    ) {
      form.querySelector(".form-error").textContent =
        "Selecione um ponto válido na área aproximada do campus.";
      return;
    }
    if (!draft.locationName.trim())
      draft.locationName = "Ponto selecionado no campus";
    go(form.id === "occurrence-location-form" ? "novo/2" : "novo/3");
    return;
  }
  if (form.id === "search-form") {
    filters = {
      q: values.q,
      categoryId: values.categoryId,
      sectorId: values.sectorId,
      status: values.status,
    };
    await refresh();
    return;
  }
  if (form.id === "statistics-form") {
    if (values.from > values.to) {
      form.querySelector(".form-error").textContent =
        "A data inicial precisa ser anterior ou igual à data final.";
      return;
    }
    dates = { from: values.from, to: values.to };
    await refresh();
    return;
  }
  if (form.id === "users-search") {
    await refresh({ userQuery: values.q });
    return;
  }
  form.dataset.busy = "true";
  const disabled = [
    ...form.querySelectorAll("button,input,select,textarea"),
  ].map((node) => [node, node.disabled]);
  disabled.forEach(([node]) => {
    node.disabled = true;
  });
  const errors = form.querySelector(".form-error");
  if (errors) errors.textContent = "";
  const authVersion = authGeneration;
  try {
    if (form.id === "auth-form") await authenticate(form, values);
    else if (form.id === "occurrence-form") await publish(form);
    else if (form.id === "account-form") await updateAccount(form, values);
    else if (form.id === "contribution-form") {
      if (form.dataset.lastText && form.dataset.lastText !== values.text)
        form.dataset.requestId = crypto.randomUUID();
      form.dataset.lastText = values.text;
      await mutate(
        form,
        `/occurrences/${form.dataset.id}/contributions`,
        { requestId: form.dataset.requestId, text: values.text },
        "POST",
        "Informação acrescentada.",
      );
    } else if (form.id === "transition-form")
      await mutate(form, `/occurrences/${form.dataset.id}/transitions`, {
        status: form.dataset.status,
        expectedStatus: form.dataset.expectedStatus,
        expectedSectorId: form.dataset.expectedSector,
        note: values.note,
      });
    else if (form.id === "transfer-form")
      await mutate(
        form,
        `/occurrences/${form.dataset.id}/transfers`,
        {
          sectorId: values.sectorId,
          expectedStatus: form.dataset.expectedStatus,
          expectedSectorId: form.dataset.expectedSector,
          reason: values.reason,
        },
        "POST",
        "Ocorrência transferida.",
      );
    else if (form.id === "memberships-form")
      await mutate(
        form,
        `/admin/users/${form.dataset.id}/sectors`,
        { sectorIds: formData.getAll("sectorIds") },
        "PUT",
        "Vínculos salvos.",
      );
    else if (form.id === "config-form") {
      const body = { name: values.name, active: values.active === "on" };
      if (form.dataset.kind === "sectors")
        body.description = values.description;
      else {
        body.icon = values.icon;
        body.sectorId = values.sectorId;
      }
      await mutate(
        form,
        `/admin/${form.dataset.kind}${form.dataset.id ? `/${form.dataset.id}` : ""}`,
        body,
        form.dataset.id ? "PATCH" : "POST",
      );
    }
  } catch (error) {
    if (error instanceof StaleRequest || authVersion !== authGeneration) return;
    if (errors?.isConnected) {
      errors.textContent = error.message;
      if (
        error.status === 409 &&
        ["transition-form", "transfer-form"].includes(form.id)
      ) {
        const reload = document.createElement("button");
        reload.type = "button";
        reload.className = "text-button";
        reload.dataset.action = "reload-detail";
        reload.textContent =
          "Recarregar ocorrência para revisar o estado atual";
        errors.append(document.createElement("br"), reload);
      }
    } else notify(error.message, true);
  } finally {
    delete form.dataset.busy;
    disabled.forEach(([node, state]) => {
      node.disabled = state;
    });
  }
}
let routeDirty = false;
document.addEventListener("submit", (event) => {
  if (event.target instanceof HTMLFormElement) {
    event.preventDefault();
    void submit(event.target);
  }
});
document.addEventListener("input", (event) => {
  const form = event.target.closest("form");
  if (
    [
      "occurrence-form",
      "occurrence-location-form",
      "occurrence-problem-form",
      "account-form",
      "auth-form",
    ].includes(form?.id)
  )
    routeDirty = true;
  if (
    [
      "occurrence-form",
      "occurrence-location-form",
      "occurrence-problem-form",
    ].includes(form?.id)
  ) {
    syncDraft(form);
    if (event.target.name === "locationName") {
      lookup?.abort();
      lookupVersion++;
      draft.locationSource = "manual";
      draft.locationMetadata = null;
    }
    if (["latitude", "longitude"].includes(event.target.name)) {
      lookup?.abort();
      lookupVersion++;
      draft.locationSource = "coordinates";
      draft.locationMetadata = null;
      if (window.CampusGeo.inArea(draft.lat, draft.lng))
        window.CampusMaps.pickerPin(draft.lat, draft.lng, icon);
    }
    if (event.target.name === "categoryId")
      document.querySelector("#routing-note").textContent =
        `Encaminhamento inicial: ${sector(category(draft.categoryId).sectorId).name}`;
  }
});
document.addEventListener("change", (event) => {
  if (
    event.target.name !== "photo" ||
    !event.target.closest("#occurrence-problem-form")
  )
    return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  ) {
    event.target.value = "";
    notify("Escolha uma foto JPG, PNG ou WebP de até 2 MB.", true);
    return;
  }
  cleanPhoto();
  draft.photo = file;
  draft.photoPreview = URL.createObjectURL(file);
  document.querySelector(".draft-photo").hidden = false;
  document.querySelector("#photo-name").textContent = file.name;
  document.querySelector("#photo-preview").src = draft.photoPreview;
});
document.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control || control.disabled) return;
  const action = control.dataset.action;
  if (action === "go") {
    routeDirty = false;
    go(control.dataset.target);
  } else if (action === "refresh") await refresh({ force: true });
  else if (action === "close-sheet") sheet.close();
  else if (action === "auth-mode") {
    authMode = authMode === "signin" ? "signup" : "signin";
    routeDirty = false;
    render();
  } else if (action === "logout") {
    control.disabled = true;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      control.disabled = false;
      notify(friendlyAuthError(error), true);
      return;
    }
    setSession(null);
  } else if (action === "new") {
    clearDraft();
    routeDirty = false;
    go("novo/1");
  } else if (action === "detail") {
    detailTab = "details";
    routeDirty = false;
    go(`ocorrencia/${control.dataset.id}`);
  } else if (action === "toggle-map") {
    mapList = !mapList;
    render();
  } else if (action === "map-style")
    window.CampusMaps.setStyle(control.dataset.value);
  else if (["zoom-in", "zoom-out", "center-map"].includes(action))
    window.CampusMaps.control(action);
  else if (action === "clear-filters") {
    filters = { q: "", categoryId: "", sectorId: "", status: "" };
    await refresh();
  } else if (action === "scope") {
    scope = control.dataset.value;
    await refresh();
  } else if (action === "detail-tab") {
    detailTab = control.dataset.value;
    await refresh();
  } else if (action === "config-tab") {
    configTab = control.dataset.value;
    await refresh();
  } else if (action === "retry-location") {
    if (draft.lat !== null && draft.lng !== null)
      await selectLocation(draft.lat, draft.lng);
    else notify("Selecione um ponto primeiro.", true);
  } else if (action === "remove-photo") {
    cleanPhoto();
    document.querySelector(".draft-photo").hidden = true;
    document.querySelector("[name=photo]").value = "";
  } else if (action === "contribute")
    openSheet(
      "Acrescentar informação",
      `<p>Compartilhe um detalhe que ajude a entender ou localizar o problema.</p><form id="contribution-form" data-id="${detail.id}" data-request-id="${crypto.randomUUID()}">${textarea("Sua contribuição", "text", "", 5)}${formError()}<button type="submit" class="primary-button wide">Publicar informação</button></form>`,
    );
  else if (action === "transition") transitionSheet(control.dataset.status);
  else if (action === "transfer") transferSheet();
  else if (action === "edit-config") editConfig(control.dataset.id);
  else if (action === "edit-memberships") editMemberships(control.dataset.id);
  else if (action === "reload-detail") {
    sheet.close();
    await refresh();
  } else if (action === "confirm") {
    if (!detail || detail.authorId === me.id || detail.hasConfirmed) return;
    control.disabled = true;
    const path = route(),
      owner = session.user.id;
    try {
      await api(`/occurrences/${detail.id}/confirmations`, {
        method: "POST",
        body: {},
      });
      if (session?.user.id === owner && route() === path) {
        notify("Sua confirmação foi registrada.");
        await refresh();
      }
    } catch (error) {
      if (!(error instanceof StaleRequest)) {
        control.disabled = false;
        notify(error.message, true);
      }
    }
  }
});
function setSession(next) {
  const changed = (session?.user.id || null) !== (next?.user.id || null);
  session = next;
  if (!changed) return;
  authGeneration++;
  invalidateRequests();
  invalidateViews({ context: true });
  adminUserQuery = "";
  ++loadVersion;
  controller?.abort();
  lookup?.abort();
  lookupVersion++;
  me = null;
  catalog = { sectors: [], categories: [] };
  items = [];
  detail = null;
  events = [];
  contributions = [];
  users = [];
  stats = null;
  if (sheet.open) sheet.close();
  clearDraft();
  routeDirty = false;
  filters = { q: "", categoryId: "", sectorId: "", status: "" };
  scope = "authored";
  loadError = "";
  selected = null;
  if (next) {
    void refresh();
  } else {
    loading = false;
    render();
  }
}
window.addEventListener("hashchange", () => {
  if (sheet.open) sheet.close();
  lookup?.abort();
  lookupVersion++;
  routeDirty = false;
  void refresh();
});
window.matchMedia("(max-width:700px)").addEventListener("change", () => {
  if (
    !session ||
    loading ||
    sheet.open ||
    !["mapa", "acompanhar", "demandas"].includes(route())
  )
    return;
  const form = document.querySelector("#search-form");
  if (form) {
    const values = Object.fromEntries(new FormData(form));
    filters = {
      q: values.q,
      categoryId: values.categoryId,
      sectorId: values.sectorId,
      status: values.status,
    };
  }
  render();
});
window.addEventListener("focus", () => {
  if (
    session &&
    !loading &&
    !sheet.open &&
    !routeDirty &&
    !document.querySelector("[data-busy]")
  )
    void refresh({ onlyIfStale: true });
});
async function start() {
  if (!configured) {
    loading = false;
    render();
    return;
  }
  supabase.auth.onAuthStateChange((_event, next) => {
    setTimeout(() => setSession(next), 0);
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) notify(friendlyAuthError(error), true);
  if (data.session) setSession(data.session);
  else {
    loading = false;
    render();
  }
}
void start();
