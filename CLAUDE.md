# Airgap

Offline-first customer support chatbot for ACME Telecom (fictional SEA telco). React Native + on-device LLM.

## Architecture

LLM-first: every query → MiniSearch retrieval → on-device Gemma 4 E2B → grounded response. No intent classifier, no templates, one code path.

## Stack

- React Native 0.84.1 (bare workflow)
- llama.rn — on-device LLM inference
- MiniSearch — pure JS search (no native deps)
- react-native-gifted-chat — chat UI
- react-native-mmkv — KV storage
- Gemma 4 E2B Instruct Q3_K_S (~2.4 GB GGUF, downloaded on first launch from `unsloth/gemma-4-E2B-it-GGUF`)

## Key files

- src/services/orchestrator.ts — central pipeline
- src/knowledge/ — all JSON data files + MiniSearch index
- src/services/llmService.ts — llama.rn lifecycle
- src/services/searchService.ts — MiniSearch wrapper

## Commands

```bash
npm start          # Metro bundler
npm run android    # Build + run Android
npm run ios        # Build + run iOS
npm test           # Jest tests
```

## Testing

Run on physical Android device (4GB+ RAM) for LLM testing. Simulator works for non-LLM paths.
