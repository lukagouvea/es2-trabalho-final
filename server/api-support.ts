import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export type Env = {
  Variables: { db: SupabaseClient; userId: string; email: string | undefined };
};
type ApiContext = Context<Env>;
// PostgreSQL accepts canonical UUIDs without RFC version/variant bits.
export const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "UUID inválido.",
  );
export const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max);
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: unknown,
  ) {
    super(message);
  }
}
export const invalid = (message = "Dados inválidos.") =>
  new ApiError(400, "INVALID_INPUT", message);
export function checked<T>(schema: z.ZodType<T>, value: unknown): T {
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
export async function body(c: ApiContext) {
  try {
    return await c.req.json();
  } catch {
    throw invalid("JSON inválido.");
  }
}
export function dbError(error: { code?: string; message?: string } | null) {
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
export function dto(value: unknown): any {
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
export async function rpc(
  db: SupabaseClient,
  name: string,
  params?: Record<string, unknown>,
) {
  const { data, error } = await db.rpc(name, params);
  dbError(error);
  return dto(data);
}
