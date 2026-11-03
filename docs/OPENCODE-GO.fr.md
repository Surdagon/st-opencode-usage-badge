# OpenCode Go + SillyTavern — guide rapide

Connecter **OpenCode Go** à **SillyTavern** : connexion directe, proxy local et
comparaison avec **OpenRouter**.

**Langues :** [English](OPENCODE-GO.md) · [Русский](OPENCODE-GO.ru.md) · [Español](OPENCODE-GO.es.md) · [Français](OPENCODE-GO.fr.md) · [Deutsch](OPENCODE-GO.de.md) · [Português (BR)](OPENCODE-GO.pt-br.md) · [Italiano](OPENCODE-GO.it.md) · [Polski](OPENCODE-GO.pl.md) · [Türkçe](OPENCODE-GO.tr.md) · [中文](OPENCODE-GO.zh-cn.md) · [日本語](OPENCODE-GO.ja.md)

## 1. Clé et endpoint

- Console → **Go** → créez une clé `oc_sk_...`.
- Endpoint Go : `https://opencode.ai/inference/go/openai/v1`.
- N'utilisez pas `/inference/openai/v1` : c'est le solde normal, pas Go.
- Modèles : `glm-5.3`, `kimi-k3`, `deepseek-v4.1-flash`, `minimax-m3`, etc.
  Liste : `https://opencode.ai/inference/go/v1/models`.

## 2. Connexion directe

1. SillyTavern → **Connection → Chat Completion**.
2. Source : **Custom (OpenAI-compatible)**.
3. Base URL : `https://opencode.ai/inference/go/openai/v1`.
4. API Key : `oc_sk_...`.
5. Model ID : par exemple `glm-5.3`.
6. Additional Parameters → Custom Headers (YAML) :

   ```yaml
   User-Agent: sillytavern-opencode/1.0
   x-opencode-session: st-00000000-0000-0000-0000-000000000000
   ```

   Sans `x-opencode-session`, vous aurez `400 MissingSessionID`.

7. Additional body (YAML), recommandé pour les modèles de raisonnement :

   ```yaml
   reasoning_effort: low
   ```

8. Cliquez sur **Connect** et envoyez un vrai message, pas seulement Test Message.

## 3. Proxy local (recommandé)

Le proxy ne dépend pas de la clé `api_key_custom` partagée de ST, ajoute la clé
et `x-opencode-session`, retire `logprobs` et met `reasoning_effort: low`.

1. Dans `proxy/`, copiez `config.example.json` vers `opencode-go-proxy.config.json`.
2. Collez votre clé `oc_sk_...`.
3. Lancez `node opencode-go-proxy.js` ou `start.bat`.
4. Dans ST : Base URL `http://127.0.0.1:8790/v1`, modèle `glm-5.3`, clé vide.

## 4. Cache et coût

L'extension affiche sous le message :

```text
⚡ 97% · Go $0.0370 / $0.0185
```

- Console **Cost** = `opencode.list_cost` (prix catalogue).
- Badge **Go** = `opencode.allowance` (consommation du plafond Go).
- Ils peuvent différer : Gemini 4 Argon 2×, Kimi K3 ~4×.
- Dans les réglages, choisissez **List price (Console)** ou **Both**.

## 5. Erreurs fréquentes

| Erreur | Cause | Solution |
| --- | --- | --- |
| `400 MissingSessionID` | header `x-opencode-session` absent | ajoutez-le ou utilisez le proxy |
| `401 Invalid credential` | clé ancienne/révoquée | utilisez la clé la plus récente |
| `402 Insufficient account funds` | endpoint non-Go | `/inference/go/openai/v1` |
| Réponse vide | le raisonnement a consommé les tokens | `reasoning_effort: low`, plus de `max_tokens`, `minimax-m3` |

## 6. Go vs OpenRouter

- **Go** : moins cher avec abonnement, bons GLM/Kimi/DeepSeek, mais header de
  session/proxy requis, clés parfois invalidées, pensé pour les agents de code.
- **OpenRouter** : support natif de ST, beaucoup de modèles, pas de proxy, mais
  paiement au token et cache selon le fournisseur.
- **Choix** : Go + proxy si vous payez déjà Go et utilisez GLM/Kimi/DeepSeek ;
  OpenRouter pour le RP général et la simplicité.

Guide complet en anglais : [OPENCODE-GO.md](OPENCODE-GO.md)  
Dépôt : https://github.com/Surdagon/st-opencode-usage-badge  
Catalogue : https://github.com/SillyTavern/SillyTavern-Content/pull/66
