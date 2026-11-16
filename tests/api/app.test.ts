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
