import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { createApp } from "../../server/app";
try {
  process.loadEnvFile(".env.local");
} catch {}
const url = process.env.SUPABASE_URL || "",
  key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
let client: SupabaseClient,
  token: string,
  witnessToken: string,
  occurrenceId: string;
const fixtureIds: string[] = [];
const database = new Client({
  connectionString:
    process.env.CAMPUS_TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
});
let connected = false;
const app = createApp({ supabaseUrl: url, supabaseKey: key });
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  accessToken = token,
) =>
  app.request("/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe("Local Auth + API + PostgreSQL integration", () => {
  beforeAll(async () => {
    const dbUrl = new URL(
      process.env.CAMPUS_TEST_DATABASE_URL ||
        "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
    );
    if (
      !/^http:\/\/(127\.0\.0\.1|localhost):/.test(url) ||
      !key ||
      !["127.0.0.1", "localhost"].includes(dbUrl.hostname)
    )
      throw Error("Use apenas o Supabase local para testes integrados.");
    await database.connect();
    connected = true;
    client = createClient(url, key, { auth: { persistSession: false } });
    for (const name of ["Integration Author", "Integration Witness"]) {
      const sdk = createClient(url, key, { auth: { persistSession: false } });
      const result = await sdk.auth.signUp({
        email: `integration-${randomUUID()}@example.com`,
        password: "CampusTests123!",
        options: { data: { name, role: "admin" } },
      });
      if (result.data.user) fixtureIds.push(result.data.user.id);
      expect(result.error).toBeNull();
      expect(result.data.session).toBeTruthy();
      if (!token) {
        token = result.data.session!.access_token;
        client = sdk;
      } else witnessToken = result.data.session!.access_token;
    }
  });
  afterAll(async () => {
    if (!connected) return;
    try {
      await database.query("BEGIN");
      const own =
        "SELECT id FROM public.occurrences WHERE author_id = ANY($1::uuid[])";
      await database.query(
        `DELETE FROM public.occurrence_events WHERE actor_id = ANY($1::uuid[]) OR occurrence_id IN (${own})`,
        [fixtureIds],
      );
      await database.query(
        `DELETE FROM public.confirmations WHERE user_id = ANY($1::uuid[]) OR occurrence_id IN (${own})`,
        [fixtureIds],
      );
      await database.query(
        `DELETE FROM public.contributions WHERE author_id = ANY($1::uuid[]) OR occurrence_id IN (${own})`,
        [fixtureIds],
      );
      await database.query(
        "DELETE FROM public.occurrences WHERE author_id = ANY($1::uuid[])",
        [fixtureIds],
      );
      await database.query(
        "DELETE FROM auth.users WHERE id = ANY($1::uuid[])",
        [fixtureIds],
      );
      await database.query("COMMIT");
      const remaining = await database.query(
        "SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])",
        [fixtureIds],
      );
      expect(Number(remaining.rows[0].count)).toBe(0);
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    } finally {
      await database.end();
    }
  });
  it("creates a member immediately and prevents metadata privilege escalation", async () => {
    const r = await request("/me");
    expect(r.status).toBe(200);
    expect((await r.json()).isAdmin).toBe(false);
    expect((await request("/admin/users")).status).toBe(403);
  });
  it("persists an idempotent illumination occurrence in the matching catalog category", async () => {
    const catalog = await (await request("/catalog")).json();
    const category = catalog.categories.find(
      (v: any) => v.active && v.name === "Iluminação",
    );
    expect(category).toBeTruthy();
    const body = {
      requestId: randomUUID(),
      categoryId: category.id,
      description: "Luminária apagada perto da biblioteca.",
      latitude: -20.761367,
      longitude: -42.8677889,
      locationName: "Biblioteca",
      locationSource: "manual",
    };
    const r = await request("/occurrences", "POST", body);
    expect(r.status).toBe(201);
    const occurrence = await r.json();
    occurrenceId = occurrence.id;
    expect(occurrence.categoryId).toBe(category.id);
    expect(
      (await (await request("/occurrences", "POST", body)).json()).id,
    ).toBe(occurrenceId);
    expect(
      (
        await request("/occurrences", "POST", {
          ...body,
          description: "Outro conteúdo reaproveitando a mesma chave.",
        })
      ).status,
    ).toBe(409);
  });
  it("rejects author self-confirmation and lets another member confirm once", async () => {
    expect(
      (await request(`/occurrences/${occurrenceId}/confirmations`, "POST", {}))
        .status,
    ).toBe(403);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `/occurrences/${occurrenceId}/confirmations`,
            "POST",
            {},
            witnessToken,
          )
        ).status,
      ).toBe(200);
    const contribution = {
      requestId: randomUUID(),
      text: "A falha também acontece durante a noite.",
    };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `/occurrences/${occurrenceId}/contributions`,
            "POST",
            contribution,
            witnessToken,
          )
        ).status,
      ).toBe(201);
    const detail = await (
      await request(
        `/occurrences/${occurrenceId}`,
        "GET",
        undefined,
        witnessToken,
      )
    ).json();
    expect(detail.confirmationCount).toBe(1);
    expect(detail.contributionCount).toBe(1);
    expect(detail.confirmedByMe).toBe(true);
    const authored = await (
      await request(`/occurrences/${occurrenceId}`)
    ).json();
    expect(authored.confirmedByMe).toBe(false);
    expect(
      (await (await request(`/occurrences/${occurrenceId}/events`)).json())
        .items.length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      (
        await client
          .from("occurrences")
          .update({ status: "resolvida" })
          .eq("id", occurrenceId)
      ).error,
    ).toBeTruthy();
  });
});
