# Liferay AI Benchmark Fragment

A Liferay Fragment that benchmarks LLM APIs from inside the browser: time to first
token (TTFT), throughput, total response time, cost, capabilities, and a side-by-side
comparison across providers. Built with Clay/Lexicon — no external runtime dependencies.

> **Status:** demo / candidate for native integration.
> Importable as a Fragment Collection ZIP; the code is structured so a Liferay
> developer can lift it into a module, an Object action, or a Client Extension
> with minimal rework.

---

## Features

- **10 built-in providers** — OpenAI, Anthropic, Google Gemini, Mistral, Groq,
  DeepSeek, xAI, Cohere, OpenRouter, Together AI, HuggingFace, and
  **Ollama (local)** with the 8 most common sub-8B models pre-configured.
- **Custom APIs** — register any OpenAI-compatible endpoint (Ollama, vLLM,
  LM Studio, a Liferay-hosted proxy…) with its own name and pricing.
- **Streaming-aware metrics** — TTFT is captured from the first content token
  on the wire via `ReadableStream`, not from response completion.
- **Live cards** — each running model gets its own Clay card, streamed in real time.
  Cards turn green on success, red on error.
- **Comparison view** — pick N models, see avg TTFT / total time / throughput / cost
  as SVG bar charts (only successful runs count; N/A shown when data is missing).
  Capability matrix: vision, audio, function calls, JSON mode, context window, $/1M.
- **Local-only persistence** — everything goes to `localStorage` under a
  configurable key. Export history as JSON at any time.
- **Simulation mode** — generates realistic per-provider numbers without an API key.
- **Clay-native UI** — `card`, `nav nav-underline`, `form-control`, `btn`,
  `table-list`, `badge`. No custom design language; inherits the active Lexicon theme.

---

## What gets measured per run

| Metric             | How it's captured                                                    |
|--------------------|----------------------------------------------------------------------|
| TTFT (ms)          | `performance.now()` from `fetch()` start to first content delta      |
| Total time (ms)    | `performance.now()` from `fetch()` start to stream end               |
| Input tokens       | Provider `usage` field, fallback: ~4 chars/token heuristic           |
| Output tokens      | Provider `usage` field, fallback: heuristic                          |
| Throughput (tok/s) | `outputTokens / (total − ttft) * 1000`                               |
| Cost (USD est.)    | `(in/1M)×priceIn + (out/1M)×priceOut`                               |
| Capabilities       | Static per-model (text, vision, audio, functions, JSON, streaming)   |
| Context window     | Static per-model                                                     |
| Status             | `ok` / `error` (with message)                                        |
| Simulated          | `true` when the run did not hit the real network                     |

---

## Install

### Option A — Import as a Fragment Collection (zero code)

1. Download `ai-benchmark-collection.zip` from this repo (or build it yourself —
   see below).
2. In Liferay: **Site Administration → Design → Fragments → Import** and upload the ZIP.
3. Drop the **AI Benchmark** fragment onto any Content Page or Page Template.
4. Open the fragment configuration panel to set the title, default prompt,
   storage key, and whether simulation mode / custom APIs are enabled.

### Option B — Build the ZIP locally

```bash
cd ai-benchmark-collection
zip -r ../ai-benchmark-collection.zip collection.json fragments/
```

### Option C — Develop with the Fragments CLI

```bash
npm install -g liferay-fragments
cd ai-benchmark-collection
liferay-fragments preview   # local preview in the browser
liferay-fragments import    # push to a running Liferay instance
```

---

## Streaming protocol reference

| Provider family             | Protocol       | Notes                                                        |
|-----------------------------|----------------|--------------------------------------------------------------|
| OpenAI, Mistral, Groq, DeepSeek, xAI, OpenRouter, Together AI, HuggingFace, Ollama | SSE | `data: {...}` lines; `data: [DONE]` to end; `stream_options.include_usage` for token counts |
| Anthropic                   | SSE            | `event:` + `data:` pairs; `content_block_delta` for tokens; requires `anthropic-dangerous-direct-browser-access: true` |
| Google Gemini               | SSE (`?alt=sse`) | `candidates[0].content.parts[].text`; `usageMetadata` at end |
| Cohere                      | NDJSON         | `event_type: "text-generation"` / `"stream-end"`             |

