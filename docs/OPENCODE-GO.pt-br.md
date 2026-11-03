# OpenCode Go + SillyTavern — guia rápido

Conectando o **OpenCode Go** ao **SillyTavern**: conexão direta, proxy local e
comparação com o **OpenRouter**.

**Idiomas:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Chave e endpoint

- Console → **Go** → crie uma chave `oc_sk_...`.
- Endpoint Go: `https://opencode.ai/inference/go/openai/v1`.
- Não use `/inference/openai/v1` — é o saldo normal, não o Go.
- Modelos: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3` etc.
  Lista: `https://opencode.ai/inference/go/v1/models`.

## 2. Conexão direta

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: por exemplo, `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Sem `x-opencode-session` você recebe `400 MissingSessionID`.

7. Additional body (YAML), recomendado para modelos de raciocínio:

   ```yaml
   reasoning_effort: low
   ```

8. Clique em **Connect** e envie uma mensagem real, não apenas Test Message.

## 3. Proxy local (recomendado)

O proxy não depende da `api_key_custom` compartilhada do ST, adiciona a chave e o
`x-opencode-session`, remove `logprobs` e define `reasoning_effort: low`.

1. Em `proxy/`, copie `config.example.json` para `opencode-go-proxy.config.json`.
2. Coloque sua chave `oc_sk_...`.
3. Execute `node opencode-go-proxy.js` ou `start.bat`.
4. No ST: Base URL `http://127.0.0.1:8790/v1`, modelo `glm-5.3`, chave vazia.

## 4. Cache e custo

A extensão mostra abaixo da mensagem:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (preço de tabela).
- Badge **Go** = `opencode.allowance` (consumo do limite Go).
- Podem diferir: Gemini 4 Argon 2×, Kimi K3 ~4×.
- Nas configurações, escolha **List price (Console)** ou **Both**.

## 5. Erros comuns

| Erro | Causa | Solução |
| --- | --- | --- |
| `400 MissingSessionID` | falta o header `x-opencode-session` | adicione o header ou use o proxy |
| `401 Invalid credential` | chave antiga/revogada | use a chave mais recente |
| `402 Insufficient account funds` | endpoint que não é Go | `/inference/go/openai/v1` |
| Resposta vazia | o raciocínio consumiu os tokens | `reasoning_effort: low`, mais `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: mais barato com assinatura, bons GLM/Kimi/DeepSeek, mas exige header de
  sessão/proxy, as chaves podem ser invalidadas e o serviço é voltado a agentes
  de código.
- **OpenRouter**: suporte nativo no ST, muitos modelos, sem proxy, mas
  pagamento por token e cache depende do provedor.
- **Escolha**: Go + proxy se você já paga Go e usa GLM/Kimi/DeepSeek; OpenRouter
  para RP geral e simplicidade.

Guia completo em inglês: [OPENCODE-GO.md](OPENCODE-GO.md)  
Repositório: https://github.com/Surdagon/st-opencode-usage-badge  
Catálogo: https://github.com/SillyTavern/SillyTavern-Content/pull/66
