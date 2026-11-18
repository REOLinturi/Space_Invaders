// Node 22+. The API key stays inside this process.
import http from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("./", import.meta.url);
const sectors = JSON.parse(await readFile(new URL("sectors.json", root), "utf8"));
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const voice =
  "You are Kestrel, flight control in the fictional arcade game Cinder Reach. Speak concise English in a calm pilot's voice. The player moves sideways, fires upward and shelters behind destructible shields. A wave is lost if the formation crosses the defense line or hull lives run out. Ten waves win the campaign. Only use supplied game mechanics. No headings or markdown.";

async function transmit(input, format, tokens) {
  if (!key) throw new Error("OPENAI_API_KEY is unavailable");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: voice,
      input,
      max_output_tokens: tokens,
      ...(format ? { text: { format } } : {}),
    }),
    signal: AbortSignal.timeout(format ? 90000 : 13500),
  });
  if (!response.ok) throw new Error("OpenAI returned HTTP " + response.status);
  const body = await response.json();
  const message = body.output
    ?.flatMap((x) => x.content || [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("")
    .trim();
  if (body.status !== "completed" || !message) throw new Error("Incomplete radio transmission");
  return message;
}
async function generateArchive() {
  const fields = ["brief", "damage", "aim", "debrief"];
  const sector = {
    type: "object",
    additionalProperties: false,
    required: fields,
    properties: Object.fromEntries(fields.map((f) => [f, { type: "string" }])),
  };
  const waveKeys = sectors.map((_, i) => "wave_" + (i + 1));
  const format = {
    type: "json_schema",
    name: "station_archive",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: waveKeys,
      properties: Object.fromEntries(waveKeys.map((w) => [w, sector])),
    },
  };
  const raw = await transmit(
    "Write four distinct radio calls under 28 words each per wave, in the given order. brief introduces the sector and a tactic, damage advises a pilot on their final life, aim helps a pilot with low accuracy, and debrief reflects on this sector without assuming victory or defeat. Sectors: " +
      JSON.stringify(sectors),
    format,
    5200,
  );
  const replies = JSON.parse(raw),
    pack = { sectors: waveKeys.map((w) => replies[w]) };
  if (
    pack.sectors?.length !== 10 ||
    !pack.sectors.every((s) =>
      fields.every((k) => typeof s[k] === "string" && s[k].trim() && s[k].length < 450),
    )
  )
    throw new Error("Invalid archive");
  const tmp = new URL("transmissions." + process.pid + ".tmp", root);
  await writeFile(tmp, JSON.stringify(pack, null, 2) + "\n");
  await rename(tmp, new URL("transmissions.json", root));
  console.log("Saved OpenAI radio calls for ten sectors.");
}
const files = new Set([
  "index.html",
  "game.js",
  "world.js",
  "models.js",
  "sky.js",
  "radio.js",
  "styles.css",
  "sectors.json",
  "transmissions.json",
  "vendor/three/three.module.min.js",
  "vendor/three/three.core.min.js",
]);
const json = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};
const phases = new Set(["intro", "playing", "intermission", "victory", "loss"]);
const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
function valid(s) {
  return (
    s &&
    Object.keys(s).length === 7 &&
    integer(s.stage, 10) &&
    s.stage >= 1 &&
    integer(s.lives, 3) &&
    integer(s.score, 999999) &&
    integer(s.accuracy, 100) &&
    integer(s.shots, 999999) &&
    integer(s.remaining, 60) &&
    phases.has(s.phase)
  );
}
function serve() {
  const port = Number(process.env.PORT || 8787);
  let lastCall = 0,
    busy = false;
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host;
    if (host !== "127.0.0.1:" + port && host !== "localhost:" + port)
      return json(res, 403, { error: "Local access only" });
    const url = new URL(req.url, "http://" + host);
    if (url.pathname === "/api/status") return json(res, 200, { live: Boolean(key) });
    if (url.pathname === "/api/radio") {
      if (
        req.method !== "POST" ||
        req.headers.origin !== "http://" + host ||
        req.headers["content-type"] !== "application/json"
      )
        return json(res, 403, { error: "Same-origin JSON required" });
      if (!key) return json(res, 503, { error: "Uplink offline" });
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1024) return json(res, 413, { error: "Too large" });
        }
        const data = JSON.parse(body);
        if (!valid(data)) return json(res, 400, { error: "Invalid telemetry" });
        if (busy || Date.now() - lastCall < 5000) return json(res, 429, { error: "Radio busy" });
        busy = true;
        lastCall = Date.now();
        try {
          const message = await transmit(
            "Give one situation-specific flight call in under 40 words. For intermission or the end of a run give a short debrief. Telemetry: " +
              JSON.stringify({ ...data, sector: sectors[data.stage - 1] }),
            null,
            150,
          );
          return json(res, 200, { message });
        } finally {
          busy = false;
        }
      } catch (error) {
        return json(res, error instanceof SyntaxError ? 400 : 502, { error: "Radio call failed" });
      }
    }
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (req.method !== "GET" || !files.has(name)) return json(res, 404, { error: "Not found" });
    try {
      const content = await readFile(new URL(name, root));
      const type = { js: "text/javascript", html: "text/html", css: "text/css", json: "application/json" }[
        name.split(".").pop()
      ];
      res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      res.end(content);
    } catch {
      return json(res, 404, { error: "Missing game file" });
    }
  });
  server.listen(port, "127.0.0.1", () => console.log("Flight deck at http://127.0.0.1:" + port));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--archive"))
    await generateArchive().catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  else serve();
}
