# OpenCode Go + SillyTavern — Kurzanleitung

**OpenCode Go** mit **SillyTavern** verbinden: direkte Verbindung, lokaler Proxy
und Vergleich mit **OpenRouter**.

**Sprachen:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Schlüssel und Endpoint

- Console → **Go** → API-Schlüssel `oc_sk_...` erstellen.
- Go-Endpoint: `https://opencode.ai/inference/go/openai/v1`.
- Nicht `/inference/openai/v1` verwenden — das ist normales Guthaben, nicht Go.
- Modelle: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3` usw.
  Liste: `https://opencode.ai/inference/go/v1/models`.

## 2. Direkte Verbindung

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: z. B. `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Ohne `x-opencode-session` kommt `400 MissingSessionID`.

7. Additional body (YAML), empfohlen für Reasoning-Modelle:

   ```yaml
   reasoning_effort: low
   ```

8. **Connect** drücken und eine echte Nachricht senden, nicht nur Test Message.

## 3. Lokaler Proxy (empfohlen)

Der Proxy hängt nicht am gemeinsamen `api_key_custom` von ST, fügt Schlüssel und
`x-opencode-session` hinzu, entfernt `logprobs` und setzt `reasoning_effort: low`.

1. In `proxy/` die `config.example.json` nach `opencode-go-proxy.config.json`
   kopieren.
2. Den Schlüssel `oc_sk_...` eintragen.
3. `node opencode-go-proxy.js` oder `start.bat` starten.
4. In ST: Base URL `http://127.0.0.1:8790/v1`, Modell `glm-5.3`, Key leer.

## 4. Cache und Kosten

Die Extension zeigt unter der Nachricht:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (Listenpreis).
- Badge **Go** = `opencode.allowance` (Verbrauch des Go-Limits).
- Sie können abweichen: Gemini 4 Argon 2×, Kimi K3 ~4×.
- In den Einstellungen **List price (Console)** oder **Both** wählen.

## 5. Häufige Fehler

| Fehler | Ursache | Lösung |
| --- | --- | --- |
| `400 MissingSessionID` | `x-opencode-session` fehlt | Header ergänzen oder Proxy nutzen |
| `401 Invalid credential` | alter/widerrufener Key | neuesten Key verwenden |
| `402 Insufficient account funds` | kein Go-Endpoint | `/inference/go/openai/v1` |
| Leere Antwort | Reasoning hat die Tokens verbraucht | `reasoning_effort: low`, mehr `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: günstiger mit Abo, gute GLM/Kimi/DeepSeek-Modelle, aber Session-Header/
  Proxy nötig, Keys können ungültig werden, für Coding-Agenten gedacht.
- **OpenRouter**: native ST-Unterstützung, viele Modelle, kein Proxy, aber
  Pay-per-Token und Cache je nach Anbieter.
- **Wahl**: Go + Proxy, wenn du Go bereits zahlst und GLM/Kimi/DeepSeek nutzt;
  OpenRouter für allgemeines RP und Einfachheit.

Vollständige englische Anleitung: [OPENCODE-GO.md](OPENCODE-GO.md)  
Repository: https://github.com/Surdagon/st-opencode-usage-badge  
Katalog: https://github.com/SillyTavern/SillyTavern-Content/pull/66
