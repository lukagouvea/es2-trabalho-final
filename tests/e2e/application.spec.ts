import { test, expect, type BrowserContext, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
});

// Browser contract tests exercise the real Supabase SDK against isolated HTTP fixtures.
// These do not replace the live Supabase/RLS suite.
const uid = "11111111-1111-4111-8111-111111111111";
const sid = "22222222-2222-4222-8222-222222222222";
const otherSid = "22222222-2222-4222-8222-222222222223";
const cid = "33333333-3333-4333-8333-333333333333";
const oid = "44444444-4444-4444-8444-444444444444";
const now = "2026-11-15T12:00:00.000Z";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJZkAAAAASUVORK5CYII=",
  "base64",
);
function jwt() {
  return [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "signature",
  ].join(".");
}
async function setup(context: BrowserContext) {
  const state = {
    user: {
      id: uid,
      email: "marina@example.org",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: "Marina Comunidade" },
      aud: "authenticated",
      role: "authenticated",
      created_at: now,
    },
    me: {
      id: uid,
      name: "Marina Comunidade",
      email: "marina@example.org",
      isAdmin: true,
      sectorIds: [sid],
    },
    sectors: [
      {
        id: sid,
        name: "Manutenção do campus",
        description: "Cuidados do campus",
        active: true,
      },
      { id: otherSid, name: "Infraestrutura", description: "", active: true },
    ],
    categories: [
      {
        id: cid,
        name: "Iluminação",
        sectorId: sid,
        icon: "bulb",
        active: true,
      },
    ],
    occurrences: [] as any[],
    events: [] as any[],
    contributions: [] as any[],
    uploads: [] as string[],
    averageResolutionHours: 7.5,
    ambiguousCreate: false,
    ambiguousContribution: false,
    createPayloads: [] as any[],
    contributionPayloads: [] as any[],
    failCreate: false,
    conflict: false,
    failEmail: false,
    delayedList: false,
    listRequests: [] as URL[],
    lastCreate: null as any,
    signupMetadata: null as any,
  };
  function occurrence(data: any = {}) {
    return {
      id: oid,
      number: 12,
      categoryId: cid,
      sectorId: sid,
      authorId: uid,
      author: { id: uid, name: state.me.name },
      description:
        "Luminária apagada na entrada da biblioteca. Falta iluminação à noite.",
      locationName: "Biblioteca Central",
      reference: "Entrada principal",
      latitude: -20.761,
      longitude: -42.87,
      status: "registrada",
      confirmationCount: 0,
      hasConfirmed: false,
      contributionCount: 0,
      eventCount: 1,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      ...data,
    };
  }
  state.occurrences.push(
    occurrence({
      authorId: "77777777-7777-4777-8777-777777777777",
      author: {
        id: "77777777-7777-4777-8777-777777777777",
        name: "João Comunidade",
      },
    }),
  );
  state.events.push({
    id: "evt1",
    type: "created",
    author: { id: uid, name: state.me.name },
    status: "registrada",
    sectorId: sid,
    text: "Ocorrência registrada",
    createdAt: now,
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    const json = (data: any, status = 200) =>
      route.fulfill({
        status,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    const fail = (message: string, status = 400) =>
      json({ error: { code: "TEST_ERROR", message } }, status);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      if (path.includes("/reverse")) return json({ features: [] });
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: png,
      });
    }
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    if (path.startsWith("/auth/v1/")) {
      if (path.endsWith("/token") || path.endsWith("/signup")) {
        if (path.endsWith("/signup")) {
          state.signupMetadata = body.data;
          state.me.name = body.data?.name || "Novo membro";
        }
        state.user.email = body.email || state.user.email;
        return json({
          access_token: jwt(),
          token_type: "bearer",
          refresh_token: "isolated-refresh",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: state.user,
        });
      }
      if (path.endsWith("/user")) {
        if (request.method() === "PUT" && state.failEmail)
          return json(
            { code: "email_exists", msg: "E-mail já utilizado" },
            422,
          );
        if (request.method() === "PUT") state.user.email = body.email;
        return json(state.user);
      }
      if (path.endsWith("/logout")) return json({});
    }
    if (path.startsWith("/storage/v1/")) {
      if (request.method() === "POST")
        state.uploads.push(
          path.replace("/storage/v1/object/occurrence-photos/", ""),
        );
      return json({ Key: path, Id: "test-object" });
    }
    if (!path.startsWith("/api/")) return route.continue();
    if (!request.headers().authorization?.startsWith("Bearer "))
      return fail("Sessão necessária", 401);
    if (path === "/api/me") {
      if (request.method() === "PATCH") state.me.name = body.name;
      return json(state.me);
    }
    if (path === "/api/catalog")
      return json({ sectors: state.sectors, categories: state.categories });
    if (path === "/api/statistics")
      return json({
        total: state.occurrences.length,
        byStatus: [{ status: state.occurrences[0].status, count: 1 }],
        byCategory: [{ categoryId: cid, count: 1 }],
        bySector: [{ sectorId: sid, count: 1 }],
        resolvedCount: 1,
        averageResolutionHours: state.averageResolutionHours,
      });
    if (path === "/api/admin/users")
      return json({
        items: [{ ...state.me, email: state.user.email }],
        nextCursor: null,
      });
    if (path.startsWith("/api/admin/users/") && path.endsWith("/sectors")) {
      state.me.sectorIds = body.sectorIds;
      return json(state.me);
    }
    if (path.startsWith("/api/admin/sectors")) {
      if (request.method() === "POST") {
        const added = { id: "55555555-5555-4555-8555-555555555555", ...body };
        state.sectors.push(added);
        return json(added);
      }
      const sector = state.sectors.find((s) => path.endsWith(s.id));
      Object.assign(sector!, body);
      return json(sector);
    }
    if (path.startsWith("/api/admin/categories")) {
      if (request.method() === "POST") {
        const added = { id: "66666666-6666-4666-8666-666666666666", ...body };
        state.categories.push(added);
        return json(added);
      }
      const category = state.categories.find((c) => path.endsWith(c.id));
      Object.assign(category!, body);
      return json(category);
    }
    if (path === "/api/occurrences" && request.method() === "POST") {
      state.lastCreate = body;
      state.createPayloads.push(body);
      const existing = state.occurrences.find(
        (o) => o.requestId === body.requestId,
      );
      if (existing)
        return existing.photoPath === body.photoPath
          ? json(existing)
          : fail("UUID repetido com conteúdo diferente", 409);
      if (state.failCreate)
        return fail(
          "Não foi possível salvar o registro. Tente novamente.",
          503,
        );
      const created = occurrence({
        ...body,
        id: "44444444-4444-4444-8444-444444444445",
        number: 13,
        photoUrl: body.photoPath ? "/test-photo.png" : undefined,
      });
      state.occurrences.push(created);
      if (state.ambiguousCreate) {
        state.ambiguousCreate = false;
        return route.abort("failed");
      }
      return json(created, 201);
    }
    if (path === "/api/occurrences") {
      state.listRequests.push(url);
      if (state.delayedList)
        await new Promise((resolve) => setTimeout(resolve, 500));
      const matching = state.occurrences.filter(
        (o) =>
          (!url.searchParams.get("categoryId") ||
            o.categoryId === url.searchParams.get("categoryId")) &&
          (!url.searchParams.get("sectorId") ||
            o.sectorId === url.searchParams.get("sectorId")) &&
          (!url.searchParams.get("status") ||
            o.status === url.searchParams.get("status")) &&
          (url.searchParams.get("scope") !== "confirmed" || o.hasConfirmed) &&
          (url.searchParams.get("scope") !== "authored" || o.authorId === uid),
      );
      // Force pagination even with the frontend's maximum page size.
      return json({
        items: url.searchParams.get("cursor")
          ? matching.slice(1)
          : matching.slice(0, 1),
        nextCursor:
          !url.searchParams.get("cursor") && matching.length > 1
            ? "page-two"
            : null,
      });
    }
    const match = path.match(/^\/api\/occurrences\/([^/]+)(?:\/(.+))?$/);
    if (match) {
      const current = state.occurrences.find((o) => o.id === match[1]);
      if (!current) return fail("Ocorrência inexistente", 404);
      if (!match[2]) return json(current);
      if (match[2] === "events")
        return json({ items: state.events, nextCursor: null });
      if (match[2] === "contributions" && request.method() === "GET")
        return json({ items: state.contributions, nextCursor: null });
      if (match[2] === "contributions") {
        state.contributionPayloads.push(body);
        const old = state.contributions.find(
          (c) => c.requestId === body.requestId,
        );
        if (old)
          return old.text === body.text
            ? json(old)
            : fail("UUID repetido com conteúdo diferente", 409);
        state.contributions.push({
          id: "contribution-1",
          author: { id: uid, name: state.me.name },
          text: body.text,
          requestId: body.requestId,
          createdAt: now,
        });
        current.contributionCount++;
        if (state.ambiguousContribution) {
          state.ambiguousContribution = false;
          return route.abort("failed");
        }
        return json(state.contributions.at(-1), 201);
      }
      if (match[2] === "confirmations") {
        if (!current.hasConfirmed) current.confirmationCount++;
        current.hasConfirmed = true;
        return json(current);
      }
      if (match[2] === "transitions" || match[2] === "transfers") {
        if (state.conflict)
          return fail(
            "Outro responsável alterou esta ocorrência. Atualize para continuar.",
            409,
          );
        if (match[2] === "transitions") current.status = body.status;
        else current.sectorId = body.sectorId;
        state.events.push({
          id: `event-${state.events.length}`,
          author: { id: uid, name: state.me.name },
          type: match[2] === "transitions" ? "transition" : "transfer",
          status: current.status,
          sectorId: current.sectorId,
          previousSectorId: body.expectedSectorId,
          text: body.note || body.reason,
          createdAt: now,
        });
        return json(current);
      }
    }
    return fail(`Rota não configurada: ${path}`, 404);
  });
  return state;
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill("marina@example.org");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaForte123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nosso campus" }),
  ).toBeVisible();
}
async function details(page: Page) {
  await page.getByRole("button", { name: "Ver lista", exact: true }).click();
  await page.getByRole("button", { name: /Luminária apagada/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ocorrência #12" }),
  ).toBeVisible();
}

test("cadastro imediato, sessão persistida, edição parcial e saída", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome completo").fill("Marina Comunidade");
  await page.getByLabel("E-mail", { exact: true }).fill("marina@example.org");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaForte123!");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Nosso campus" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/campus-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".filter-panel summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const mapBox = await page.locator("#campus-map").boundingBox();
  expect(mapBox!.y).toBeLessThan(600);
  await page.screenshot({ path: "/tmp/campus-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(state.signupMetadata).toEqual({ name: "Marina Comunidade" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nosso campus" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Conta", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Marina Atualizada");
  await page.getByLabel("E-mail", { exact: true }).fill("outro@example.org");
  state.failEmail = true;
  await page.getByRole("button", { name: "Salvar meus dados" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nome salvo. Não foi possível atualizar o e-mail",
  );
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
    "outro@example.org",
  );
  expect(state.me.name).toBe("Marina Atualizada");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
});

test("consulta paginada, filtros combinados e colaboração persistida na recarga", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  state.occurrences.push({
    ...state.occurrences[0],
    id: "44444444-4444-4444-8444-444444444446",
    number: 14,
    description: "Segunda luminária apagada na avenida.",
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "2 ocorrências encontradas" }),
  ).toBeVisible();
  expect(
    state.listRequests.some((u) => u.searchParams.get("cursor") === "page-two"),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(cid);
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("registrada");
  await page
    .getByRole("combobox", { name: "Setor", exact: true })
    .selectOption(sid);
  await page.getByLabel("Buscar local ou ocorrência").fill("Biblioteca");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect
    .poll(() => state.listRequests.at(-1)?.searchParams.get("q"))
    .toBe("Biblioteca");
  expect(state.listRequests.at(-1)?.searchParams.get("categoryId")).toBe(cid);
  await details(page);
  await page
    .getByRole("button", { name: "Também observei este problema" })
    .click();
  await expect(
    page.getByRole("button", { name: "Você já confirmou" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Acrescentar informação" }).click();
  await page
    .getByLabel("Sua contribuição")
    .fill("O problema também acontece depois das 18 horas.");
  await page.getByRole("button", { name: "Publicar informação" }).click();
  await expect(
    page.getByText("O problema também acontece depois das 18 horas."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Você já confirmou" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A história deste registro" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Acompanhar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmações", exact: true }).click();
  await expect
    .poll(() => state.listRequests.at(-1)?.searchParams.get("scope"))
    .toBe("confirmed");
});

test("registro com foto mantém formulário no erro e publica somente após persistência", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await page.getByRole("button", { name: "Registrar ocorrência" }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("-20.761");
  await page.getByLabel("Longitude", { exact: true }).fill("-42.870");
  await page
    .getByLabel("Nome do local (opcional)", { exact: true })
    .fill("Biblioteca Central");
  await page.getByLabel("Ponto de referência (opcional)").fill("Porta lateral");
  await page.getByRole("button", { name: "Continuar para o problema" }).click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(cid);
  await page
    .getByLabel("Descrição do problema")
    .fill("Vazamento de água na porta lateral da biblioteca.");
  await page
    .getByLabel("Foto (opcional)")
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Revisar ocorrência" }).click();
  await page.screenshot({
    path: "/tmp/campus-registration.png",
    fullPage: true,
  });
  state.failCreate = true;
  await page
    .getByRole("button", { name: "Publicar ocorrência", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível salvar",
  );
  await expect(
    page.getByText("Vazamento de água na porta lateral da biblioteca.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Biblioteca Central", { exact: true }),
  ).toBeVisible();
  expect(state.occurrences).toHaveLength(1);
  const originalPayload = structuredClone(state.lastCreate);
  state.failCreate = false;
  await page
    .getByRole("button", { name: "Publicar ocorrência", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ocorrência #13" }),
  ).toBeVisible();
  expect(state.lastCreate).toEqual(originalPayload);
  expect(state.uploads).toHaveLength(1);
  expect(state.lastCreate.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(state.lastCreate.photoPath).toMatch(
    new RegExp(`^${uid}/[a-f0-9-]{36}\\.png$`),
  );
  expect(state.lastCreate).not.toHaveProperty("authorId");
  expect(state.occurrences).toHaveLength(2);
});

test("fila, conflito sem perder nota, transições, transferência e resolução", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await page.getByRole("button", { name: "Demandas", exact: true }).click();
  await expect
    .poll(() => state.listRequests.at(-1)?.searchParams.get("scope"))
    .toBe("assigned");
  await page.getByRole("button", { name: /Luminária apagada/ }).click();
  await page
    .getByRole("button", { name: "Iniciar análise", exact: true })
    .click();
  await page
    .getByLabel("Observação (opcional)")
    .fill("Verificaremos a alimentação do circuito.");
  state.conflict = true;
  await page.getByRole("button", { name: "Confirmar alteração" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Outro responsável alterou",
  );
  await expect(page.getByLabel("Observação (opcional)")).toHaveValue(
    "Verificaremos a alimentação do circuito.",
  );
  state.conflict = false;
  await page.getByRole("button", { name: "Confirmar alteração" }).click();
  await page.getByRole("button", { name: "Transferir", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Setor de destino", exact: true })
    .selectOption(otherSid);
  await page
    .getByLabel("Motivo da transferência")
    .fill("A equipe de infraestrutura precisa avaliar o circuito.");
  await page
    .getByRole("button", { name: "Transferir ocorrência", exact: true })
    .click();
  await expect(
    page.locator("#app dd").filter({ hasText: /^Infraestrutura$/ }),
  ).toBeVisible();
  expect(state.occurrences[0].sectorId).toBe(otherSid);
  // A fresh membership grants attendance in the target sector, read on the next route load.
  state.me.sectorIds.push(otherSid);
  await page.reload();
  await page
    .getByRole("button", { name: "Iniciar atendimento", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar alteração" }).click();
  await page
    .getByRole("button", { name: "Registrar resolução", exact: true })
    .click();
  await page
    .getByLabel("Providência adotada")
    .fill("Luminária substituída e circuito testado.");
  await page.getByRole("button", { name: "Confirmar resolução" }).click();
  await expect(
    page.locator(".badge").filter({ hasText: /^Resolvida$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar resolução" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Luminária substituída e circuito testado."),
  ).toBeVisible();
});

test("administração de setores, categorias, vínculos e estatísticas por período", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await page.getByRole("button", { name: "Gestão", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar setor" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jardinagem");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Cuidados com jardins");
  await page.getByRole("button", { name: "Salvar setor" }).click();
  await expect(
    page.getByRole("heading", { name: "Jardinagem", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar categoria" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Arborização");
  await page
    .getByRole("combobox", { name: "Setor responsável", exact: true })
    .selectOption("55555555-5555-4555-8555-555555555555");
  await page
    .getByRole("combobox", { name: "Ícone", exact: true })
    .selectOption("building");
  await page.getByRole("button", { name: "Salvar categoria" }).click();
  await expect(
    page.getByRole("heading", { name: "Arborização", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Responsáveis", exact: true }).click();
  await page.getByRole("button", { name: "Vínculos", exact: true }).click();
  await page.getByLabel("Infraestrutura", { exact: true }).check();
  await page.getByRole("button", { name: "Salvar vínculos" }).click();
  expect(state.me.sectorIds).toContain(otherSid);
  await page.getByRole("button", { name: "Panorama", exact: true }).click();
  await expect(page.getByText("7,5 h", { exact: true })).toBeVisible();
  await page.getByLabel("Data inicial").fill("2026-11-01");
  await page.getByLabel("Data final").fill("2026-11-15");
  await page.getByRole("button", { name: "Consultar período" }).click();
  await expect(page.getByRole("heading", { name: "Por setor" })).toBeVisible();
});

test("saída ignora resposta atrasada sem expor dados da sessão anterior", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await page.getByRole("button", { name: "Conta", exact: true }).click();
  state.delayedList = true;
  await page.evaluate(() => {
    location.hash = "/mapa";
  });
  await expect(page.getByText("Carregando dados…")).toBeVisible();
  await page.getByRole("button", { name: "Conta", exact: true }).click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.waitForTimeout(600);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nosso campus" })).toHaveCount(
    0,
  );
});

test("resposta perdida após criação mantém UUID e foto para repetição exata", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await page.getByRole("button", { name: "Registrar ocorrência" }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("-20.761");
  await page.getByLabel("Longitude", { exact: true }).fill("-42.870");
  await page.getByRole("button", { name: "Continuar para o problema" }).click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(cid);
  await page
    .getByLabel("Descrição do problema")
    .fill("Luminária apagada na entrada principal do pavilhão.");
  await page
    .getByLabel("Foto (opcional)")
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Revisar ocorrência" }).click();
  state.ambiguousCreate = true;
  await page
    .getByRole("button", { name: "Publicar ocorrência", exact: true })
    .click();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  const original = structuredClone(state.lastCreate);
  expect(state.occurrences).toHaveLength(2);
  await page
    .getByRole("button", { name: "Publicar ocorrência", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ocorrência #13" }),
  ).toBeVisible();
  expect(state.createPayloads).toHaveLength(2);
  expect(state.lastCreate).toEqual(original);
  expect(state.uploads).toHaveLength(1);
  expect(state.occurrences).toHaveLength(2);
});

test("contribuição com resposta perdida mantém UUID na repetição e renova após edição", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await login(page);
  await details(page);
  await page.getByRole("button", { name: "Acrescentar informação" }).click();
  await page
    .getByLabel("Sua contribuição")
    .fill("O problema ocorre toda noite desde segunda.");
  state.ambiguousContribution = true;
  await page.getByRole("button", { name: "Publicar informação" }).click();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  const original = state.contributionPayloads[0];
  await page.getByRole("button", { name: "Publicar informação" }).click();
  await expect(
    page.getByText("O problema ocorre toda noite desde segunda.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.contributionPayloads[1]).toEqual(original);
  expect(state.contributions).toHaveLength(1);
  await page.getByRole("button", { name: "Acrescentar informação" }).click();
  await page
    .getByLabel("Sua contribuição")
    .fill("Também observei o problema no início da manhã.");
  state.ambiguousContribution = true;
  await page.getByRole("button", { name: "Publicar informação" }).click();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  const second = state.contributionPayloads[2];
  await page
    .getByLabel("Sua contribuição")
    .fill("Também observei o problema no início da manhã e ao meio-dia.");
  await page.getByRole("button", { name: "Publicar informação" }).click();
  await expect(
    page.getByText(
      "Também observei o problema no início da manhã e ao meio-dia.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.contributionPayloads[3].requestId).not.toBe(second.requestId);
});

test("erro na consulta mostra falha sem dados de demonstração", async ({
  page,
  context,
}) => {
  await setup(context);
  await login(page);
  await page.route("**/api/occurrences?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UNAVAILABLE",
          message: "Serviço temporariamente indisponível",
        },
      }),
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText(
    "Serviço temporariamente indisponível",
  );
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(
    page.getByText("Luminária apagada na entrada da biblioteca", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("autor vê indicação própria e não pode confirmar o próprio registro", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  state.occurrences[0].authorId = uid;
  state.occurrences[0].author = { id: uid, name: state.me.name };
  await login(page);
  await details(page);
  await expect(
    page.getByRole("button", {
      name: "Você registrou esta ocorrência",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Também observei este problema" }),
  ).toHaveCount(0);
  expect(state.occurrences[0].confirmationCount).toBe(0);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 390, height: 667 },
]) {
  test(`cartão selecionado inteiro acima da navegação em ${size.width}x${size.height}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(size);
    await setup(context);
    await login(page);
    const card = page.locator("#map-preview .map-preview");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const navBox = await page
      .getByRole("navigation", { name: "Navegação principal" })
      .boundingBox();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const stageBox = await page.locator(".map-stage").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(navBox!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    for (const tool of await page.locator(".map-tools button").all()) {
      const toolBox = (await tool.boundingBox())!;
      const overlaps =
        toolBox.x < box!.x + box!.width &&
        toolBox.x + toolBox.width > box!.x &&
        toolBox.y < box!.y + box!.height &&
        toolBox.y + toolBox.height > box!.y;
      expect(overlaps).toBe(false);
    }
    await page.screenshot({
      path: `/tmp/campus-map-${size.width}x${size.height}.png`,
    });
  });
}

test("contagens usam singular para um registro e uma confirmação", async ({
  page,
  context,
}) => {
  const state = await setup(context);
  state.occurrences[0].confirmationCount = 1;
  state.occurrences[0].authorId = uid;
  await login(page);
  await page.getByRole("button", { name: "Ver lista", exact: true }).click();
  await expect(page.locator(".row-location")).toContainText("1 confirmação");
  await expect(page.locator(".row-location")).not.toContainText(
    "1 confirmações",
  );
  await page.getByRole("button", { name: /Luminária apagada/ }).click();
  await expect(page.locator(".confirmation-number")).toContainText(
    "1 pessoa observou este problema",
  );
  await page.getByRole("button", { name: "Acompanhar", exact: true }).click();
  await expect(page.locator(".list-meta")).toHaveText("1 registro");
  await page.getByRole("button", { name: "Panorama", exact: true }).click();
  await expect(page.locator(".stat-total-label")).toHaveText(
    "ocorrência registrada no período",
  );
});

for (const [hours, label] of [
  [5 / 60, "5 min"],
  [0.001, "< 1 min"],
  [1, "1 h"],
  [7.5, "7,5 h"],
] as const) {
  test(`tempo médio de ${hours} horas aparece como ${label}`, async ({
    page,
    context,
  }) => {
    const state = await setup(context);
    state.averageResolutionHours = hours;
    await login(page);
    await page.getByRole("button", { name: "Panorama", exact: true }).click();
    await expect(page.locator(".stat-side b")).toHaveText(label);
  });
}
