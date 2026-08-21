import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import worker, { TOOLS, runTool } from "../worker.js";

const MCP = "https://market.datakoot.com/mcp";

const LIVE_HISTORICAL = {
  base: "USD",
  date: "2024-06-03",
  requested_date: "2024-06-03",
  rates: { EUR: 0.92234, GBP: 0.7856 },
  source: "ECB reference rates via Frankfurter (information only; not a transaction benchmark)",
};

const LIVE_CURRENCIES = {
  count: 3,
  currencies: {
    EUR: "Euro",
    GBP: "British Pound",
    USD: "United States Dollar",
  },
  source: "ECB reference rates via Frankfurter (information only; not a transaction benchmark)",
};

function requiredPaths(schema, prefix = "") {
  const paths = [];
  if (!schema || schema.type !== "object") return paths;
  for (const key of schema.required || []) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const child = schema.properties?.[key];
    if (child && child.type === "object" && Array.isArray(child.required) && child.required.length) {
      paths.push(...requiredPaths(child, path));
    }
  }
  return paths;
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function validate(schema, value, path = "$") {
  if (!schema) throw new Error(`missing schema at ${path}`);
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path} expected object`);
    }
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${path} missing ${key}`);
    }
    const props = schema.properties || {};
    for (const [key, child] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validate(child, value[key], `${path}.${key}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) throw new Error(`${path} unexpected ${key}`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          validate(schema.additionalProperties, child, `${path}.${key}`);
        }
      }
    }
    return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") throw new Error(`${path} expected string`);
    return;
  }
  if (schema.type === "integer") {
    if (!Number.isInteger(value)) throw new Error(`${path} expected integer`);
    return;
  }
  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} expected number`);
    return;
  }
  throw new Error(`${path} unsupported schema type ${schema.type}`);
}

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function rpcResponse(method, params, id = 1, headers = {}) {
  const requestHeaders = { "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18", ...headers };
  for (const [name, value] of Object.entries(requestHeaders)) if (value === undefined) delete requestHeaders[name];
  const res = await worker.fetch(
    new Request(MCP, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
    {},
  );
  return res;
}

async function rpc(method, params, id = 1, headers = {}) {
  return (await rpcResponse(method, params, id, headers)).json();
}

afterEach(() => {
  // Restore in case a test fails before its own cleanup.
  if (globalThis.fetch?.__testMock) delete globalThis.fetch;
});

test("tools/list advertises outputSchema only on the modeled FX tools", async () => {
  const listed = await rpc("tools/list");
  const tools = listed.result.tools;
  assert.deepEqual(
    tools.map((t) => t.name),
    ["fx_rates", "fx_convert", "fx_historical", "fx_timeseries", "fx_currencies"],
  );
  assert.equal(tools.find((t) => t.name === "fx_rates").outputSchema.required.join(","), "base,date,rates,source");
  assert.equal(tools.find((t) => t.name === "fx_historical").outputSchema.required.join(","), "base,date,requested_date,rates,source");
  assert.equal(tools.find((t) => t.name === "fx_currencies").outputSchema.required.join(","), "count,currencies,source");
  assert.equal(tools.find((t) => t.name === "fx_convert").outputSchema, undefined);
  assert.equal(tools.find((t) => t.name === "fx_timeseries").outputSchema, undefined);
});

test("fx_currencies handler output matches its outputSchema", async () => {
  const restore = mockFetch(async () => jsonResponse({ EUR: "Euro", GBP: "British Pound", USD: "United States Dollar" }));
  try {
    const out = await runTool("fx_currencies", {});
    const schema = TOOLS.find((t) => t.name === "fx_currencies").outputSchema;
    validate(schema, out);
    for (const path of requiredPaths(schema)) {
      assert.notEqual(getPath(out, path), undefined, `missing ${path}`);
    }
    assert.equal(out.count, 3);
    assert.equal(out.currencies.USD, "United States Dollar");
  } finally {
    restore();
  }
});

test("fx_historical handler output matches schema and the live 2024-06-03 fixture", async () => {
  const restore = mockFetch(async (url) => {
    assert.match(String(url), /2024-06-03\?base=USD&symbols=EUR,GBP/);
    return jsonResponse({ amount: 1.0, base: "USD", date: "2024-06-03", rates: { EUR: 0.92234, GBP: 0.7856 } });
  });
  try {
    const out = await runTool("fx_historical", { date: "2024-06-03", base: "USD", symbols: "EUR,GBP" });
    const schema = TOOLS.find((t) => t.name === "fx_historical").outputSchema;
    validate(schema, out);
    for (const path of requiredPaths(schema)) {
      assert.notEqual(getPath(out, path), undefined, `missing ${path}`);
    }
    assert.deepEqual(out, LIVE_HISTORICAL);
  } finally {
    restore();
  }
});

test("fx_rates handler output matches its outputSchema", async () => {
  const restore = mockFetch(async (url) => {
    assert.match(String(url), /latest\?base=USD&symbols=EUR$/);
    return jsonResponse({ amount: 1.0, base: "USD", date: "2026-08-20", rates: { EUR: 0.85609 } });
  });
  try {
    const out = await runTool("fx_rates", { base: "USD", symbols: "EUR" });
    const schema = TOOLS.find((t) => t.name === "fx_rates").outputSchema;
    validate(schema, out);
    for (const path of requiredPaths(schema)) {
      assert.notEqual(getPath(out, path), undefined, `missing ${path}`);
    }
    assert.equal(out.base, "USD");
    assert.equal(out.rates.EUR, 0.85609);
  } finally {
    restore();
  }
});

test("successful tools/call returns schema-valid structuredContent without changing the JSON text body", async () => {
  const restore = mockFetch(async () => jsonResponse({ amount: 1.0, base: "USD", date: "2024-06-03", rates: { EUR: 0.92234, GBP: 0.7856 } }));
  try {
    const payload = await rpc("tools/call", { name: "fx_historical", arguments: { date: "2024-06-03", base: "USD", symbols: "EUR,GBP" } });
    const result = payload.result;
    assert.equal(result.isError, false);
    const text = result.content[0].text;
    const jsonPart = text.replace(/\n\n\(.* free calls left today\)\s*$/, "");
    const parsed = JSON.parse(jsonPart);
    assert.deepEqual(parsed, LIVE_HISTORICAL);
    assert.deepEqual(result.structuredContent, LIVE_HISTORICAL);
    validate(TOOLS.find((t) => t.name === "fx_historical").outputSchema, result.structuredContent);
  } finally {
    restore();
  }
});

test("error tools/call stay errors and do not advertise structuredContent", async () => {
  const payload = await rpc("tools/call", { name: "fx_historical", arguments: { date: "not-a-date" } });
  assert.equal(payload.result.isError, true);
  assert.equal(payload.result.structuredContent, undefined);
  assert.match(payload.result.content[0].text, /YYYY-MM-DD/);
});

test("tools without an outputSchema keep the prior text-only success contract", async () => {
  const restore = mockFetch(async () => jsonResponse({ amount: 1.0, base: "USD", date: "2026-08-20", rates: { EUR: 0.85609 } }));
  try {
    const payload = await rpc("tools/call", { name: "fx_convert", arguments: { amount: 10, from: "USD", to: "EUR" } });
    assert.equal(payload.result.isError, false);
    assert.equal(payload.result.structuredContent, undefined);
    const parsed = JSON.parse(payload.result.content[0].text.replace(/\n\n\(.* free calls left today\)\s*$/, ""));
    assert.equal(parsed.from, "USD");
    assert.equal(parsed.to, "EUR");
    assert.equal(parsed.rate, 0.85609);
  } finally {
    restore();
  }
});

test("live currency-list fixture is accepted by the fx_currencies schema", () => {
  validate(TOOLS.find((t) => t.name === "fx_currencies").outputSchema, LIVE_CURRENCIES);
});

test("initialize negotiates only the supported modern revision", async () => {
  const ok = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }, 10, { "MCP-Protocol-Version": "ignored-on-initialize" });
  assert.equal(ok.result.protocolVersion, "2025-06-18");
  assert.deepEqual(ok.result.capabilities, { tools: {} });

  for (const protocolVersion of ["2025-03-26", "2024-11-05", "future-version"]) {
    const payload = await rpc("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.equal(payload.result.protocolVersion, "2025-06-18");
  }

  for (const protocolVersion of [undefined, null, 42, ""]) {
    const payload = await rpc("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.equal(payload.error.code, -32602);
    assert.match(payload.error.message, /Unsupported protocol version/);
  }
});

test("subsequent HTTP requests require the supported protocol version", async () => {
  const absent = await rpcResponse("tools/list", {}, 1, { "MCP-Protocol-Version": undefined });
  assert.equal(absent.status, 400);
  const old = await rpcResponse("tools/list", {}, 1, { "MCP-Protocol-Version": "2025-03-26" });
  assert.equal(old.status, 400);
  const invalid = await rpcResponse("tools/list", {}, 1, { "MCP-Protocol-Version": "bogus" });
  assert.equal(invalid.status, 400);
  const modern = await rpcResponse("tools/list", {});
  assert.equal(modern.status, 200);
});

test("modern projection and calls expose schemas only for modeled successful tools", async () => {
  const listed = await rpc("tools/list", {});
  assert.deepEqual(listed.result.tools.filter((tool) => tool.outputSchema).map((tool) => tool.name), ["fx_rates", "fx_historical", "fx_currencies"]);
  const restore = mockFetch(async () => jsonResponse({ base: "USD", date: "2026-08-20", rates: { EUR: 0.85609 } }));
  try {
    const called = await rpc("tools/call", { name: "fx_rates", arguments: {} });
    const textJson = called.result.content[0].text.replace(/\n\n\(.* free calls left today\)\s*$/, "");
    assert.deepEqual(JSON.parse(textJson), called.result.structuredContent);
    assert.match(called.result.content[0].text, /free calls left today/);
    validate(TOOLS[0].outputSchema, called.result.structuredContent);
  } finally { restore(); }
});

test("all modeled handlers fail closed on malformed HTTP-200 data", async () => {
  const cases = [
    null, [], {}, { _notfound: true }, Object.create({ poisoned: true }),
    Object.assign(Object.create(null), { base: "USD", date: "2024-06-03", rates: { EUR: 1 } }),
  ];
  for (const body of cases) {
    const restore = mockFetch(async () => ({ ok: true, status: 200, json: async () => body }));
    try {
      assert.ok((await runTool("fx_rates", {})).error);
      assert.ok((await runTool("fx_historical", { date: "2024-06-03" })).error);
      assert.ok((await runTool("fx_currencies", {})).error);
    } finally { restore(); }
  }
});

test("rates reject impossible dates, bad codes, empty/oversized maps, accessors, symbols, and non-finite numbers", async () => {
  const payloads = [
    { base: "USD", date: "2023-02-29", rates: { EUR: 1 } },
    { base: "US", date: "2024-02-29", rates: { EUR: 1 } },
    { base: "USD", date: "2024-02-29", rates: {} },
    { base: "USD", date: "2024-02-29", rates: { euro: 1 } },
    { base: "USD", date: "2024-02-29", rates: { EUR: NaN } },
    { base: "USD", date: "2024-02-29", rates: { EUR: Infinity } },
    { base: "USD", date: "2024-02-29", rates: Object.assign(Object.create({ poisoned: true }), { EUR: 1 }) },
    { base: "USD", date: "2024-02-29", rates: Object.defineProperty({}, "EUR", { enumerable: true, get: () => 1 }) },
    { base: "USD", date: "2024-02-29", rates: Object.assign({ EUR: 1 }, { [Symbol("x")]: 2 }) },
    { base: "USD", date: "2024-02-29", rates: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`${String.fromCharCode(65 + Math.floor(i / 26 / 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}${String.fromCharCode(65 + i % 26)}`, 1])) },
  ];
  for (const body of payloads) {
    const restore = mockFetch(async () => ({ ok: true, status: 200, json: async () => body }));
    try { assert.ok((await runTool("fx_rates", {})).error); } finally { restore(); }
  }
  assert.ok((await runTool("fx_historical", { date: "2024-02-30" })).error);
});

