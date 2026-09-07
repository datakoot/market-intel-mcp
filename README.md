# Market Intel MCP — by Datakoot

Live and historical foreign-exchange rates for AI agents — as MCP tools your agent can call mid-task. No API keys.

## Tools

| Tool | What it does | Source |
|---|---|---|
| `fx_rates` | Latest exchange rates for a base currency | ECB via Frankfurter |
| `fx_convert` | Convert an amount between two currencies at the latest ECB reference rate | ECB via Frankfurter |
| `fx_historical` | Exchange rates for a base currency on a specific past date | ECB via Frankfurter |
| `fx_timeseries` | Exchange-rate history over a date range, for trend analysis | ECB via Frankfurter |
| `fx_currencies` | Supported currencies and their names | ECB via Frankfurter |

No API keys required for any tool.

`fx_rates`, `fx_historical`, and `fx_currencies` advertise an MCP `outputSchema` and return matching `structuredContent` on success. Error results stay errors and are not schema-validated. The JSON text body is unchanged.

## Quick start

```
claude mcp add --transport http market-intel https://market.datakoot.com/mcp
```

Or point any MCP client at `https://market.datakoot.com/mcp`.

## Try it in 10 seconds — no key, no signup

Paste this into a terminal:

```bash
curl -s https://market.datakoot.com/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "fx_rates", "arguments": {"base": "USD"}}}'
```

You get live USD foreign-exchange rates (European Central Bank reference data) — no API key, nothing to sign up for.

Or point any MCP client at the URL and just ask your agent, in plain language:

- "Convert 500 USD to euros at today's rate."
- "How has USD/JPY moved over the last month?"


## Data & attribution

Rates are European Central Bank reference rates, served via the free, open-source [Frankfurter](https://frankfurter.dev) API. ECB reference rates are published for information and are not intended for use as transaction benchmarks.

Looking for other data? For cryptocurrency prices see **Base Intel**, and for company financials and SEC filings see **Filings Intel** — both at [datakoot.com](https://datakoot.com).

## Pricing

**Free** — 100 calls a day, keyless, no signup. **Pro** — $15/mo including 50,000 calls a month with no daily limit; one key unlocks all nine Datakoot servers. Go over the monthly allowance and you drop to free-tier speed for the rest of the month, or top up — never cut off, no metered overage. Full terms: [datakoot.com/pricing](https://datakoot.com/pricing).

A paid allowance is shared across all nine Datakoot servers rather than being
nine separate buckets, and only a `tools/call` counts — connecting and listing
tools are free. Full terms at [datakoot.com/pricing](https://datakoot.com/pricing).

## Development

```
node --test
```

Part of [Datakoot](https://datakoot.com) — keyless intelligence APIs for AI agents.
