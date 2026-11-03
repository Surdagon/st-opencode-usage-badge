# OpenCode Go + SillyTavern — 快速指南

将 **OpenCode Go** 接入 **SillyTavern**：直连、本地代理，以及与 **OpenRouter** 的对比。

**语言：** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. 密钥与端点

- Console → **Go** → 创建 `oc_sk_...` 密钥。
- Go 端点：`https://opencode.ai/inference/go/openai/v1`。
- 不要用 `/inference/openai/v1`，那是普通余额，不是 Go。
- 模型：`glm-5.3`、`kimi-k3`、`deepseek-v4.1-flash`、`minimax-m3` 等。
  列表：`https://opencode.ai/inference/go/v1/models`。

## 2. 直连

1. SillyTavern → **Connection → Chat Completion**。
2. Source：**Custom (OpenAI-compatible)**。
3. Base URL：`https://opencode.ai/inference/go/openai/v1`。
4. API Key：`oc_sk_...`。
5. Model ID：例如 `glm-5.3`。
6. Additional Parameters → Custom Headers (YAML)：

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   没有 `x-opencode-session` 会返回 `400 MissingSessionID`。

7. Additional body (YAML)，推理模型建议添加：

   ```yaml
   reasoning_effort: low
   ```

8. 点击 **Connect**，发送真实消息，不要只看 Test Message。

## 3. 本地代理（推荐）

代理不依赖 ST 共享的 `api_key_custom`，会自动添加密钥和
`x-opencode-session`，移除 `logprobs`，并设置 `reasoning_effort: low`。

1. 在 `proxy/` 中把 `config.example.json` 复制为
   `opencode-go-proxy.config.json`。
2. 填入 `oc_sk_...` 密钥。
3. 运行 `node opencode-go-proxy.js` 或 `start.bat`。
4. ST 中：Base URL `http://127.0.0.1:8790/v1`，模型 `glm-5.3`，密钥留空。

## 4. 缓存与费用

扩展会在消息下方显示：

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost`（标价）。
- 徽章 **Go** = `opencode.allowance`（计入 Go 额度的金额）。
- 两者可能不同：Gemini 4 Argon 约 2×，Kimi K3 约 4×。
- 可在设置中选择 **List price (Console)** 或 **Both**。

## 5. 常见错误

| 错误 | 原因 | 解决 |
| --- | --- | --- |
| `400 MissingSessionID` | 缺少 `x-opencode-session` | 添加请求头或使用代理 |
| `401 Invalid credential` | 旧/已撤销密钥 | 使用最新密钥 |
| `402 Insufficient account funds` | 不是 Go 端点 | `/inference/go/openai/v1` |
| 空回复 | 推理消耗了 token | `reasoning_effort: low`、提高 `max_tokens`、用 `minimax-m3` |

## 6. Go 与 OpenRouter

- **Go**：有订阅时更便宜，GLM/Kimi/DeepSeek 表现好；但需要 session 头/代理，
  密钥可能失效，服务主要面向 coding agent。
- **OpenRouter**：ST 原生支持，模型多，不需要代理；但按 token 付费，缓存取决于
  提供商。
- **选择**：已经付 Go 且主要用 GLM/Kimi/DeepSeek → Go + 代理；追求通用 RP 和
  简单 → OpenRouter。

完整英文指南：[OPENCODE-GO.md](OPENCODE-GO.md)  
仓库：https://github.com/Surdagon/st-opencode-usage-badge  
官方目录：https://github.com/SillyTavern/SillyTavern-Content/pull/66
