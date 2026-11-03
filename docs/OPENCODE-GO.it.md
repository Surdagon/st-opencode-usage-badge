# OpenCode Go + SillyTavern — guida rapida

Collegare **OpenCode Go** a **SillyTavern**: connessione diretta, proxy locale e
confronto con **OpenRouter**.

**Lingue:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Chiave ed endpoint

- Console → **Go** → crea una chiave `oc_sk_...`.
- Endpoint Go: `https://opencode.ai/inference/go/openai/v1`.
- Non usare `/inference/openai/v1`: è il saldo normale, non Go.
- Modelli: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3`, ecc.
  Lista: `https://opencode.ai/inference/go/v1/models`.

## 2. Connessione diretta

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: ad esempio `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Senza `x-opencode-session` ricevi `400 MissingSessionID`.

7. Additional body (YAML), consigliato per i modelli con ragionamento:

   ```yaml
   reasoning_effort: low
   ```

8. Premi **Connect** e invia un messaggio reale, non solo Test Message.

## 3. Proxy locale (consigliato)

Il proxy non dipende dalla `api_key_custom` condivisa di ST, aggiunge chiave e
`x-opencode-session`, rimuove `logprobs` e imposta `reasoning_effort: low`.

1. In `proxy/`, copia `config.example.json` in `opencode-go-proxy.config.json`.
2. Inserisci la chiave `oc_sk_...`.
3. Avvia `node opencode-go-proxy.js` o `start.bat`.
4. In ST: Base URL `http://127.0.0.1:8790/v1`, modello `glm-5.3`, chiave vuota.

## 4. Cache e costo

L'estensione mostra sotto il messaggio:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (prezzo di listino).
- Badge **Go** = `opencode.allowance` (consumo del limite Go).
- Possono differire: Gemini 4 Argon 2×, Kimi K3 ~4×.
- Nelle impostazioni scegli **List price (Console)** o **Both**.

## 5. Errori comuni

| Errore | Causa | Soluzione |
| --- | --- | --- |
| `400 MissingSessionID` | manca `x-opencode-session` | aggiungi l'header o usa il proxy |
| `401 Invalid credential` | chiave vecchia/revocata | usa la chiave più recente |
| `402 Insufficient account funds` | endpoint non-Go | `/inference/go/openai/v1` |
| Risposta vuota | il ragionamento ha consumato i token | `reasoning_effort: low`, più `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: più economico con abbonamento, buoni GLM/Kimi/DeepSeek, ma richiede
  header di sessione/proxy, le chiavi possono invalidarsi ed è pensato per agenti
  di coding.
- **OpenRouter**: supporto nativo in ST, molti modelli, nessun proxy, ma
  pagamento a token e cache dipendente dal provider.
- **Scelta**: Go + proxy se paghi già Go e usi GLM/Kimi/DeepSeek; OpenRouter per
  RP generale e semplicità.

Guida completa in inglese: [OPENCODE-GO.md](OPENCODE-GO.md)  
Repository: https://github.com/Surdagon/st-opencode-usage-badge  
Catalogo: https://github.com/SillyTavern/SillyTavern-Content/pull/66
