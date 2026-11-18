import { Hono } from "hono";
import { z } from "zod";
import { body, checked, rpc, text, uuid, type Env } from "./api-support.js";

const sector = z.strictObject({
  name: text(3, 80),
  description: text(0, 300).optional(),
  active: z.boolean().optional(),
});
const category = z.strictObject({
  name: text(3, 60),
  sectorId: uuid,
  icon: z.enum(["bulb", "drop", "accessibility", "tool", "building"]),
  active: z.boolean().optional(),
});
const hasChanges = (fields: object) => Object.keys(fields).length > 0;
const sectorPatch = sector.partial().refine(hasChanges);
const categoryPatch = category.partial().refine(hasChanges);

function sectorParams(value: z.infer<typeof sectorPatch>) {
  return {
    p_name: value.name,
    p_description: value.description,
    p_active: value.active,
  };
}
function categoryParams(value: z.infer<typeof categoryPatch>) {
  return {
    p_name: value.name,
    p_sector_id: value.sectorId,
    p_icon: value.icon,
    p_active: value.active,
  };
}

export const catalogAdminRoutes = new Hono<Env>();
catalogAdminRoutes.post("/sectors", async (c) => {
  const input = checked(sector, await body(c));
  return c.json(
    await rpc(c.get("db"), "save_sector", sectorParams(input)),
    201,
  );
});
catalogAdminRoutes.patch("/sectors/:id", async (c) => {
  const id = checked(uuid, c.req.param("id"));
  const input = checked(sectorPatch, await body(c));
  return c.json(
    await rpc(c.get("db"), "patch_sector", {
      p_id: id,
      ...sectorParams(input),
    }),
  );
});
catalogAdminRoutes.post("/categories", async (c) => {
  const input = checked(category, await body(c));
  return c.json(
    await rpc(c.get("db"), "save_category", categoryParams(input)),
    201,
  );
});
catalogAdminRoutes.patch("/categories/:id", async (c) => {
  const id = checked(uuid, c.req.param("id"));
  const input = checked(categoryPatch, await body(c));
  return c.json(
    await rpc(c.get("db"), "patch_category", {
      p_id: id,
      ...categoryParams(input),
    }),
  );
});
