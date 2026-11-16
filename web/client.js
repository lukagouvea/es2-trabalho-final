import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export class StaleRequest extends Error {}
let generation = 0;
export function invalidateRequests() {
  generation += 1;
}
export async function api(path, { method = "GET", body, signal } = {}) {
  const version = generation;
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (version !== generation) throw new StaleRequest();
  if (error || !session)
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (version !== generation) throw new StaleRequest();
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.",
    );
  }
  if (version !== generation) throw new StaleRequest();
  const result = await response.json().catch(() => null);
  if (version !== generation) throw new StaleRequest();
  if (!response.ok) {
    const failure = new Error(
      result?.error?.message ||
        "Não foi possível acessar o serviço. Tente novamente.",
    );
    failure.status = response.status;
    failure.code = result?.error?.code;
    failure.fields = result?.error?.fields;
    throw failure;
  }
  return result;
}
export async function allPages(path, signal) {
  const items = [];
  let cursor;
  const seen = new Set();
  do {
    const page = await api(
      `${path}${path.includes("?") ? "&" : "?"}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor))
      throw new Error("O serviço repetiu uma página. Atualize a consulta.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}
