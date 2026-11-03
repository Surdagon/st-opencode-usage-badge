# OpenCode Go + SillyTavern — guía rápida

Conecta **OpenCode Go** con **SillyTavern**: conexión directa, proxy local y
comparación con **OpenRouter**.

**Idiomas:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Clave y endpoint

- Console → **Go** → crea una clave `oc_sk_...`.
- Endpoint Go: `https://opencode.ai/inference/go/openai/v1`.
- No uses `/inference/openai/v1`: es el saldo normal, no Go.
- Modelos: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3`, etc.
  Lista: `https://opencode.ai/inference/go/v1/models`.

## 2. Conexión directa

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: por ejemplo, `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Sin `x-opencode-session` recibirás `400 MissingSessionID`.

7. Additional body (YAML), recomendado para modelos con razonamiento:

   ```yaml
   reasoning_effort: low
   ```

8. Pulsa **Connect** y envía un mensaje normal, no solo Test Message.

## 3. Proxy local (recomendado)

El proxy no depende de la clave `api_key_custom` compartida de ST, añade la clave
y `x-opencode-session`, elimina `logprobs` y pone `reasoning_effort: low`.

1. En `proxy/`, copia `config.example.json` a `opencode-go-proxy.config.json`.
2. Pega tu clave `oc_sk_...`.
3. Ejecuta `node opencode-go-proxy.js` o `start.bat`.
4. En ST: Base URL `http://127.0.0.1:8790/v1`, modelo `glm-5.3`, clave vacía.

## 4. Caché y coste

La extensión muestra debajo del mensaje:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (precio de lista).
- Badge **Go** = `opencode.allowance` (consumo del límite Go).
- Pueden diferir: Gemini 4 Argon 2×, Kimi K3 ~4×.
- En ajustes elige **List price (Console)** o **Both**.

## 5. Errores frecuentes

| Error | Causa | Solución |
| --- | --- | --- |
| `400 MissingSessionID` | falta `x-opencode-session` | añade el header o usa el proxy |
| `401 Invalid credential` | clave antigua/revocada | usa la clave más reciente |
| `402 Insufficient account funds` | endpoint que no es Go | `/inference/go/openai/v1` |
| Respuesta vacía | el razonamiento consumió los tokens | `reasoning_effort: low`, más `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: más barato con suscripción, buenos GLM/Kimi/DeepSeek, pero requiere
  header de sesión/proxy, las claves pueden invalidarse y está pensado para
  agentes de código.
- **OpenRouter**: soporte nativo en ST, muchas modelos, sin proxy, pero
  pago por token y el caché depende del proveedor.
- **Elección**: Go + proxy si ya pagas Go y usas GLM/Kimi/DeepSeek; OpenRouter
  para RP general y simplicidad.

Guía completa en inglés: [OPENCODE-GO.md](OPENCODE-GO.md)  
Repositorio: https://github.com/Surdagon/st-opencode-usage-badge  
Catálogo: https://github.com/SillyTavern/SillyTavern-Content/pull/66
