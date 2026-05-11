#!/usr/bin/env python3
"""
OpenCode Model Tool Integration for LM Studio
Discovers models, configures speculative decoding, and updates opencode.json
"""

import json
import subprocess
import sys
import os
from pathlib import Path

LM_STUDIO_URL = "http://192.168.1.12:1234/v1"
CONFIG_PATH = Path.home() / ".config" / "opencode" / "opencode.json"
BACKUP_SUFFIX = ".bak"

def run_model_tool(args: list) -> dict:
    """Run opencode-model-tool with given arguments"""
    cmd = ["uv", "run", "opencode-model-tool.py"] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {"returncode": result.returncode, "stdout": result.stdout, "stderr": result.stderr}

def list_models() -> dict:
    """List all available models from LM Studio"""
    cmd = ["curl", "-s", f"{LM_STUDIO_URL}/models"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return {"error": "Failed to parse models response"}

def get_model_info(model_id: str) -> dict:
    """Get detailed info about a specific model"""
    cmd = ["curl", "-s", f"{LM_STUDIO_URL}/models/{model_id}"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return {}

def configure_speculative_decoding(main_model: str, draft_model: str = None) -> dict:
    """
    Configure speculative decoding for a model pair.
    Draft model should be a smaller model compatible with the main model.
    Recommended pairs from LM Studio docs:
    - Qwen2.5-32B + Qwen2.5-0.5B
    - Llama-3.1-8B + Llama-3.2-1B
    """
    if draft_model is None:
        draft_pairs = {
            "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2": "qwen2.5-0.5b-instruct",
            "gemma-4-e2b-it": "gemma-2b-it",
            "gemma-4-e4b-it": "gemma-2b-it",
        }
        draft_model = draft_pairs.get(main_model, "")

    return {
        "main_model": main_model,
        "draft_model": draft_model,
        "api_usage": {
            "endpoint": f"{LM_STUDIO_URL}/chat/completions",
            "draft_model_param": draft_model
        }
    }

def generate_config_update(models: list, speculative_pairs: dict = None) -> dict:
    """Generate opencode.json compatible config for discovered models"""
    models_config = {}

    chat_models = []
    embedding_models = []

    for model in models:
        model_id = model.get("id", "")
        model_info = model.get("meta", {})

        context_length = model_info.get("context_length", 0) or model_info.get("n_ctx_train", 0)

        is_embedding = any(x in model_id.lower() for x in ["embedding", "embed"])

        model_entry = {
            "name": model_id,
            "context_length": context_length,
        }

        if is_embedding:
            embedding_models.append(model_entry)
        else:
            chat_models.append(model_entry)
            models_config[model_id] = model_entry

    return {
        "chat_models": chat_models,
        "embedding_models": embedding_models,
        "lmstudio_config": {
            "npm": "@ai-sdk/openai-compatible",
            "name": "LM Studio (local)",
            "options": {
                "baseURL": LM_STUDIO_URL
            },
            "models": models_config,
            "speculative_decoding": speculative_pairs
        }
    }

def main():
    print("🔍 OpenCode Model Tool - LM Studio Integration")
    print("=" * 50)

    print("\n📡 Fetching models from LM Studio...")
    models_data = list_models()

    if "error" in models_data:
        print(f"❌ Error: {models_data['error']}")
        sys.exit(1)

    models = models_data.get("data", [])
    print(f"✅ Found {len(models)} models")

    chat_models = []
    embedding_models = []

    for model in models:
        model_id = model.get("id", "")
        if any(x in model_id.lower() for x in ["embedding", "embed"]):
            embedding_models.append(model_id)
        else:
            chat_models.append(model_id)

    print(f"\n💬 Chat Models ({len(chat_models)}):")
    for m in chat_models[:5]:
        print(f"   - {m}")
    if len(chat_models) > 5:
        print(f"   ... and {len(chat_models) - 5} more")

    print(f"\n📊 Embedding Models ({len(embedding_models)}):")
    for m in embedding_models:
        print(f"   - {m}")

    config_update = generate_config_update(models)
    print(f"\n⚡ Speculative Decoding Pairs:")
    for main, draft in config_update.get("speculative_decoding", {}).items():
        print(f"   {main} + {draft} (draft)")

    print("\n" + "=" * 50)
    print("To update your opencode.json, run:")
    print(f"  uv run opencode-model-tool.py --endpoint {LM_STUDIO_URL} --all --yes")
    print("\nTo use speculative decoding, add to your chat completions request:")
    print('  {"draft_model": "qwen2.5-0.5b-instruct"}')

if __name__ == "__main__":
    main()
