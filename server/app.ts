import { Hono, type Context } from "hono";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type Config = {
  clientFactory?: (token: string) => SupabaseClient;
  supabaseUrl?: string;
  supabaseKey?: string;
};
type Env = {
  Variables: { db: SupabaseClient; userId: string; email: string | undefined };
};
type ApiContext = Context<Env>;
// PostgreSQL accepts canonical UUIDs without RFC version/variant bits.
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "UUID inválido.",
  );
const status = z.enum([
  "registrada",
  "analise",
  "andamento",
  "resolvida",
  "encerrada",
]);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
const occurrenceSchema = z
  .object({
    requestId: uuid,
    categoryId: uuid,
    description: text(10, 1500),
    latitude: z.number().min(-20.774).max(-20.75),
    longitude: z.number().min(-42.879).max(-42.853),
    locationName: text(0, 160).default(""),
    reference: text(0, 160).default(""),
    locationSource: z
      .enum(["coordinates", "photon", "manual"])
      .default("coordinates"),
    locationMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    photoPath: text(1, 512).nullable().optional(),
  })
  .strict();
const sectorSchema = z
  .object({
    name: text(3, 80),
    description: text(0, 300).default(""),
    active: z.boolean().default(true),
  })
  .strict();
const categorySchema = z
  .object({
    name: text(3, 60),
    sectorId: uuid,
    icon: z.enum(["bulb", "drop", "accessibility", "tool", "building"]),
    active: z.boolean().default(true),
  })
  .strict();
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: unknown,
  ) {
    super(message);
  }
}
const invalid = (message = "Dados inválidos.") =>
  new ApiError(400, "INVALID_INPUT", message);