test("currencies reject empty/oversized names and maps, bad codes, prototypes, accessors, and symbols", async () => {
  const payloads = [
    {}, { EU: "Euro" }, { EUR: "" }, { EUR: "x".repeat(129) },
    Object.create({ EUR: "Euro" }),
    Object.defineProperty({}, "EUR", { enumerable: true, get: () => "Euro" }),
    Object.assign({ EUR: "Euro" }, { [Symbol("x")]: "bad" }),
    Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`${String.fromCharCode(65 + Math.floor(i / 26 / 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}${String.fromCharCode(65 + i % 26)}`, "Currency"])),
  ];
  for (const body of payloads) {
    const restore = mockFetch(async () => ({ ok: true, status: 200, json: async () => body }));
    try { assert.ok((await runTool("fx_currencies", {})).error); } finally { restore(); }
  }
});

test("full MCP malformed successes use controlled errors without structuredContent", async () => {
  for (const [name, args, body] of [
    ["fx_rates", {}, { base: "USD", date: "2024-13-01", rates: { EUR: 1 } }],
    ["fx_historical", { date: "2024-06-03" }, { base: "USD", date: "2024-06-03", rates: { EUR: null } }],
    ["fx_currencies", {}, { _notfound: true }],
  ]) {
    const restore = mockFetch(async () => jsonResponse(body));
    try {
      const payload = await rpc("tools/call", { name, arguments: args });
      assert.equal(payload.result.isError, true);
      assert.equal(payload.result.structuredContent, undefined);
      assert.equal(payload.result.content[0].type, "text");
    } finally { restore(); }
  }
});
