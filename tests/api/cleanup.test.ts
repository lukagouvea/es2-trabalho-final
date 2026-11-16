import { expect, it } from "vitest";
import { cleanUploads } from "../../scripts/upload-cleanup";
it("snapshots every listing page before removal so shifted offsets cannot skip objects", async () => {
  const objects = Array.from({ length: 205 }, (_, i) => ({
    id: String(i),
    name: String(i) + ".jpg",
    created_at: "2020-01-01T00:00:00Z",
  }));
  const removed: string[] = [];
  const client: any = {
    storage: {
      from: () => ({
        list: async (folder: string, { limit, offset }: any) => ({
          data: folder
            ? objects.slice(offset, offset + limit)
            : offset
              ? []
              : [{ name: "owner", id: null }],
          error: null,
        }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          for (const path of paths) {
            const index = objects.findIndex((o) => "owner/" + o.name === path);
            objects.splice(index, 1);
          }
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ eq: async () => ({ count: 0, error: null }) }),
    }),
  };
  await cleanUploads(client, true, Date.now(), () => {});
  expect(removed).toHaveLength(205);
});
