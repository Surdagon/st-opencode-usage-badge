# OpenCode Go + SillyTavern — краткий гайд

Подключение **OpenCode Go** к **SillyTavern**: прямой способ, локальный прокси
и сравнение с **OpenRouter**.

**Языки:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Ключ и эндпоинт

- Console → **Go** → создай ключ `oc_sk_...`.
- Go-эндпоинт: `https://opencode.ai/inference/go/openai/v1`.
- Не используй `/inference/openai/v1` — это обычный баланс, а не Go.
- Модели: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3` и др.
  Список: `https://opencode.ai/inference/go/v1/models`.

## 2. Прямое подключение

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: например, `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Без `x-opencode-session` будет `400 MissingSessionID`.

7. Additional body (YAML), желательно для reasoning-моделей:

   ```yaml
   reasoning_effort: low
   ```

8. Нажми **Connect** и отправь обычное сообщение, а не только Test Message.

## 3. Локальный прокси (рекомендуется)

Прокси не зависит от общего `api_key_custom` в ST, сам добавляет ключ и
`x-opencode-session`, убирает `logprobs` и ставит `reasoning_effort: low`.

1. В папке `proxy/` скопируй `config.example.json` в
   `opencode-go-proxy.config.json`.
2. Вставь ключ `oc_sk_...`.
3. Запусти `node opencode-go-proxy.js` или `start.bat`.
4. В ST: Base URL `http://127.0.0.1:8790/v1`, модель `glm-5.3`, ключ пустой.

## 4. Кэш и стоимость

Расширение показывает под сообщением:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (прайс).
- Бейдж **Go** = `opencode.allowance` (списание с лимита Go).
- Они могут отличаться: Gemini 4 Argon — 2×, Kimi K3 — ~4×.
- В настройках выбери **List price (Console)** или **Both**.

## 5. Частые ошибки

| Ошибка | Причина | Решение |
| --- | --- | --- |
| `400 MissingSessionID` | нет `x-opencode-session` | добавь заголовок или прокси |
| `401 Invalid credential` | старый/отозванный ключ | используй последний ключ |
| `402 Insufficient account funds` | не Go-эндпоинт | `/inference/go/openai/v1` |
| Пустой ответ | reasoning съел токены | `reasoning_effort: low`, больше `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: дешевле при наличии подписки, хорошие GLM/Kimi/DeepSeek, но нужен
  session-хедер/прокси, ключи могут инвалидироваться, сервис заявлен под
  coding-агентов.
- **OpenRouter**: нативная поддержка ST, много моделей, без прокси, но
  pay-per-token и кэш зависит от провайдера.
- **Выбор**: Go + прокси — если уже платишь за Go и используешь GLM/Kimi/DeepSeek;
  OpenRouter — для общего RP и простоты.

Полный английский гайд: [OPENCODE-GO.md](OPENCODE-GO.md)  
Репозиторий: https://github.com/Surdagon/st-opencode-usage-badge  
Каталог: https://github.com/SillyTavern/SillyTavern-Content/pull/66
