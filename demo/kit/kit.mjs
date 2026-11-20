// The violin app's demo kit: what the generic runner (demo/runner) needs from this app.
// The contract is demo/CONTRACT.md.
import { start } from "./serve.mjs";

export default {
  app: "violin",
  // A phone-shaped viewport (9:16), recorded at 2× into the template's 720×1280
  viewport: { width: 390, height: 693 },
  /** Serve the app with the synthetic progress. Resolves to { url, loadUrl(query), close }. */
  start: ({ browser } = {}) => start({ browser }),
  /** The app is loaded and has read the fixture. */
  ready: (page) => page.waitForFunction(() => typeof DB === "object" && typeof renderAll === "function" && DB.xp > 0),
};
