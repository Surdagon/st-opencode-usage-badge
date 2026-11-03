# OpenCode Go + SillyTavern — クイックガイド

**OpenCode Go** を **SillyTavern** に接続する方法：直接接続、ローカルプロキシ、
**OpenRouter** との比較。

**言語:** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. キーとエンドポイント

- Console → **Go** → `oc_sk_...` キーを作成。
- Go エンドポイント：`https://opencode.ai/inference/go/openai/v1`。
- `/inference/openai/v1` は通常残高用なので使わない。
- モデル：`glm-5.3`、`kimi-k3`、`deepseek-v4.1-flash`、`minimax-m3` など。
  一覧：`https://opencode.ai/inference/go/v1/models`。

## 2. 直接接続

1. SillyTavern → **Connection → Chat Completion**。
2. Source：**Custom (OpenAI-compatible)**。
3. Base URL：`https://opencode.ai/inference/go/openai/v1`。
4. API Key：`oc_sk_...`。
5. Model ID：例 `glm-5.3`。
6. Additional Parameters → Custom Headers (YAML)：

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   `x-opencode-session` がないと `400 MissingSessionID` になります。

7. Additional body (YAML)、推論モデルに推奨：

   ```yaml
   reasoning_effort: low
   ```

8. **Connect** を押し、Test Message だけでなく実際のメッセージを送信。

## 3. ローカルプロキシ（推奨）

プロキシは ST の共有 `api_key_custom` に依存せず、キーと
`x-opencode-session` を追加し、`logprobs` を削除、`reasoning_effort: low` を設定します。

1. `proxy/` で `config.example.json` を
   `opencode-go-proxy.config.json` にコピー。
2. `oc_sk_...` キーを入力。
3. `node opencode-go-proxy.js` または `start.bat` を実行。
4. ST：Base URL `http://127.0.0.1:8790/v1`、モデル `glm-5.3`、キーは空。

## 4. キャッシュとコスト

拡張機能はメッセージの下に表示します：

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost`（定価）。
- バッジ **Go** = `opencode.allowance`（Go 上限からの消費）。
- 異なる場合があります：Gemini 4 Argon 2×、Kimi K3 約4×。
- 設定で **List price (Console)** または **Both** を選択。

## 5. よくあるエラー

| エラー | 原因 | 対処 |
| --- | --- | --- |
| `400 MissingSessionID` | `x-opencode-session` がない | ヘッダーを追加するかプロキシを使う |
| `401 Invalid credential` | 古い/無効なキー | 最新のキーを使う |
| `402 Insufficient account funds` | Go 以外のエンドポイント | `/inference/go/openai/v1` |
| 空の応答 | 推論がトークンを使い切った | `reasoning_effort: low`、`max_tokens` を増やす、`minimax-m3` |

## 6. Go と OpenRouter

- **Go**：サブスクリプションがあると安価。GLM/Kimi/DeepSeek が良好。ただし
  セッションヘッダー/プロキシが必要で、キーが無効になることがあり、coding agent
  向けのサービス。
- **OpenRouter**：ST ネイティブ対応、モデルが多い、プロキシ不要。ただし
  トークン課金で、キャッシュはプロバイダー次第。
- **選び方**：Go を既に支払い GLM/Kimi/DeepSeek を使うなら Go + プロキシ。
  汎用 RP と手軽さなら OpenRouter。

完全な英語ガイド：[OPENCODE-GO.md](OPENCODE-GO.md)  
リポジトリ：https://github.com/Surdagon/st-opencode-usage-badge  
カタログ：https://github.com/SillyTavern/SillyTavern-Content/pull/66
