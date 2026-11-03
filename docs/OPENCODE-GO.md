# OpenCode Go + SillyTavern

A practical guide to connecting **OpenCode Go** to **SillyTavern**, including the
required `x-opencode-session` header, a small local proxy for a stable setup, and
a comparison with **OpenRouter**.

> **Коротко по-русски:** Go-эндпоинт — `https://opencode.ai/inference/go/openai/v1`.
> Нужен ключ `oc_sk_...` из Console и заголовок `x-opencode-session`, иначе будет
> `400 MissingSessionID`. Проще всего поставить локальный прокси из `proxy/` и
> указать в ST `http://127.0.0.1:8790/v1`. Для OpenRouter всё то же самое, но без
> прокси и с более широким выбором моделей.

## What you need

- SillyTavern 1.12+ (any recent release should work).
- An OpenCode Go subscription and an API key from the Console.
- Node.js 18+ **only** if you use the local proxy.
- Git **only** if you install the extension from the repository.

## 1. Get an OpenCode Go key

1. Open the [OpenCode Console](https://opencode.ai/console).
2. Subscribe to **Go** (or **Go Plus** / **Go Teams**).
3. Create/copy an API key. It starts with `oc_sk_...`.
4. Keep the latest key. In our testing, creating a new key invalidated the
   previous one; if you rotate keys, update SillyTavern or the proxy.

> The Go endpoint is **not** the same as the regular pay-as-you-go endpoint.
> Go: `https://opencode.ai/inference/go/openai/v1`
> Regular balance: `https://opencode.ai/inference/openai/v1` (returns `402` if
> the balance is empty; it does not use your Go allowance).

## 2. Pick a model

Fetch the live list:

```bash
curl https://opencode.ai/inference/go/v1/models \
  -H "Authorization: Bearer oc_sk_..."
```

Common Go model IDs (availability can change):

| Model ID | Notes |
| --- | --- |
| `glm-5.3` | strong general/RP model, reasoning |
| `glm-5.3-flash` | cheaper/faster GLM |
| `kimi-k3` | strong long-context RP |
| `kimi-k3.1-pro` | higher-end Kimi |
| `deepseek-v4.1-flash` | very cheap, good for casual RP |
| `deepseek-v4-pro` | stronger DeepSeek |
| `minimax-m3` | good RP, usually no reasoning tokens |
| `minimax-m3.1-flash` | cheaper MiniMax |
| `qwen3.8-flash` / `qwen3.8-max` | Qwen family |
| `claude-haiku-5-5` | Anthropic via Go |
| `gpt-6-luna` | OpenAI via Go |

For roleplay, `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, and `minimax-m3` are
good starting points. Reasoning models spend output tokens on hidden reasoning;
see the troubleshooting section.

## 3. Connect directly (simple setup)

In SillyTavern:

1. **Connection → Chat Completion**.
2. **Chat Completion Source**: `Custom (OpenAI-compatible)`.
3. **Custom Endpoint (Base URL)**:

   ```text
   https://opencode.ai/inference/go/openai/v1
   ```

4. **Custom API Key**: your `oc_sk_...` key.
5. **Model ID**: e.g. `glm-5.3`.
6. Open **Additional Parameters** and add this header (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   `x-opencode-session` is **required** by the Go endpoint. Without it you get
   `400 MissingSessionID`. A stable value is fine; the proxy below generates a
   per-chat value automatically.

7. Optional, recommended for reasoning models — add to the request body (YAML):

   ```yaml
   reasoning_effort: low
   ```

8. Click **Connect**, then send a real chat message (not just “Test Message”;
   see troubleshooting).

SillyTavern appends `/chat/completions` automatically. The base URL must end at
`.../v1`, not at `.../chat/completions`.

### Shared custom key warning

SillyTavern has a single active `api_key_custom` secret shared by all custom
OpenAI-compatible providers. If you switch between OpenCode, LimitDeckAI,
Player2, etc., the active key can change and OpenCode starts returning `401`.
Connection profiles can store a profile-specific key, but switching profiles can
still rotate the active secret.

If you use more than one custom provider, the proxy below is the stable option:
it does not depend on SillyTavern's active custom key at all.

## 4. Local proxy (recommended stable setup)

The proxy:

- injects the current `oc_sk_...` key;
- adds `x-opencode-session` automatically, derived from the chat prefix;
- adds `reasoning_effort: low` (configurable);
- removes `logprobs`/`verbosity` fields that bloat or slow responses;
- proxies `/v1/models` and `/v1/chat/completions`;
- supports normal JSON and SSE streaming.

Files:

```text
proxy/
  opencode-go-proxy.js
  config.example.json
  start.bat
```

Setup:

1. Go to the `proxy/` folder.
2. Copy the example config:

   ```bash
   cp config.example.json opencode-go-proxy.config.json
   ```

   On Windows: `copy config.example.json opencode-go-proxy.config.json`.

3. Put your key into `opencode-go-proxy.config.json`:

   ```json
   {
     "apiKey": "oc_sk_...",
     "port": 8790,
     "host": "127.0.0.1",
     "upstream": "https://opencode.ai/inference/go/openai/v1",
     "modelsUrl": "https://opencode.ai/inference/go/v1/models",
     "reasoningEffort": "low",
     "sessionPrefix": "st-oc",
     "userAgent": "sillytavern-opencode-proxy/1.0"
   }
   ```

4. Start it:

   ```bash
   node opencode-go-proxy.js
   ```

   Windows: double-click `start.bat` or run it from a terminal.

5. In SillyTavern:

   - **Base URL**: `http://127.0.0.1:8790/v1`
   - **API Key**: leave empty (the proxy supplies the real key).
   - **Model ID**: `glm-5.3` (or another Go model).
   - **Custom headers**: none needed.
   - **Additional body**: none needed; the proxy adds `reasoning_effort`.

6. Send a real message.

The proxy listens on `127.0.0.1` only. Its config contains your API key; do not
commit `opencode-go-proxy.config.json` and do not expose the port publicly.

## 5. Cache and cost tracking

The companion extension shows a badge under each message:

```text
⚡ 97% · Go $0.0406
```

- `⚡ 97%` — prompt cache hit rate;
- `Go $0.0406` — Go allowance: the amount counted against the Go monthly limit;
- tooltip — cached tokens, input/output/reasoning, Go allowance, list price;
- per-swipe usage is preserved;
- optional chat summary above the chat and in the extension settings.

It also works with OpenRouter (`usage.cost` + `cached_tokens`).

### Console vs badge

The OpenCode Console's **Cost** column matches `opencode.list_cost` (the list
price). The badge's `Go` value is `opencode.allowance`, which is what counts
against the Go plan limit. The two can differ:

