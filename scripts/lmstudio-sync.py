#!/usr/bin/env python3
"""
LM Studio Model Sync - Syncs models from LM Studio to opencode.json
and configures speculative decoding
"""

import json
import urllib.request
import urllib.error
import sys

LM_STUDIO_URL = "http://192.168.1.12:1234/v1"

def get_lmstudio_models() -> list:
    """Fetch models from LM Studio API"""
    try:
        with urllib.request.urlopen(f"{LM_STUDIO_URL}/models", timeout=5) as response:
            data = json.loads(response.read().decode())
            return data.get("data", [])
    except Exception as e:
        print(f"[ERROR] Failed to connect to LM Studio: {e}")
        return []

def get_model_context_length(model_id: str) -> int:
    """Try to get context length from LM Studio"""
    try:
        req = urllib.request.Request(
            f"{LM_STUDIO_URL}/model/info",
            data=json.dumps({"model": model_id}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return data.get("context_length", 0) or data.get("n_ctx", 0)
    except:
        return 0

def determine_model_type(model_id: str) -> str:
    """Determine if model is chat, embedding, or completion"""
    model_lower = model_id.lower()
    if any(x in model_lower for x in ["embedding", "embed", "e5", "bge"]):
        return "embedding"
    elif any(x in model_lower for x in ["completion", "gpt", "text"]):
        return "completion"
    return "chat"

def generate_model_config(models: list) -> dict:
    """Generate opencode.json compatible model configurations"""
    chat_models = {}
    embedding_models = {}
    completion_models = {}

    for model in models:
        model_id = model.get("id", "")
        model_type = determine_model_type(model_id)

        context_length = get_model_context_length(model_id)

        entry = {
            "name": model.get("name", model_id),
            "context_length": context_length if context_length > 0 else None,
        }

        if model_type == "embedding":
            embedding_models[model_id] = entry
        elif model_type == "completion":
            completion_models[model_id] = entry
        else:
            chat_models[model_id] = entry

    return {
        "chat_models": chat_models,
        "embedding_models": embedding_models,
        "completion_models": completion_models
    }

def find_speculative_pairs(chat_models: dict) -> dict:
    """Find compatible draft model pairs for speculative decoding"""
    pairs = {}

    qwen_models = [m for m in chat_models.keys() if "qwen" in m.lower() and "3.5" in m]
    small_models = [m for m in chat_models.keys() if any(x in m.lower() for x in ["0.5b", "1b", "2b", "3b"])]
    gemma_models = [m for m in chat_models.keys() if "gemma" in m.lower()]

    for main_model in qwen_models + gemma_models:
        if "4b" in main_model.lower() or "7b" in main_model.lower() or "8b" in main_model.lower():
            if small_models:
                pairs[main_model] = small_models[0]

    return pairs

def main():
    print("=" * 50)
    print("LM Studio Model Sync")
    print("=" * 50)

    print(f"\n[CONNECTING] to LM Studio at {LM_STUDIO_URL}...")
    models = get_lmstudio_models()

    if not models:
        print("[ERROR] No models found or LM Studio is not running")
        sys.exit(1)

    print(f"[OK] Found {len(models)} models\n")

    model_configs = generate_model_config(models)

    print("Chat Models:")
    for model_id in list(model_configs["chat_models"].keys())[:5]:
        print(f"  - {model_id}")
    if len(model_configs["chat_models"]) > 5:
        print(f"  ... and {len(model_configs['chat_models']) - 5} more")

    if model_configs["embedding_models"]:
        print("\nEmbedding Models:")
        for model_id in model_configs["embedding_models"]:
            print(f"  - {model_id}")

    pairs = find_speculative_pairs(model_configs["chat_models"])
    if pairs:
        print("\nSpeculative Decoding Pairs:")
        for main, draft in pairs.items():
            print(f"  {main} + {draft} (draft)")

    print("\n" + "=" * 50)
    print("To update opencode.json, run:")
    print(f"  uv run opencode-model-tool.py --endpoint {LM_STUDIO_URL} --all --yes")

    print("\nSpeculative Decoding API Usage:")
    print('  POST {LM_STUDIO_URL}/chat/completions')
    print('  Body: {"model": "main-model", "draft_model": "draft-model", ...}')

if __name__ == "__main__":
    main()
