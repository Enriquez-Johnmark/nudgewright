// Makes docs/showcase/: screenshots and a captioned walkthrough video of the
// engine at work. Every command shown is run for real and its own output is
// what appears; nothing is typed in by hand.
//
//   docker compose up -d                      # Postgres
//   docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit
//   node scripts/showcase.mjs
//
// Needs Node with Playwright (`npm i -g playwright`) and ffmpeg. The two
// products' dashboards are read from sibling checkouts (KOMPLETO_DIR and
// BALANSE_DIR, default ../kompleto and ../balanse).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Playwright is installed globally, not as a dependency of this repository.
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(import.meta.dirname, "..");
const out = join(root, "docs/showcase");
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
const products = {
  Kompleto: resolve(
    process.env.KOMPLETO_DIR ?? join(root, "../kompleto"),
    "docs/showcase/desktop-1-dashboard.png",
  ),
  Balanse: resolve(
    process.env.BALANSE_DIR ?? join(root, "../balanse"),
    "docs/showcase/desktop-1-dashboard.png",
  ),
};

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

async function exampleEmails() {
  const query = encodeURIComponent("to:client@example.test");
  const found = await (await fetch(`${mailpit}/api/v1/search?query=${query}&limit=50`)).json();
  return (found.messages ?? []).map((message) => message.ID);
}

