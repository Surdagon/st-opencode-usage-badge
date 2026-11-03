# OpenCode Go + SillyTavern — hızlı rehber

**OpenCode Go**'yu **SillyTavern**'a bağlama: doğrudan bağlantı, yerel proxy ve
**OpenRouter** ile karşılaştırma.

**Diller:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Anahtar ve endpoint

- Console → **Go** → `oc_sk_...` anahtarı oluştur.
- Go endpoint: `https://opencode.ai/inference/go/openai/v1`.
- `/inference/openai/v1` kullanma — bu normal bakiye, Go değil.
- Modeller: `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3` vb.
  Liste: `https://opencode.ai/inference/go/v1/models`.

## 2. Doğrudan bağlantı

1. SillyTavern → **Connection → Chat Completion**.
2. Source: **Custom (OpenAI-compatible)**.
3. Base URL: `https://opencode.ai/inference/go/openai/v1`.
4. API Key: `oc_sk_...`.
5. Model ID: örneğin `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML):

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   `x-opencode-session` yoksa `400 MissingSessionID` alırsın.

7. Additional body (YAML), akıl yürüten modeller için önerilir:

   ```yaml
   reasoning_effort: low
   ```

8. **Connect**'e bas ve gerçek bir mesaj gönder; sadece Test Message yeterli değil.

## 3. Yerel proxy (önerilir)

Proxy, ST'nin paylaşılan `api_key_custom` anahtarına bağlı değildir; anahtarı ve
`x-opencode-session`'ı ekler, `logprobs`'u kaldırır, `reasoning_effort: low` koyar.

1. `proxy/` içinde `config.example.json` dosyasını
   `opencode-go-proxy.config.json` olarak kopyala.
2. `oc_sk_...` anahtarını gir.
3. `node opencode-go-proxy.js` veya `start.bat` çalıştır.
4. ST'de: Base URL `http://127.0.0.1:8790/v1`, model `glm-5.3`, anahtar boş.

## 4. Önbellek ve maliyet

Uzantı mesajın altında gösterir:

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (liste fiyatı).
- Badge **Go** = `opencode.allowance` (Go limitinden düşen tutar).
- Farklı olabilir: Gemini 4 Argon 2×, Kimi K3 ~4×.
- Ayarlarda **List price (Console)** veya **Both** seç.

## 5. Sık hatalar

| Hata | Neden | Çözüm |
| --- | --- | --- |
| `400 MissingSessionID` | `x-opencode-session` yok | başlığı ekle veya proxy kullan |
| `401 Invalid credential` | eski/iptal anahtar | en yeni anahtarı kullan |
| `402 Insufficient account funds` | Go olmayan endpoint | `/inference/go/openai/v1` |
| Boş yanıt | akıl yürütme tokenleri tüketti | `reasoning_effort: low`, daha fazla `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go**: abonelikle daha ucuz, iyi GLM/Kimi/DeepSeek modelleri; ancak oturum
  başlığı/proxy gerekir, anahtarlar geçersiz olabilir, coding ajanları için
  tasarlanmıştır.
- **OpenRouter**: ST'de yerel destek, çok model, proxy yok; ancak token başına
  ödeme ve önbellek sağlayıcıya bağlı.
- **Seçim**: Go + proxy, zaten Go ödüyorsan ve GLM/Kimi/DeepSeek kullanıyorsan;
  OpenRouter genel RP ve basitlik için.

Tam İngilizce rehber: [OPENCODE-GO.md](OPENCODE-GO.md)  
Depo: https://github.com/Surdagon/st-opencode-usage-badge  
Katalog: https://github.com/SillyTavern/SillyTavern-Content/pull/66
