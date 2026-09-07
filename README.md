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

| | Free | Pro | Team |
|---|---|---|---|
| Price | $0 | $15/mo | $49/mo |
| Calls included | 100 per day | 10,000 per month | 50,000 per month |
| Past the allowance | refused until 00:00 UTC | $5 per 1,000 | $5 per 1,000 |
| Most you can ever be billed | $0 | $115/mo | $149/mo |
| Signup | none, no key | email + card | email + card |

A paid allowance is shared across all nine Datakoot servers rather than being
nine separate buckets, and only a `tools/call` counts — connecting and listing
tools are free. Full terms at [datakoot.com/pricing](https://datakoot.com/pricing).

Part of [Datakoot](https://datakoot.com) — keyless intelligence APIs for AI agents.