function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "Revise os campos informados.",
      result.error.flatten().fieldErrors,
    );
  return result.data;
}
async function body(c: ApiContext) {
  try {
    return await c.req.json();
  } catch {
    throw invalid("JSON inválido.");
  }
}
function dbError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const map: Record<string, [number, string, string]> = {
    "42501": [403, "FORBIDDEN", "Você não tem permissão para esta ação."],
    P0002: [404, "NOT_FOUND", "Registro não encontrado."],
    "22023": [400, "INVALID_INPUT", "Dados inválidos."],
    "23502": [400, "INVALID_INPUT", "Dados obrigatórios ausentes."],
    "23514": [400, "INVALID_INPUT", "Dados inválidos."],
    "23503": [
      409,
      "CONFLICT",
      "O registro possui vínculos que impedem esta alteração.",
    ],
    "23505": [
      409,
      "CONFLICT",
      "Este registro já existe ou a solicitação foi reutilizada.",
    ],
    "40001": [
      409,
      "CONFLICT",
      "A ocorrência mudou. Atualize os dados e tente novamente.",
    ],
    P0001: [409, "CONFLICT", "Esta ação viola uma regra de negócio."],
  };
  const [s, code, message] = map[error.code ?? ""] ?? [
    500,
    "INTERNAL_ERROR",
    "Não foi possível concluir a operação.",
  ];
  throw new ApiError(s, code, message);
}
function dto(value: unknown): any {
  if (Array.isArray(value)) return value.map(dto);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key.replace(/_([a-z])/g, (_, x: string) => x.toUpperCase()),
        dto(v),
      ]),
    );
  return value;
}
type Cursor = { id: string; createdAt?: string };
function decodeCursor(value?: string): Cursor | undefined {
  if (!value) return;
  try {
    return checked(
      z
        .object({
          id: uuid,
          createdAt: z.string().datetime({ offset: true }).optional(),
        })
        .strict(),
      JSON.parse(Buffer.from(value, "base64url").toString()),
    );
  } catch {
    throw invalid("Cursor inválido.");
  }
}
function pageArgs(query: Record<string, string>) {
  const p = checked(pageSchema, query);
  return { ...p, after: decodeCursor(p.cursor) };
}
function page(rows: any[], limit: number, chronological = true) {
  const items = rows.slice(0, limit),
    last = items.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            ...(chronological ? { createdAt: last.createdAt } : {}),
          }),
        ).toString("base64url")
      : null;
  return { items, nextCursor };
}
function applyCursor(
  query: any,
  cursor: Cursor | undefined,
  ascending = false,
) {
  if (!cursor) return query;
  if (!cursor.createdAt) throw invalid("Cursor inválido para esta listagem.");
  const op = ascending ? "gt" : "lt";
  return query.or(
    `created_at.${op}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${op}.${cursor.id})`,
  );
}
export function periodBounds(from: string, to: string) {
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid("Período inválido.");
    const date = new Date(`${value}T03:00:00.000Z`);
    if (
      !Number.isFinite(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw invalid("Período inválido.");
    return date;
  };
  const a = day(from),
    b = day(to);
  if (a > b) throw invalid("Período inválido.");
  b.setUTCDate(b.getUTCDate() + 1);
  return { from: a.toISOString(), to: b.toISOString() };
}
function buildSearchFilter(term: string, categoryIds: string[]) {
  // Quote PostgREST reserved punctuation, then escape SQL LIKE wildcards.
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const literal =
    '"' + pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const filters = ["description", "location_name", "reference"].map(
    (column) => `${column}.ilike.${literal}`,
  );
  if (categoryIds.length)
    filters.push(
      `category_id.in.(${categoryIds.map((id) => checked(uuid, id)).join(",")})`,
    );
  const number = /^#?(\d{1,19})$/.exec(term)?.[1];
  if (number && BigInt(number) <= 9223372036854775807n)
    filters.push(`number.eq.${BigInt(number)}`);
  return filters.join(",");
}
const occurrenceSelect =
  "*,author:profiles!occurrences_author_id_fkey(id,name),confirmations(count),contributions(count),occurrence_events(count)";
async function occurrenceDtos(db: SupabaseClient, rows: any[], userId: string) {
  if (!rows.length) return [];
  const { data, error } = await db
    .from("confirmations")
    .select("occurrence_id")
    .eq("user_id", userId)
    .in(
      "occurrence_id",
      rows.map((row) => row.id),
    );
  dbError(error);
  const confirmed = new Set((data ?? []).map((row) => row.occurrence_id));
  return rows.map((row) => {
    const {
      confirmations,
      contributions,
      occurrence_events,
      photo_path,
      request_id,
      request_payload,
      geocoder_metadata,
      own_confirmation,
      ...rest
    } = row;
    return {
      ...dto(rest),
      confirmationCount: confirmations?.[0]?.count ?? 0,
      contributionCount: contributions?.[0]?.count ?? 0,
      eventCount: occurrence_events?.[0]?.count ?? 0,
      confirmedByMe: confirmed.has(row.id),
      hasConfirmed: confirmed.has(row.id),
    };
  });
}
async function rpc(
  db: SupabaseClient,
  name: string,
  params?: Record<string, unknown>,
) {
  const { data, error } = await db.rpc(name, params);
  dbError(error);
  return dto(data);
}
async function requireAdmin(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  dbError(error);
  if (!data)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Acesso exclusivo de administradores.",
    );
}

