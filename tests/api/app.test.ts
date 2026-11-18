import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createApp, periodBounds } from "../../server/app";

const id = "123e4567-e89b-42d3-a456-426614174000";
function fixture(result: unknown = {}) {
  const rpc = vi.fn(async () => ({ data: result, error: null }));
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id } }, error: null })),
    },
    rpc,
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://signed.example/photo" },
          error: null,
        }),
      }),
    },
  };
  const app = createApp({ clientFactory: () => client as never });
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { app, client, rpc, request };
}

describe("API boundary", () => {
  it("exposes health and refuses missing or invalid sessions for business data", async () => {
    const { app, client } = fixture();
    expect((await app.request("/api/health")).status).toBe(200);
    expect((await app.request("/api/me")).status).toBe(401);
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);
    expect(
      (
        await app.request("/api/me", {
          headers: { Authorization: "Bearer bad" },
        })
      ).status,
    ).toBe(401);
  });
  it.each([
    [401, 401],
    [403, 401],
    [0, 503],
    [429, 503],
    [500, 503],
  ])("maps auth provider status %i to HTTP %i", async (status, expected) => {
    const { client, request } = fixture();
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status },
    } as never);
    expect((await request("/me")).status).toBe(expected);
  });
  it.each([
    ["sectors", "patch_sector"],
    ["categories", "patch_category"],
  ])(
    "sends only supplied fields when editing %s",
    async (resource, procedure) => {
      const { client, rpc, request } = fixture();
      Object.assign(client, {
        from(table: string) {
          expect(table).toBe("admin_roles");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { user_id: id },
                  error: null,
                }),
              }),
            }),
          };
        },
      });
      const path = `/admin/${resource}/${id}`;
      expect((await request(path, "PATCH", {})).status).toBe(400);
      expect((await request(path, "PATCH", { name: "Novo nome" })).status).toBe(
        200,
      );
      expect(rpc).toHaveBeenCalledExactlyOnceWith(procedure, {
        p_id: id,
        p_name: "Novo nome",
      });
    },
  );
  it("rejects unsafe create data and caller-controlled authority", async () => {
    const { request, rpc } = fixture();
    const response = await request("/occurrences", "POST", {
      requestId: id,
      categoryId: id,
      description: "Valid description",
      locationName: "Campus",
      latitude: -20.76,
      longitude: -42.86,
      authorId: id,
    });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates UUID, pagination, scope and malformed JSON", async () => {
    const { request, app } = fixture();
    for (const path of [
      "/occurrences/nope",
      "/occurrences?limit=101",
      "/occurrences?scope=admin",
      "/occurrences?cursor=bad",
    ])
      expect((await request(path)).status).toBe(400);
    expect(
      (
        await app.request("/api/me", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer token",
            "Content-Type": "application/json",
          },
          body: "{",
        })
      ).status,
    ).toBe(400);
  });
  it("returns proper unknown route and unsupported method without cache", async () => {
    const { request } = fixture();
    expect((await request("/unknown")).status).toBe(404);
    const response = await request("/me", "DELETE");
    expect(response.status).toBe(405);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("uses São Paulo inclusive days as a half-open interval and refuses invalid dates", () => {
    expect(periodBounds("2026-11-01", "2026-11-15")).toEqual({
      from: "2026-11-01T03:00:00.000Z",
      to: "2026-11-16T03:00:00.000Z",
    });
    expect(() => periodBounds("2026-02-30", "2026-03-01")).toThrow();
    expect(() => periodBounds("2026-11-15", "2026-11-01")).toThrow();
  });
});