---

## CORS and API keys

API keys are stored only in the browser's `localStorage` for the page origin.
Real calls go directly from the browser to the provider.

| Provider        | Browser-direct?                                                   |
|-----------------|-------------------------------------------------------------------|
| Anthropic       | Yes (`anthropic-dangerous-direct-browser-access: true`)           |
| Groq            | Yes                                                               |
| Google Gemini   | Yes (API key via query param)                                     |
| OpenRouter      | Yes                                                               |
| Together AI     | Yes                                                               |
| HuggingFace     | Yes                                                               |
| Ollama (local)  | Yes — requires `OLLAMA_ORIGINS=*` (see below)                     |
| OpenAI          | Often blocked; recommend a proxy                                  |
| Mistral         | Often blocked; recommend a proxy                                  |
| DeepSeek        | Often blocked; recommend a proxy                                  |
| xAI             | Check current policy                                              |
| Cohere          | Often blocked; recommend a proxy                                  |

### Ollama CORS setup

Add `OLLAMA_ORIGINS=*` to the Ollama systemd service:

```bash
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
```

```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

For anything CORS-blocked, register a **Custom API** pointed at a lightweight
Liferay proxy. A 20-line Headless Object action or a Client Extension servlet
is enough — forward the request, inject the key from a server-side secret,
stream the response back.

---

## Configuration fields (per fragment instance)

| Field             | Default                                                      |
|-------------------|--------------------------------------------------------------|
| Title             | `AI API Benchmark`                                           |
| Subtitle          | `Compare latency, throughput, cost and capabilities…`        |
| Default Prompt    | `Explain quantum entanglement in one short paragraph.`       |
| Allow Custom APIs | `true`                                                       |
| Simulation Mode   | `true`                                                       |
| LocalStorage Key  | `liferay-ai-benchmark`                                       |
| Max History Rows  | `50`                                                         |

---

## Adding a built-in provider

Append an entry to `BUILTIN_PROVIDERS` in `fragments/ai-benchmark/index.js`:

```js
{
  id: 'myprovider',
  name: 'My Provider',
  driver: 'openai',                       // openai | anthropic | gemini | cohere
  baseUrl: 'https://api.example.com/v1/chat/completions',
  authHeader: 'Authorization',
  authPrefix: 'Bearer ',
  models: [
    {
      id: 'my-model-7b',
      label: 'My Model 7B',
      cap: { text:1, vision:0, audio:0, functions:1, json:1, streaming:1 },
      ctx: 32768,
      priceIn: 0.20,   // USD per 1M input tokens
      priceOut: 0.60   // USD per 1M output tokens
    }
  ]
}
```

If the provider's streaming format isn't covered by an existing driver, add a
`buildRequest` + `parseLine` entry to the `drivers` map.

---

## Path to native integration

| Step | What to do                                                                   |
|------|------------------------------------------------------------------------------|
| 1    | Move `BUILTIN_PROVIDERS` into a **Liferay Object** so admins edit models and prices from the UI |
| 2    | Persist runs to a **BenchmarkRun Object** for cross-user history + Headless API |
| 3    | Front LLM calls through a **Client Extension** to keep keys server-side and bypass CORS |

Keep the `localStorage` path as a fallback so the fragment stays demoable
in isolation.

---

## File layout

```
ai-benchmark-collection/
├── collection.json                  # collection metadata
└── fragments/
    └── ai-benchmark/
        ├── fragment.json            # manifest (type: component)
        ├── configuration.json       # editable fields (title, prompt, flags…)
        ├── index.html               # FreeMarker + Clay markup
        ├── index.css                # layout helpers; uses Clay CSS variables
        └── index.js                 # IIFE; all logic — providers, drivers, UI
```

---

## License

MIT.
