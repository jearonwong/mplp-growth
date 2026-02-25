// @ts-expect-error — jsdom lacks type declarations in this project
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let renderQueueItemFunc: (item: any) => HTMLElement;
let getAppHtml: () => string;

async function setupJSDOM() {
  const htmlPath = path.join(__dirname, "ui-static", "index.html");
  let html = "";
  try {
    html = await fs.readFile(htmlPath, "utf-8");
  } catch (e) {
    // fallback empty html
    html = `<!DOCTYPE html><html><body></body></html>`;
  }

  const jsPath = path.join(__dirname, "ui-static", "app.js");
  const jsContent = await fs.readFile(jsPath, "utf-8");

  const dom = new JSDOM(html, { runScripts: "outside-only" });

  // Attach some polyfills for the app.js global context
  (dom.window as any).app = { handlers: { openImpactModal: () => {}, reject: () => {} } };

  // Expose the render function directly for testing by appending a return snippet
  const scriptContent = `
    ${jsContent}
    window.renderQueueItem = renderQueueItem;
  `;

  dom.window.eval(scriptContent);
  renderQueueItemFunc = (dom.window as any).renderQueueItem;
}

test("GATE-UI-ROLE-BADGE-01: Renders 'Drafted by' badge natively if role exists", async () => {
  await setupJSDOM();
  const item = {
    category: "outreach",
    title: "Test Entry",
    policy_check: { status: "pass" },
    drafted_by_role: "BDWriter",
  };

  const el = renderQueueItemFunc(item);
  expect(el.innerHTML).toContain("Drafted by BDWriter");
});

test("GATE-UI-WHY-LIMIT-01: UI gracefully truncates rationale bullets to 3 items", async () => {
  await setupJSDOM();
  const item = {
    category: "outreach",
    title: "Test Entry",
    policy_check: { status: "pass" },
    drafted_by_role: "BDWriter",
    rationale_bullets: ["Reason 1", "Reason 2", "Reason 3", "Reason 4", "Reason 5"],
  };

  const el = renderQueueItemFunc(item);
  // Implementation should only map the first 3
  expect(el.innerHTML).toContain("Reason 1");
  expect(el.innerHTML).toContain("Reason 2");
  expect(el.innerHTML).toContain("Reason 3");
  expect(el.innerHTML).not.toContain("Reason 4");
  expect(el.innerHTML).not.toContain("Reason 5");
});

test("GATE-UI-WHY-HIDE-EMPTY-01: Hides rationale container completely if bullets are empty", async () => {
  await setupJSDOM();
  const item = {
    category: "outreach",
    title: "Test Entry",
    policy_check: { status: "pass" },
    drafted_by_role: "BDWriter",
    rationale_bullets: [],
  };

  const el = renderQueueItemFunc(item);
  expect(el.innerHTML).not.toContain("Agent Rationale");
  expect(el.innerHTML).not.toContain("Why:");
});