// Earlier runs' emails go first, so the inbox shows this run's one email.
const earlier = await exampleEmails();
if (earlier.length > 0) {
  await fetch(`${mailpit}/api/v1/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: earlier }),
  });
}

// The real runs, before anything is shown.
const example = run("cargo", ["run", "-q", "--example", "approve_and_send"]).trim();
const tests = run("cargo", ["test", "-q", "--test", "outbox", "--", "--test-threads=1", "--format=pretty"])
  .split("\n")
  .filter((line) => line.startsWith("test ") || line.startsWith("test result"));
const sent = await exampleEmails();
if (sent.length !== 1) throw new Error(`expected the example's one email in Mailpit, found ${sent.length}`);
const messageId = sent[0];
const source = readFileSync(join(root, "examples/approve_and_send.rs"), "utf8");
const loop = source.slice(source.indexOf("    // 1."), source.indexOf("    println!")).trimEnd();

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function terminal(title, lines) {
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #0f172a; font: 15px/1.55 ui-monospace, "DejaVu Sans Mono", monospace; color: #e2e8f0 }
    .bar { background: #1e293b; color: #94a3b8; padding: 10px 18px; font: 600 14px system-ui, sans-serif }
    pre { margin: 0; padding: 22px 28px 120px; white-space: pre-wrap }
    .prompt { color: #5eead4 } .ok { color: #86efac } .dim { color: #94a3b8 } .kw { color: #f9a8d4 }
    .line { opacity: 0 } .line.shown { opacity: 1 }
  </style><div class="bar">${escape(title)}</div><pre>${lines
    .map((line) => `<div class="line">${line || "&nbsp;"}</div>`)
    .join("")}</pre>`;
}

const styledTest = (line) =>
  escape(line)
    .replace(/\.\.\. ok$/, '... <span class="ok">ok</span>')
    .replace(/(test result: ok\.)/, '<span class="ok">$1</span>');
const styledCode = (line) =>
  escape(line)
    .replace(/^(\s*)(\/\/.*)$/, '$1<span class="dim">$2</span>')
    .replace(/\b(let|await)\b/g, '<span class="kw">$1</span>');

const scenes = {
  code: terminal("examples/approve_and_send.rs", loop.split("\n").map(styledCode)),
  example: terminal("Terminal", [
    `<span class="prompt">$</span> cargo run --example approve_and_send`,
    ...example.split("\n").map((line) => `<span class="ok">${escape(line)}</span>`),
  ]),
  tests: terminal("Terminal", [
    `<span class="prompt">$</span> cargo test --test outbox`,
    ...tests.map(styledTest),
  ]),
};

function productsPage() {
  const cards = Object.entries(products)
    .filter(([, file]) => existsSync(file))
    .map(
      ([name, file]) =>
        `<figure><img src="data:image/png;base64,${readFileSync(file).toString("base64")}"><figcaption>${name}</figcaption></figure>`,
    )
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #f1f5f9; font: 600 20px system-ui, sans-serif; display: flex; gap: 28px; padding: 48px 40px; box-sizing: border-box; height: 100vh }
    figure { margin: 0; flex: 1; display: flex; flex-direction: column; gap: 12px }
    img { width: 100%; border-radius: 10px; box-shadow: 0 10px 30px rgba(15,23,42,.18) }
    figcaption { text-align: center; color: #0f172a }
  </style>${cards}`;
}

const captionScript = () => {
  const caption = document.createElement("div");
  caption.id = "showcase-caption";
  Object.assign(caption.style, {
    position: "fixed",
    left: "50%",
    bottom: "28px",
    transform: "translateX(-50%)",
    maxWidth: "80%",
    padding: "12px 22px",
    borderRadius: "12px",
    background: "rgba(15, 23, 42, 0.92)",
    color: "#fff",
    font: "500 22px/1.4 system-ui, sans-serif",
    textAlign: "center",
    zIndex: "2147483647",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.3s",
    border: "1px solid #334155",
  });
  document.body.append(caption);
  window.showCaption = (text) => {
    caption.textContent = text;
    caption.style.opacity = text ? "1" : "0";
  };
};

async function show(page, html) {
  await page.setContent(html);
  await page.evaluate(captionScript);
}

async function say(page, text, readFor = 5000) {
  await page.evaluate((caption) => window.showCaption?.(caption), text);
  await page.waitForTimeout(readFor);
}

/** Reveals the page's lines one by one, as a terminal prints them. */
async function reveal(page, every = 120) {
  const count = await page.locator(".line").count();
  for (let index = 0; index < count; index++) {
    await page.evaluate((i) => document.querySelectorAll(".line")[i].classList.add("shown"), index);
    await page.waitForTimeout(index === 0 ? 900 : every);
  }
}

/** Records `page` with Chromium's screencast; the returned function writes
 *  an MP4 with ffmpeg. Each frame lasts until the next. */
async function record(page, dir) {
  const session = await page.context().newCDPSession(page);
  const frames = [];
  session.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = join(dir, `frame-${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, at: metadata.timestamp ?? Date.now() / 1000 });
    session.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 90 });
  return async (output) => {
    await session.send("Page.stopScreencast");
    const list = frames.flatMap((frame, index) => {
      const next = frames[index + 1]?.at ?? frame.at + 2;
      return [`file '${frame.file}'`, `duration ${(next - frame.at).toFixed(3)}`];
    });
    list.push(`file '${frames[frames.length - 1].file}'`);
    writeFileSync(join(dir, "frames.txt"), list.join("\n"));
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      join(dir, "frames.txt"),
      "-vf",
      "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v",
      "libx264",
      "-crf",
      "26",
      "-movflags",
      "+faststart",
      output,
    ]);
  };
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

// Screenshots, at twice the pixels.
const stills = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
for (const [name, html] of Object.entries(scenes)) {
  await stills.setContent(html.replace(/class="line"/g, 'class="line shown"'));
  await stills.screenshot({ path: join(out, `${name}.png`) });
}
await stills.goto(`${mailpit}/view/${messageId}`);
await stills.waitForLoadState("networkidle");
await stills.screenshot({ path: join(out, "mailpit.png") });
await stills.close();

// The walkthrough.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const frames = mkdtempSync(join(tmpdir(), "nudgewright-frames-"));
const stop = await record(page, frames);

await show(page, scenes.code);
await reveal(page, 60);
await say(page, "Nudgewright is the engine behind human-approved reminders.");
await say(page, "A product drafts a message. Nothing goes out yet.");
await say(page, "A person approves exactly what they saw: the approval binds a hash of the content.");
await say(page, "Then the sender delivers it once, even if the server crashes mid-send.");

await show(page, scenes.example);
await say(page, "This is that example, run for real against Postgres and a local mail catcher.", 1500);
await reveal(page);
await say(page, "One message sent. Nothing failed, nothing blocked, nothing unconfirmed.");

await page.goto(`${mailpit}/view/${messageId}`);
await page.waitForLoadState("networkidle");
await page.evaluate(captionScript);
await say(page, "It arrives once, with the exact content that was approved.");

await show(page, scenes.tests);
await say(page, "Every guarantee has a test that proves it.", 1500);
await reveal(page, 140);
await say(page, "Edited after approval? Not sent. Unsure if the provider got it? Never sent twice.", 6000);

await show(page, productsPage());
await say(page, "Two products run on it today: Kompleto for bookkeepers, Balanse for unpaid invoices.", 6000);
await say(page, "Each adds only its own pages and rules. The engine keeps the promises.");
await say(page, "Nudgewright: draft, approve, send once.", 4000);

await stop(join(out, "walkthrough.mp4"));
await browser.close();
console.log(`written to ${out}`);
