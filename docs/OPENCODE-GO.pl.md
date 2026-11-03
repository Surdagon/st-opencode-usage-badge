# OpenCode Go + SillyTavern — krótki przewodnik

Połączenie **OpenCode Go** z **SillyTavern**: połączenie bezpośrednie, lokalny
proxy i porównanie z **OpenRouter**.

**Języki:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Klucz i endpoint

- Console → **Go** → utwórz klucz `oc_sk_...`.
- Endpoint Go: `https://opencode.ai/inference/go/openai/v1`.
- Nie używaj `/inference/openai/v1` — to zwykłe saldo, nie Go.
- Modele: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3` itd.
  Lista: `https://opencode.ai/inference/go/v1/models`.

## 2. Połączenie bezpośrednie

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: np. `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Bez `x-opencode-session` dostaniesz `400 MissingSessionID`.

7. Additional body (YAML), zalecane dla modeli rozumujących:

   ```yaml
   reasoning_effort: low
   ```

8. Kliknij **Connect** i wyślij prawdziwą wiadomość, nie tylko Test Message.

## 3. Lokalny proxy (zalecany)

Proxy nie zależy od współdzielonego `api_key_custom` w ST, dodaje klucz i
`x-opencode-session`, usuwa `logprobs` i ustawia `reasoning_effort: low`.

1. W `proxy/` skopiuj `config.example.json` do `opencode-go-proxy.config.json`.
2. Wstaw klucz `oc_sk_...`.
3. Uruchom `node opencode-go-proxy.js` lub `start.bat`.
4. W ST: Base URL `http://127.0.0.1:8790/v1`, model `glm-5.3`, klucz pusty.

## 4. Cache i koszt

Rozszerzenie pokazuje pod wiadomością:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (cena katalogowa).
- Badge **Go** = `opencode.allowance` (zużycie limitu Go).
- Mogą się różnić: Gemini 4 Argon 2×, Kimi K3 ~4×.
- W ustawieniach wybierz **List price (Console)** lub **Both**.

## 5. Częste błędy

| Błąd | Przyczyna | Rozwiązanie |
| --- | --- | --- |
| `400 MissingSessionID` | brak `x-opencode-session` | dodaj nagłówek lub użyj proxy |
| `401 Invalid credential` | stary/unieważniony klucz | użyj najnowszego klucza |
| `402 Insufficient account funds` | endpoint inny niż Go | `/inference/go/openai/v1` |
| Pusta odpowiedź | rozumowanie zużyło tokeny | `reasoning_effort: low`, więcej `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: taniej z subskrypcją, dobre GLM/Kimi/DeepSeek, ale wymaga nagłówka
  sesji/proxy, klucze mogą być unieważniane, a usługa jest projektowana pod
  agentów kodujących.
- **OpenRouter**: natywne wsparcie ST, wiele modeli, bez proxy, ale płatność za
  tokeny i cache zależny od dostawcy.
- **Wybór**: Go + proxy, jeśli już płacisz za Go i używasz GLM/Kimi/DeepSeek;
  OpenRouter do ogólnego RP i prostoty.

Pełny przewodnik po angielsku: [OPENCODE-GO.md](OPENCODE-GO.md)  
Repozytorium: https://github.com/Surdagon/st-opencode-usage-badge  
Katalog: https://github.com/SillyTavern/SillyTavern-Content/pull/66
