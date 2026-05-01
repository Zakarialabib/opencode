# LM Studio API Reference

This document provides API reference for LM Studio integration with OpenCode.

## Base URLs

- **OpenAI-compatible API**: `http://127.0.0.1:8080/v1`
- **Native LM Studio API**: `http://127.0.0.1:8080/api`

## Native API Endpoints

### Health & Version

```
GET /api/extra/version
```

Returns LM Studio version information.

**Response:**
```json
{
  "version": "0.2.0",
  "build": "2024-01-15"
}
```

### List Models

```
GET /api/v1/models
```

Returns list of available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen3.5-4b",
      "object": "model",
      "created": 1700000000,
      "owned_by": "lmstudio"
    }
  ]
}
```

### Load Model

```
POST /api/v1/model/load
Content-Type: application/json

{
  "model": "qwen3.5-4b"
}
```

Loads a model into memory. May take several seconds.

**Response:**
```json
{
  "success": true,
  "message": "Model loaded"
}
```

### Unload Model

```
POST /api/v1/model/unload
```

Unloads the currently loaded model.

**Response:**
```json
{
  "success": true,
  "message": "Model unloaded"
}
```

## OpenAI-Compatible API

### Chat Completions

```
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "qwen3.5-4b",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100,
  "stream": false
}
```

Supports standard OpenAI parameters plus LM Studio extensions:

- `rep_pen`: Repetition penalty (default: 1.1)
- `top_p`: nucleus sampling (default: 0.9)
- `mirostat`: Mirostat sampling mode (default: 0)

### List Models (OpenAI-compatible)

```
GET /v1/models
```

Returns models in OpenAI format.

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Endpoint or model not found
- `500 Internal Server Error`: Server error

Error responses include a JSON body:

```json
{
  "error": {
    "message": "Model not found",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

## Rate Limits

LM Studio typically does not enforce rate limits for local usage.

## Authentication

No authentication required for local access.

## Timeout Defaults

- Health check: 5 seconds
- Model loading: 30 seconds
- Inference: 5 minutes (configurable)

## Integration with OpenCode

OpenCode uses:

1. **Health checks** via `/api/extra/version` before each message
2. **Model auto-loading** via `/api/v1/model/load` when needed
3. **Inference** via `/v1/chat/completions` for all LLM requests
4. **Model discovery** via `/api/v1/models` for dynamic model listing