export function createApp(config: Config = {}) {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.onError((e, c) => {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(
            500,
            "INTERNAL_ERROR",
            "Não foi possível concluir a operação.",
          );
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      error.status as any,
    );
  });
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.use("/api/*", async (c, next) => {
    const token = /^Bearer\s+(\S+)$/i.exec(
      c.req.header("Authorization") ?? "",
    )?.[1];
    if (!token)
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Entre na sua conta para continuar.",
      );
    const url = config.supabaseUrl ?? process.env.SUPABASE_URL,
      key = config.supabaseKey ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!config.clientFactory && (!url || !key))
      throw new ApiError(503, "NOT_CONFIGURED", "Serviço indisponível.");
    const db =
      config.clientFactory?.(token) ??
      createClient(url!, key!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user)
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Sessão inválida ou expirada.",
      );
    c.set("db", db);
    c.set("userId", data.user.id);
    c.set("email", data.user.email);
    await next();
  });
  app.get("/api/me", async (c) => {
    const db = c.get("db"),
      id = c.get("userId");
    const [profile, roles, memberships] = await Promise.all([
      db.from("profiles").select("id,name").eq("id", id).single(),
      db.from("admin_roles").select("user_id").eq("user_id", id).maybeSingle(),
      db.from("sector_memberships").select("sector_id").eq("user_id", id),
    ]);
    [profile, roles, memberships].forEach((result) => dbError(result.error));
    return c.json({
      ...profile.data,
      email: c.get("email"),
      isAdmin: !!roles.data,
      sectorIds: memberships.data?.map((member) => member.sector_id) ?? [],
    });
  });
  app.patch("/api/me", async (c) => {
    const b = checked(z.object({ name: text(3, 80) }).strict(), await body(c));
    return c.json(await rpc(c.get("db"), "update_profile", { p_name: b.name }));
  });
  app.get("/api/catalog", async (c) => {
    const db = c.get("db");
    const [sectors, categories] = await Promise.all([
      db.from("sectors").select("*").order("name"),
      db.from("categories").select("*").order("name"),
    ]);
    dbError(sectors.error);
    dbError(categories.error);
    return c.json({
      sectors: dto(sectors.data),
      categories: dto(categories.data),
    });
  });
  app.get("/api/occurrences", async (c) => {
    const p = checked(
      pageSchema.extend({
        categoryId: uuid.optional(),
        sectorId: uuid.optional(),
        status: z.union([status, z.literal("ativas")]).optional(),
        scope: z
          .enum(["all", "authored", "confirmed", "assigned"])
          .default("all"),
        q: text(0, 160).optional(),
      }),
      c.req.query(),
    );
    const after = decodeCursor(p.cursor),
      db = c.get("db");
    let query = db
      .from("occurrences")
      .select(
        occurrenceSelect +
          (p.scope === "confirmed"
            ? ",own_confirmation:confirmations!inner(user_id)"
            : ""),
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(p.limit + 1);
    if (p.categoryId) query = query.eq("category_id", p.categoryId);
    if (p.sectorId) query = query.eq("sector_id", p.sectorId);
    if (p.status === "ativas")
      query = query.in("status", ["registrada", "analise", "andamento"]);
    else if (p.status) query = query.eq("status", p.status);
    if (p.q) {
      const pattern = `%${p.q.replace(/[\\%_]/g, "\\$&")}%`;
      const categories = await db
        .from("categories")
        .select("id")
        .ilike("name", pattern);
      dbError(categories.error);
      query = query.or(
        buildSearchFilter(
          p.q,
          categories.data?.map((category) => category.id) ?? [],
        ),
      );
    }
    if (p.scope === "authored") query = query.eq("author_id", c.get("userId"));
    if (p.scope === "confirmed")
      query = query.eq("own_confirmation.user_id", c.get("userId"));
    if (p.scope === "assigned") {
      const members = await db
        .from("sector_memberships")
        .select("sector_id")
        .eq("user_id", c.get("userId"));
      dbError(members.error);
      const ids = members.data?.map((member) => member.sector_id) ?? [];
      if (!ids.length) return c.json({ items: [], nextCursor: null });
      query = query.in("sector_id", ids);
    }
    const { data, error } = await applyCursor(query, after);
    dbError(error);
    return c.json(
      page(await occurrenceDtos(db, data ?? [], c.get("userId")), p.limit),
    );
  });
  app.post("/api/occurrences", async (c) => {
    const b = checked(occurrenceSchema, await body(c));
    if (Buffer.byteLength(JSON.stringify(b.locationMetadata ?? null)) > 4096)
      throw invalid("Metadados de localização muito grandes.");
    return c.json(
      await rpc(c.get("db"), "create_occurrence", {
        p_request_id: b.requestId,
        p_category_id: b.categoryId,
        p_description: b.description,
        p_latitude: b.latitude,
        p_longitude: b.longitude,
        p_location_name: b.locationName,
        p_reference: b.reference,
        p_location_source: b.locationSource,
        p_geocoder_metadata: b.locationMetadata ?? null,
        p_photo_path: b.photoPath ?? null,
      }),
      201,
    );
  });
  app.get("/api/occurrences/:id", async (c) => {
    const id = checked(uuid, c.req.param("id")),
      db = c.get("db");
    const { data, error } = await db
      .from("occurrences")
      .select(occurrenceSelect)
      .eq("id", id)
      .maybeSingle();
    dbError(error);
    if (!data)
      throw new ApiError(404, "NOT_FOUND", "Ocorrência não encontrada.");
    const [result] = await occurrenceDtos(db, [data], c.get("userId"));
    if (data.photo_path) {
      const signed = await db.storage
        .from("occurrence-photos")
        .createSignedUrl(data.photo_path, 300);
      dbError(signed.error);
      result.photoUrl = signed.data?.signedUrl ?? null;
    }
    return c.json(result);
  });
  for (const resource of ["events", "contributions"]) {
    app.get(`/api/occurrences/:id/${resource}`, async (c) => {
      const id = checked(uuid, c.req.param("id")),
        p = pageArgs(c.req.query()),
        db = c.get("db");
      const exists = await db
        .from("occurrences")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      dbError(exists.error);
      if (!exists.data)
        throw new ApiError(404, "NOT_FOUND", "Ocorrência não encontrada.");
      const table =
          resource === "events" ? "occurrence_events" : "contributions",
        authorColumn = resource === "events" ? "actor" : "author";
      const { data, error } = await applyCursor(
        db
          .from(table)
          .select(`*,author:profiles!${table}_${authorColumn}_id_fkey(id,name)`)
          .eq("occurrence_id", id)
          .order("created_at")
          .order("id")
          .limit(p.limit + 1),
        p.after,
        true,
      );
      dbError(error);
      const rows = dto(data ?? []).map((row: any) => ({
        ...row,
        authorId: row.authorId ?? row.actorId,
        status: row.newStatus ?? row.status,
        sectorId: row.newSectorId ?? row.sectorId,
        text: row.body ?? row.note ?? row.text,
      }));
      return c.json(page(rows, p.limit));
    });
  }
  app.post("/api/occurrences/:id/confirmations", async (c) => {
    const id = checked(uuid, c.req.param("id"));
    const inserted = await rpc(c.get("db"), "confirm_occurrence", {
      p_occurrence_id: id,
    });
    return c.json({ confirmedByMe: true, hasConfirmed: true, inserted });
  });
  app.post("/api/occurrences/:id/contributions", async (c) => {
    const id = checked(uuid, c.req.param("id"));
    const b = checked(
      z.object({ requestId: uuid, text: text(5, 1500) }).strict(),
      await body(c),
    );
    const result = await rpc(c.get("db"), "add_contribution", {
      p_occurrence_id: id,
      p_request_id: b.requestId,
      p_body: b.text,
    });
    return c.json({ ...result, text: result.body }, 201);
  });
  app.post("/api/occurrences/:id/transitions", async (c) => {
    const id = checked(uuid, c.req.param("id"));
    const b = checked(
      z
        .object({
          status,
          expectedStatus: status,
          expectedSectorId: uuid,
          note: text(0, 1500).default(""),
        })
        .strict(),
      await body(c),
    );
    if (["resolvida", "encerrada"].includes(b.status) && b.note.length < 10)
      throw invalid("Informe uma justificativa de 10 a 1500 caracteres.");
    return c.json(
      await rpc(c.get("db"), "transition_occurrence", {
        p_occurrence_id: id,
        p_expected_status: b.expectedStatus,
        p_expected_sector_id: b.expectedSectorId,
        p_status: b.status,
        p_note: b.note,
      }),
    );
  });
  app.post("/api/occurrences/:id/transfers", async (c) => {
    const id = checked(uuid, c.req.param("id"));
    const b = checked(
      z
        .object({
          sectorId: uuid,
          expectedStatus: status,
          expectedSectorId: uuid,
          reason: text(10, 1500),
        })
        .strict(),
      await body(c),
    );
    return c.json(
      await rpc(c.get("db"), "transfer_occurrence", {
        p_occurrence_id: id,
        p_expected_status: b.expectedStatus,
        p_expected_sector_id: b.expectedSectorId,
        p_sector_id: b.sectorId,
        p_reason: b.reason,
      }),
    );
  });
  app.get("/api/statistics", async (c) => {
    const b = checked(
      z.object({ from: z.string(), to: z.string() }),
      c.req.query(),
    );
    periodBounds(b.from, b.to);
    return c.json(
      await rpc(c.get("db"), "get_statistics", {
        p_start: b.from,
        p_end: b.to,
      }),
    );
  });
  app.use("/api/admin/*", async (c, next) => {
    await requireAdmin(c.get("db"), c.get("userId"));
    await next();
  });
  app.get("/api/admin/users", async (c) => {
    const p = checked(
        pageSchema.extend({ q: text(0, 160).default("") }),
        c.req.query(),
      ),
      after = decodeCursor(p.cursor);
    const rows = await rpc(c.get("db"), "list_admin_users", {
      p_search: p.q,
      p_limit: p.limit + 1,
      p_after_id: after?.id ?? null,
    });
    return c.json(page(rows ?? [], p.limit, false));
  });
  for (const resource of ["sectors", "categories"] as const) {
    const save = async (c: ApiContext, patch: boolean) => {
      const id = patch ? checked(uuid, c.req.param("id")) : null;
      const schema: z.ZodObject<any> =
        resource === "sectors" ? sectorSchema : categorySchema;
      const input = await body(c);
      let b: any;
      if (patch) {
        const partial = checked(schema.partial().strict(), input);
        if (!Object.keys(partial).length) throw invalid();
        const existing = await c
          .get("db")
          .from(resource)
          .select("*")
          .eq("id", id)
          .maybeSingle();
        dbError(existing.error);
        if (!existing.data)
          throw new ApiError(404, "NOT_FOUND", "Registro não encontrado.");
        const editable = Object.fromEntries(
          Object.entries(dto(existing.data)).filter(([key]) =>
            Object.keys(schema.shape).includes(key),
          ),
        );
        b = checked(schema, { ...editable, ...partial });
      } else b = checked(schema, input);
      const params = {
        p_id: id,
        p_name: b.name,
        p_active: b.active,
        ...(resource === "sectors"
          ? { p_description: b.description }
          : { p_sector_id: b.sectorId, p_icon: b.icon }),
      };
      return c.json(
        await rpc(
          c.get("db"),
          resource === "sectors" ? "save_sector" : "save_category",
          params,
        ),
        patch ? 200 : 201,
      );
    };
    app.post(`/api/admin/${resource}`, (c) => save(c, false));
    app.patch(`/api/admin/${resource}/:id`, (c) => save(c, true));
  }
  app.put("/api/admin/users/:id/sectors", async (c) => {
    const id = checked(uuid, c.req.param("id"));
    const b = checked(
      z
        .object({
          sectorIds: z
            .array(uuid)
            .max(100)
            .refine((value) => new Set(value).size === value.length),
        })
        .strict(),
      await body(c),
    );
    await rpc(c.get("db"), "set_user_sectors", {
      p_user_id: id,
      p_sector_ids: b.sectorIds,
    });
    return c.json({ userId: id, sectorIds: b.sectorIds });
  });
  const routes = [
    /^\/api\/health$/,
    /^\/api\/(me|catalog|statistics|occurrences)$/,
    /^\/api\/occurrences\/[^/]+(?:\/(events|contributions|confirmations|transitions|transfers))?$/,
    /^\/api\/admin\/(users|sectors|categories)$/,
    /^\/api\/admin\/(sectors|categories)\/[^/]+$/,
    /^\/api\/admin\/users\/[^/]+\/sectors$/,
  ];
  app.notFound((c) => {
    const known = routes.some((route) => route.test(c.req.path));
    return c.json(
      {
        error: {
          code: known ? "METHOD_NOT_ALLOWED" : "NOT_FOUND",
          message: known ? "Método não permitido." : "Rota não encontrada.",
        },
      },
      known ? 405 : 404,
    );
  });
  return app;
}
