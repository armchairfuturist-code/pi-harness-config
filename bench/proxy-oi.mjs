#!/usr/bin/env node
/**
 * Localhost-only OpenAI-compatible benchmark proxy.
 *
 * Forwards streaming and non-streaming requests, forces identity encoding,
 * optionally gives each benchmark request a unique prompt-cache key, captures
 * redacted request/response packets atomically, and normalizes usage aliases.
 */
import http from "node:http";
import https from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const port = Number(process.env.PROXY_PORT ?? 4599);
const upstream = new URL(process.env.UPSTREAM_URL ?? "https://api.getlilac.com/v1");
const captureRoot = process.env.CAPTURE_DIR ?? join(process.cwd(), "captures");
const label = process.env.LABEL ?? "unlabelled";
const coldBust = /^(1|true|yes)$/i.test(process.env.COLD_BUST ?? "0");
const captureDir = join(captureRoot, label);
mkdirSync(captureDir, { recursive: true, mode: 0o700 });
let sequence = 0;

function nextId() {
  sequence += 1;
  return `${Date.now()}-${String(sequence).padStart(3, "0")}`;
}
function redactHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !["authorization", "x-api-key", "cookie"].includes(key.toLowerCase())));
}
function normalizeUsage(usage = {}) {
  const details = usage.prompt_tokens_details ?? usage.input_tokens_details ?? {};
  const input = usage.input_tokens ?? usage.prompt_tokens ?? usage.input ?? 0;
  const output = usage.output_tokens ?? usage.completion_tokens ?? usage.output ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? usage.cached_tokens ?? details.cached_tokens ?? usage.cacheRead ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? usage.cache_write_input_tokens ?? usage.cacheWrite ?? 0;
  return { input, output, cacheRead, cacheWrite, total: usage.total_tokens ?? input + output + cacheRead + cacheWrite };
}
function decodeResponse(buffer, contentEncoding) {
  try {
    if (contentEncoding === "gzip") return gunzipSync(buffer).toString("utf8");
    if (contentEncoding === "deflate") return inflateSync(buffer).toString("utf8");
    if (contentEncoding === "br") return brotliDecompressSync(buffer).toString("utf8");
  } catch {}
  return buffer.toString("utf8");
}
function parseUsage(text, contentType) {
  if ((contentType ?? "").includes("text/event-stream")) {
    let usage = {};
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        usage = { ...usage, ...(event.usage ?? {}), ...(event.message?.usage ?? {}) };
      } catch {}
    }
    return normalizeUsage(usage);
  }
  try { return normalizeUsage(JSON.parse(text).usage ?? {}); } catch { return normalizeUsage(); }
}
function saveCapture(id, request, response, durationMs) {
  const file = join(captureDir, `${id}.json`);
  const temp = `${file}.tmp`;
  const usage = parseUsage(response.text, response.headers["content-type"]);
  const payload = {
    id,
    label,
    coldBust,
    durationMs,
    request: { method: request.method, path: request.path, headers: redactHeaders(request.headers), body: request.body },
    response: { statusCode: response.statusCode, headers: response.headers, body: { usage, raw: response.text } },
    usage,
  };
  writeFileSync(temp, JSON.stringify(payload), { mode: 0o600 });
  renameSync(temp, file);
}
function pathForClientRequest(url) {
  const path = url || "/";
  return path.startsWith("/v1") ? path : `/v1${path}`;
}

const transport = upstream.protocol === "https:" ? https : http;
const server = http.createServer((clientReq, clientRes) => {
  const started = Date.now();
  const chunks = [];
  clientReq.on("data", (chunk) => chunks.push(chunk));
  clientReq.on("end", () => {
    const id = nextId();
    const path = pathForClientRequest(clientReq.url);
    let requestBody;
    try { requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { requestBody = {}; }
    if (coldBust && requestBody && typeof requestBody === "object" && !Array.isArray(requestBody)) {
      requestBody.prompt_cache_key = `cold-${label}-${id}`;
      requestBody.store = false;
    }
    const body = Buffer.from(JSON.stringify(requestBody));
    if (coldBust) console.log(`[proxy] ${id} cache_key=${requestBody.prompt_cache_key ?? "none"}`);
    const headers = { ...clientReq.headers, host: upstream.host, "accept-encoding": "identity", "content-length": String(body.length) };
    delete headers["transfer-encoding"];
    const upstreamReq = transport.request({
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === "https:" ? 443 : 80),
      method: clientReq.method,
      path,
      headers,
    }, (upstreamRes) => {
      const responseChunks = [];
      clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.on("data", (chunk) => { responseChunks.push(chunk); clientRes.write(chunk); });
      upstreamRes.on("end", () => {
        clientRes.end();
        const responseBuffer = Buffer.concat(responseChunks);
        try {
          saveCapture(id, { method: clientReq.method, path, headers: clientReq.headers, body: requestBody }, {
            statusCode: upstreamRes.statusCode ?? 502,
            headers: upstreamRes.headers,
            text: decodeResponse(responseBuffer, String(upstreamRes.headers["content-encoding"] ?? "").toLowerCase()),
          }, Date.now() - started);
        } catch (error) { console.error(`[proxy] capture failed: ${error instanceof Error ? error.message : String(error)}`); }
      });
    });
    upstreamReq.on("error", (error) => {
      const text = JSON.stringify({ error: { message: error.message } });
      clientRes.writeHead(502, { "content-type": "application/json" });
      clientRes.end(text);
      try { saveCapture(id, { method: clientReq.method, path, headers: clientReq.headers, body: requestBody }, { statusCode: 502, headers: { "content-type": "application/json" }, text }, Date.now() - started); } catch {}
    });
    upstreamReq.end(body);
  });
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
server.listen(port, "127.0.0.1", () => console.log(`[proxy] 127.0.0.1:${port} -> ${upstream.origin} label=${label} coldBust=${coldBust}`));
