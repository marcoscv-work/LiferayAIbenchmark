# CLAUDE.md

Guidance for Claude Code (or any AI coding assistant) working in this repository.

## What this project is

A single Liferay **Fragment Collection** containing one fragment, **AI Benchmark**,
that benchmarks LLM APIs from the browser (TTFT, throughput, total time, cost,
capabilities, comparison charts, history). Demo today, candidate for native
integration.

## Repo layout (only what matters)

```
ai-benchmark-collection/        # Importable Fragment Collection (zip THIS folder)
├── collection.json             # Collection metadata
└── fragments/ai-benchmark/
    ├── fragment.json           # Fragment manifest (component type)
    ├── configuration.json      # Editable fields shown in Liferay's config panel
    ├── index.html              # FreeMarker + Clay markup; uses ${configuration.*}
    ├── styles.css              # Layout/components NOT shipped by Clay; uses Clay vars
    └── main.js                 # IIFE; reads `fragmentElement` + `configuration` globals
```

There is no build step. Files are imported as-is.

## Conventions

- **Clay first.** Use existing Clay classes (`card`, `btn`, `form-control`,
  `table-list`, `nav-underline`, `badge`, `aibench__pill`-style helpers only where
  Clay has nothing). Do not pull in Bootstrap-only classes.
- **Lexicon tokens.** When adding CSS, reference Clay CSS variables
  (`--primary`, `--gray-300`, `--success`, …) with sane fallbacks. Never hard-code
  theme colors.
- **Namespace DOM.** Liferay provides `fragmentEntryLinkNamespace`. The template
  aliases it as `[#assign ns = fragmentEntryLinkNamespace!"aibench"/]` and uses
  `${ns}` in `id` attributes only. Querying inside JS goes through `fragmentElement`
  + `[data-control="…"]` / `[data-action="…"]` selectors — never `document.getElementById`.
- **No build, no deps.** Vanilla ES5-friendly JS. No imports, no bundler. Use
  `fetch` + `ReadableStream` for streaming. SVG charts are hand-rolled.
- **State.** All persistent state lives in `localStorage` under
  `configuration.storageKey` (default `liferay-ai-benchmark`). Shape:
  `{ keys: {providerId: apiKey}, customApis: [...], runs: [...] }`.
- **Re-render safety.** `main.js` guards against double init with
  `fragmentElement.dataset.aibenchInit`. The fragment must survive Liferay's
  edit-mode rerenders.

## Adding a new built-in provider

1. Append an entry to `BUILTIN_PROVIDERS` in `main.js`. Required fields:
   `id`, `name`, `driver` (`'openai' | 'anthropic' | 'gemini' | 'cohere'`),
   `baseUrl`, `authHeader`, `authPrefix`, `models[]`.
2. Each model needs `id`, `label`, `cap` (text/vision/audio/functions/json/streaming
   as 1|0), `ctx`, `priceIn`, `priceOut` (USD per 1M tokens).
3. If the API isn't covered by the existing drivers, add a new driver to the
   `drivers` map with `buildRequest(provider, model, prompt, system, opts)` and
   `parseLine(rawLine)` returning `{ delta?, done?, usage? }`.

## Adding a new metric

1. Capture it inside `realRun` / `simulateRun` and store on `run`.
2. Persist via `finalize(run, onProgress)` (no schema migration needed — history
   is shape-tolerant).
3. Render in `makeLiveCard` (the live card during the run) and in
   `refreshHistory` (the table).
4. If it makes sense to compare across models, plot it in `renderCompareCharts`
   by calling `renderBarChart('Title', data, unit, digits)`.

## Streaming protocol cheatsheet

- **OpenAI / Mistral / Groq / DeepSeek / xAI / custom** — SSE; each `data: {...}`
  line carries `choices[0].delta.content`. Final `data: [DONE]`. `usage` arrives
  when `stream_options.include_usage = true` is set in the request.
- **Anthropic** — SSE with `event:` lines plus `data: {...}`. Content deltas come
  as `type: "content_block_delta"`. Requires header
  `anthropic-dangerous-direct-browser-access: true` for browser use.
- **Gemini** — `?alt=sse` SSE; `candidates[0].content.parts[].text`. `usageMetadata`
  at the end.
- **Cohere** — newline-delimited JSON (not SSE). `event_type: "text-generation"`
  for tokens, `stream-end` with `meta.billed_units` for usage.

## Path to native integration (in priority order)

1. **Move providers to a Liferay Object** so admins edit models/prices without redeploy.
2. **Persist runs to an Object** for cross-user history + Headless API exposure.
3. **Proxy real LLM calls through a Client Extension** to keep keys server-side
   and bypass CORS uniformly. The fragment already supports this: register the
   proxy URL as a Custom API.

When implementing any of these, do NOT remove the localStorage path — keep it as
a fallback so the fragment stays demoable in isolation.

## Things to avoid

- Adding any JS framework (React/Vue/Lit) or bundler. This must stay
  zero-dependency until integration is decided.
- Reading from `document` or other fragments. Stay scoped to `fragmentElement`.
- Storing API keys outside `localStorage` from the fragment. If keys need to live
  server-side, that's the "proxy via Client Extension" task — don't half-ship it.
- Hard-coded English strings outside `configuration.json` defaults. If we
  localize later, add `Liferay.Language.get('…')` calls but keep simulation/demo
  copy untouched.

## How to test locally

There is no automated test suite. Manual flow:

1. Install fragments CLI: `npm i -g liferay-fragments`.
2. `cd ai-benchmark-collection && liferay-fragments preview` to render in the
   browser without Liferay.
3. Or `liferay-fragments import` against a running DXP/Portal to test inside a
   real page. Repeat after each edit to `index.html` / `main.js` / `styles.css`.
4. Toggle **Simulation mode** on the fragment to exercise the UI without keys.
5. Run a side-by-side benchmark with ≥2 models, then open the **Compare** tab to
   verify charts. Open **History** to verify persistence; reload the page —
   history must survive.

## Useful absolute paths

- Fragment source: `ai-benchmark-collection/fragments/ai-benchmark/`
- Built-in provider registry: `ai-benchmark-collection/fragments/ai-benchmark/main.js`
  (search for `BUILTIN_PROVIDERS`)
- Driver implementations: same file, search for `var drivers = {`
- Storage shape: same file, search for `var storage = {`
