# SillyTavern OpenCode Usage Badge

A small SillyTavern extension that shows **prompt-cache hit rate** and
**per-message cost** for OpenCode Go, OpenRouter, and other chat-completion
providers that return a standard `usage` object.

![badge example](https://img.shields.io/badge/badge-%E2%9A%A1%2097%25%20%C2%B7%20Go%20%240.0406-blue)

## Features

- cache hit rate under every generated message (`⚡ 97%`);
- cost per message (Go allowance, actual cost, or list price);
- optional chat summary above the chat and in the extension settings;
- per-swipe usage (each swipe keeps its own cache/cost data);
- tooltip with input/output/reasoning tokens, cached tokens, Go limit and list price;
- works with OpenRouter-style `usage.cost` and `prompt_tokens_details.cached_tokens`;
- no external requests, no API keys stored by the extension.

## Example

```text
⚡ 97% · Go $0.0406
```

Tooltip:

```text
kimi-k3
Cache: 20736 / 21275 input (97%)
Input: 539 new + 20736 cached
Output: 154 (reasoning 17)
Go limit: $0.0406
List price: $0.0101
```

Chat summary above the chat:

```text
⚡ 65% · total Go $0.336 · last Go $0.0406
```

## Installation

1. Clone this repository into your SillyTavern third-party extensions folder:

   ```bash
   cd SillyTavern/public/scripts/extensions/third-party
   git clone https://github.com/Surdagon/st-opencode-usage-badge.git
   ```

   Or download the ZIP and extract it into
   `public/scripts/extensions/third-party/st-opencode-usage-badge`.

2. Reload SillyTavern (`Ctrl+F5`).
3. The extension is enabled by default. If needed, enable it under
   **Extensions → OpenCode Usage Badge**.

## Settings

**Extensions → OpenCode Usage Badge**

- show/hide badges;
- badge cost: `Auto` / `Go limit` / `List price` / `Both`;
- summary placement: above chat left / right / center / off;
- show/hide chat summary in settings;
- show/hide list price in tooltips.

## How it works

The extension wraps `window.fetch` and reads the `usage` object from
`/api/backends/chat-completions/generate` responses. It stores the usage in the
message's `extra` data (and in `swipe_info` for swipes), then renders a small
badge below the message.

Supported fields:

- cache: `prompt_tokens_details.cached_tokens`,
  `cache_read_input_tokens`, `prompt_cache_hit_tokens`;
- cost: `cost`, `cost_details.upstream_inference_cost`,
  `opencode.allowance`, `opencode.list_cost`;
- tokens: OpenAI-style `prompt_tokens` / `completion_tokens`, plus
  Anthropic-style `input_tokens` / `output_tokens`.

## OpenCode Go notes

OpenCode Go requires a stable `x-opencode-session` header. If your client does
not send it, use a local proxy in front of
`https://opencode.ai/inference/go/openai/v1`. This extension only reads the
resulting `usage`; it does not manage credentials or sessions.

## OpenRouter notes

OpenRouter returns OpenAI-style usage, including `usage.cost` and
`prompt_tokens_details.cached_tokens` for providers that support caching.
Models/providers that do not report cache will show `⚡ —` but still show cost.
For streaming responses, usage must be present in the final SSE chunk; otherwise
use non-streaming.

## Limitations

- Only messages generated after installation have usage data.
- Quiet/test generations are ignored.
- Streaming usage depends on the provider sending a final usage chunk.
- The badge is informational; it does not change generation settings.

## Development

Files:

- `index.js` — fetch hook, usage parsing, badges, summary, settings;
- `style.css` — badge, top bar and settings styles;
- `manifest.json` — SillyTavern extension manifest.

No build step, no dependencies.

## License

MIT
