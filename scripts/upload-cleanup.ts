import type { SupabaseClient } from "@supabase/supabase-js";
export async function cleanUploads(
  client: SupabaseClient,
  apply = false,
  now = Date.now(),
  log: (text: string) => void = console.log,
) {
  const bucket = client.storage.from("occurrence-photos");
  const cutoff = now - 86400000;
  const folders = [""];
  const candidates: string[] = [];
  // Complete the listing before deleting: removal shifts offset-based pages.
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ;) {
      const { data: objects, error } = await bucket.list(folder, {
        limit: 100,
        offset,
      });
      if (error) throw error;
      if (!objects?.length) break;
      offset += objects.length;
      for (const object of objects) {
        const path = [folder, object.name].filter(Boolean).join("/");
        if (!object.id) {
          folders.push(path);
          continue;
        }
        if (object.created_at && new Date(object.created_at).getTime() < cutoff)
          candidates.push(path);
      }
    }
  }
  for (const photoPath of candidates) {
    const { count, error } = await client
      .from("occurrences")
      .select("id", { count: "exact", head: true })
      .eq("photo_path", photoPath);
    if (error) throw error;
    if (count !== 0) continue;
    log((apply ? "Removendo: " : "Prévia: ") + photoPath);
    if (apply) {
      const { error } = await bucket.remove([photoPath]);
      if (error) throw error;
    }
  }
  log(
    apply
      ? "Limpeza concluída."
      : "Prévia concluída. Use --apply para executar.",
  );
}
