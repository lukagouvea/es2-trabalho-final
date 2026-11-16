import { createApp } from "../server/app.js";
export const runtime = "nodejs";
export default { fetch: createApp().fetch };