- Gemini 4 Argon (50% promo): list price `$0.1696`, Go allowance `$0.3391` — **2×**;
- Kimi K3: list price `$0.0101`, Go allowance `$0.0406` — **~4×**.

The tooltip now shows both and the multiplier. If you want the badge to match
the Console exactly, set **Badge cost → List price (Console)**; **Both** shows
both numbers.

Repository: https://github.com/Surdagon/st-opencode-usage-badge

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `400 MissingSessionID` | no `x-opencode-session` header | add the header or use the proxy |
| `401 Invalid credential` | old/revoked key, or wrong active custom key | use the latest `oc_sk_...`; check the active key; prefer the proxy |
| `402 Insufficient account funds` | using the regular (non-Go) endpoint or empty balance | use `https://opencode.ai/inference/go/openai/v1` |
| Badge shows `Go $0.339`, Console shows `$0.1696` | badge shows `opencode.allowance`, Console shows `opencode.list_cost` | set **Badge cost → List price (Console)** or **Both** |
| `404` / HTML “Not Found” | URL is missing the path or includes `/chat/completions` twice | base URL must end at `.../go/openai/v1` |
| `400 model must be a non-empty string` | model field is empty | enter a model ID, e.g. `glm-5.3` |
| Empty answer, `finish_reason: length` | reasoning consumed all output tokens | set `reasoning_effort: low`, raise max response length, or use `minimax-m3` |
| `Test Message` fails but chat works | test prompt is tiny and reasoning eats the budget | use a real chat message; don't judge by Test Message alone |
| Works, then breaks after switching profiles | SillyTavern rotated the shared custom key | use a profile-specific key or the proxy |
| No cache numbers with streaming | provider sends no final usage chunk | use non-streaming or the proxy |

## 7. OpenCode Go vs OpenRouter

| | OpenCode Go | OpenRouter |
| --- | --- | --- |
| Billing | monthly Go plan with per-model allowances; cached reads cheaper | pay-as-you-go credits; per-model pricing |
| Models | curated coding/general models (GLM, Kimi, DeepSeek, MiniMax, Qwen, Claude Haiku, GPT Luna, Gemini Argon) | hundreds of models/providers, frequent additions |
| SillyTavern integration | custom OpenAI-compatible endpoint; requires `x-opencode-session`; proxy recommended | native OpenRouter source |
| Cache | prompt caching supported; usage reports `cache_read` and Go allowance | prompt caching depends on provider; usage reports `cached_tokens` and cost |
| Setup | key + header or local proxy; shared custom-key quirks | paste key, select model |
| Key management | rotating keys can invalidate the previous one; use the latest | keys are stable/managed in the dashboard |
| Reliability | direct provider access; newer service | multi-provider routing/fallback, mature ecosystem |
| Free models | free models are available only inside OpenCode, not from external clients | free models can be used through the API |
| Intended use | designed for coding agents; traffic is monitored for abuse | general-purpose model routing |
| Best for | users already paying for Go who mainly use GLM/Kimi/DeepSeek and accept the intended-use gray area | general RP, broad model choice, native ST integration, less setup |

### Go pros

- good value if you already pay for Go;
- cheap cached input on models with prompt caching;
- strong coding/general models that also work well for RP;
- one key for several model families.

### Go cons

- intended for coding-agent traffic; using it as a general RP backend may be
  considered outside its intended use;
- requires `x-opencode-session`;
- keys can rotate/invalidate;
- SillyTavern's shared custom key makes multi-provider setups fragile;
- fewer models than OpenRouter;
- no native SillyTavern provider.

### OpenRouter pros

- native SillyTavern support;
- huge model selection;
- one key and one billing dashboard;
- provider routing/fallback;
- no special session header or proxy.

### OpenRouter cons

- pay-per-token credits can add up;
- prices/availability vary by provider;
- cache support depends on the provider/model;
- privacy/retention depends on the upstream provider.

## 8. Which should I use?

- **Already paying for OpenCode Go and mostly using GLM/Kimi/DeepSeek for RP** →
  Go + the local proxy. It is cheap, fast, and the extension shows cache/cost.
  Be aware of the intended-use gray area.
- **Want the simplest native SillyTavern setup, many models, and general RP** →
  OpenRouter.
- **Need both** → use connection profiles, but prefer the proxy for OpenCode so
  the shared custom key cannot break it.

## Links

- [OpenCode Go docs](https://opencode.ai/v2/docs/console/go/)
- [OpenCode inference API](https://opencode.ai/v2/docs/console/api/inference/)
- [OpenRouter docs](https://openrouter.ai/docs)
- [OpenCode Usage Badge](https://github.com/Surdagon/st-opencode-usage-badge)
- [Official catalog PR](https://github.com/SillyTavern/SillyTavern-Content/pull/66)