describe("authenticated mutations", () => {
  it("preserves the persisted UUID and display number from create", async () => {
    const { request } = fixture({
      id,
      number: 42,
      author_id: id,
      location_name: "Biblioteca",
    });
    const response = await request("/occurrences", "POST", {
      requestId: id,
      categoryId: id,
      description: "Lâmpada sem funcionar",
      locationName: "Biblioteca",
      latitude: -20.76,
      longitude: -42.86,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id,
      number: 42,
      authorId: id,
      locationName: "Biblioteca",
    });
  });
  it("requires explanation for final transitions and valid campus coordinates", async () => {
    const { request } = fixture();
    expect(
      (
        await request(`/occurrences/${id}/transitions`, "POST", {
          status: "resolvida",
          expectedStatus: "andamento",
          expectedSectorId: id,
          note: "done",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/occurrences", "POST", {
          requestId: id,
          categoryId: id,
          description: "Local fora do campus",
          latitude: 0,
          longitude: 0,
        })
      ).status,
    ).toBe(400);
  });
  it("rejects missing idempotency keys and returns idempotent confirmation success", async () => {
    const { request } = fixture(false);
    expect(
      (
        await request(`/occurrences/${id}/contributions`, "POST", {
          text: "Mais informações",
        })
      ).status,
    ).toBe(400);
    const response = await request(`/occurrences/${id}/confirmations`, "POST");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      confirmedByMe: true,
      hasConfirmed: true,
      inserted: false,
    });
  });
  it.each([
    ["42501", 403],
    ["P0002", 404],
    ["23505", 409],
    ["40001", 409],
    ["22023", 400],
    ["23503", 409],
    ["XX000", 500],
  ])("maps database error %s without leaking SQL", async (code, expected) => {
    const { request, rpc } = fixture();
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code, message: "SECRET SQL DETAILS" },
    } as never);
    const response = await request(`/occurrences/${id}/confirmations`, "POST");
    expect(response.status).toBe(expected);
    expect(await response.text()).not.toContain("SECRET");
  });
  it("rejects oversized geocoder metadata", async () => {
    const { request } = fixture();
    expect(
      (
        await request("/occurrences", "POST", {
          requestId: id,
          categoryId: id,
          description: "Lâmpada sem funcionar",
          latitude: -20.76,
          longitude: -42.86,
          locationMetadata: { bad: "x".repeat(5000) },
        })
      ).status,
    ).toBe(400);
  });
});
it("rejects unrecognized location origin before persistence", async () => {
  const { request, rpc } = fixture();
  expect(
    (
      await request("/occurrences", "POST", {
        requestId: id,
        categoryId: id,
        description: "Lâmpada sem funcionar",
        latitude: -20.76,
        longitude: -42.86,
        locationSource: "trusted-admin",
      })
    ).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
describe("PostgREST list query contract", () => {
  async function query(path: string) {
    const urls: URL[] = [];
    const db = createClient("https://supabase.example", "publishable", {
      global: {
        fetch: async (input) => {
          const url = new URL(
            input instanceof Request ? input.url : String(input),
          );
          urls.push(url);
          const data = url.pathname.endsWith("/auth/v1/user")
            ? { id, email: "me@example.test" }
            : url.pathname.endsWith("/categories")
              ? [{ id }]
              : [];
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const app = createApp({ clientFactory: () => db });
    const response = await app.request(`/api/occurrences${path}`, {
      headers: { Authorization: "Bearer token" },
    });
    return {
      response,
      urls,
      url: urls.find((url) => url.pathname.endsWith("/occurrences")),
    };
  }
  it("expands the active filter to exactly the three open statuses", async () => {
    const { response, url } = await query("?status=ativas");
    expect(response.status).toBe(200);
    expect(url?.searchParams.get("status")).toBe(
      "in.(registrada,analise,andamento)",
    );
  });
  it("searches description, place, reference and matching categories without changing filter grammar", async () => {
    const { response, url } = await query("?q=" + encodeURIComponent('a,b"%_'));
    expect(response.status).toBe(200);
    const filter = url!.searchParams.get("or")!;
    expect(filter).toContain("description.ilike.");
    expect(filter).toContain("location_name.ilike.");
    expect(filter).toContain("reference.ilike.");
    expect(filter).toContain(`category_id.in.(${id})`);
    expect(filter).toContain('\\"');
    expect(filter).toContain("\\\\%");
    expect(filter).toContain("\\\\_");
  });
  it("combines a display-number search and pagination as independent filters", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ id, createdAt: "2026-11-15T00:00:00Z" }),
    ).toString("base64url");
    const { response, url } = await query("?q=42&cursor=" + cursor);
    expect(response.status).toBe(200);
    const filters = url!.searchParams.getAll("or");
    expect(filters.some((value) => value.includes("number.eq.42"))).toBe(true);
    expect(
      filters.some((value) =>
        value.includes("created_at.lt.2026-11-15T00:00:00Z"),
      ),
    ).toBe(true);
  });
});

it("accepts canonical PostgreSQL UUIDs from the initial catalog", async () => {
  const { request } = fixture({ id });
  const response = await request("/occurrences", "POST", {
    requestId: id,
    categoryId: "b0000000-0000-0000-0000-000000000001",
    description: "Luminária apagada no campus.",
    latitude: -20.76,
    longitude: -42.86,
  });
  expect(response.status).toBe(201);
});

describe("bootstrap and occurrence round trips", () => {
  function transport(read: (url: URL) => unknown | Promise<unknown>) {
    const urls: URL[] = [];
    const db = createClient("https://supabase.example", "publishable", {
      global: {
        fetch: async (input) => {
          const url = new URL(
            input instanceof Request ? input.url : String(input),
          );
          urls.push(url);
          const data = url.pathname.endsWith("/auth/v1/user")
            ? { id, email: "me@example.test" }
            : await read(url);
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const app = createApp({ clientFactory: () => db });
    return {
      urls,
      app,
      request: (path: string) =>
        app.request("/api" + path, {
          headers: { Authorization: "Bearer token" },
        }),
    };
  }
  it("bootstraps the same profile and catalog with one auth check and five concurrent reads", async () => {
    const waiting: Array<() => void> = [];
    const { request, urls } = transport(async (url) => {
      await new Promise<void>((resolve) => waiting.push(resolve));
      switch (url.pathname.split("/").at(-1)) {
        case "profiles":
          return { id, name: "Member" };
        case "admin_roles":
          return { user_id: id };
        case "sector_memberships":
          return [{ sector_id: id }];
        case "sectors":
          return [{ id, name: "Campus", active: true }];
        case "categories":
          return [{ id, name: "Luz", sector_id: id, active: true }];
      }
    });
    const pending = request("/bootstrap");
    try {
      await vi.waitFor(() => expect(waiting).toHaveLength(5), { timeout: 500 });
    } finally {
      waiting.forEach((resolve) => resolve());
    }
    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      profile: {
        id,
        name: "Member",
        email: "me@example.test",
        isAdmin: true,
        sectorIds: [id],
      },
      catalog: {
        sectors: [{ id, name: "Campus", active: true }],
        categories: [{ id, name: "Luz", sectorId: id, active: true }],
      },
    });
    expect(
      urls.filter((url) => url.pathname.endsWith("/auth/v1/user")),
    ).toHaveLength(1);
  });
  it("does not read bootstrap data without a verified session", async () => {
    const { app, urls } = transport(() => {
      throw new Error("must not read");
    });
    expect((await app.request("/api/bootstrap")).status).toBe(401);
    expect(urls).toHaveLength(0);
  });
  it.each(["/occurrences", `/occurrences/${id}`])(
    "reads own confirmation inside %s without another database request",
    async (path) => {
      const row = {
        id,
        number: 42,
        description: "Campus lamp",
        author_id: id,
        photo_path: null,
        confirmations: [{ count: 3 }],
        contributions: [{ count: 1 }],
        occurrence_events: [{ count: 2 }],
        my_confirmation: [{ user_id: id }],
      };
      const { request, urls } = transport((url) =>
        url.pathname.endsWith("/occurrences")
          ? path === "/occurrences"
            ? [
                row,
                {
                  ...row,
                  id: "b0000000-0000-0000-0000-000000000001",
                  my_confirmation: [],
                },
              ]
            : row
          : [],
      );
      const response = await request(path);
      expect(response.status).toBe(200);
      const result = await response.json();
      const items = path === "/occurrences" ? result.items : [result];
      expect(items[0]).toMatchObject({
        confirmedByMe: true,
        hasConfirmed: true,
        confirmationCount: 3,
      });
      expect(items[0]).not.toHaveProperty("myConfirmation");
      if (path === "/occurrences")
        expect(items[1]).toMatchObject({
          confirmedByMe: false,
          hasConfirmed: false,
          confirmationCount: 3,
        });
      const reads = urls.filter((url) => url.pathname.includes("/rest/v1/"));
      expect(reads).toHaveLength(1);
      expect(reads[0].searchParams.get("my_confirmation.user_id")).toBe(
        "eq." + id,
      );
      const select = reads[0].searchParams.get("select")!;
      expect(select).toContain("my_confirmation:confirmations(user_id)");
      expect(select).toContain("confirmations(count)");
      expect(select).not.toContain("!inner");
      expect(select).not.toContain("*");
      expect(select).not.toContain("request_payload");
      expect(select).not.toContain("geocoder_metadata");
      expect(select).toContain("photo_path");
    },
  );
  it("keeps the inner join only for the confirmed scope", async () => {
    const { request, urls } = transport(() => []);
    expect((await request("/occurrences?scope=confirmed")).status).toBe(200);
    const url = urls.find((url) => url.pathname.endsWith("/occurrences"))!;
    expect(url.searchParams.get("select")).toContain(
      "own_confirmation:confirmations!inner(user_id)",
    );
    expect(url.searchParams.get("own_confirmation.user_id")).toBe("eq." + id);
    expect(url.searchParams.get("my_confirmation.user_id")).toBe("eq." + id);
  });
});
