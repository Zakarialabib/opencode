/**
 * Shared Configuration Schema
 *
 * Single source of truth for brain-plugin + brain-dashboard.
 * Both read from the same `brain.config.json` at the project root.
 * The dashboard UI writes back to this file.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrainConfig {
  /** Schema version for migration */
  version: number;

  /** Provider definitions */
  providers: ProviderConfig[];

  /** Currently selected model IDs */
  selectedModels: SelectedModels;

  /** RAG pipeline configuration */
  rag: RagConfig;

  /** Learning feedback loop configuration */
  learning: LearningConfig;

  /** Search/retrieval defaults */
  search: SearchConfig;

  /** Indexing settings */
  indexing: IndexingConfig;

  /** Dashboard UI preferences */
  ui: UIConfig;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: "lmstudio" | "ollama" | "custom";
  baseURL: string;
  apiKey?: string;
  enabled: boolean;
}

export interface SelectedModels {
  chat: string;
  embed: string;
  embedBackend: "local" | "lmstudio" | "auto";
  rerank: string;
  rerankEnabled: boolean;
}

export interface RagConfig {
  denseWeight: number;
  keywordWeight: number;
  rrfK: number;
  memoryBoost: number;
  rerankMinResults: number;
  confidenceGate: number;
  rerankIntents: string[];
  maxContextTokens: number;
}

export interface LearningConfig {
  enabled: boolean;
  patternExtractionIntervalMs: number;
  promptTuningThreshold: number;
  maxPatternsPerRun: number;
  lookbackMinutes: number;
}

export interface SearchConfig {
  defaultLimit: number;
  defaultIntent: string;
  maxChunksBeforeRerank: number;
}

export interface IndexingConfig {
  includePatterns: string[];
  excludePatterns: string[];
  chunkSize: number;
  chunkOverlap: number;
}

export interface UIConfig {
  autoRefresh: boolean;
  refreshInterval: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: BrainConfig = {
  version: 1,
  providers: [
    {
      id: "lmstudio",
      name: "LM Studio",
      type: "lmstudio",
      baseURL: "http://localhost:1234",
      enabled: true,
    },
    {
      id: "ollama",
      name: "Ollama",
      type: "ollama",
      baseURL: "http://localhost:11434",
      enabled: true,
    },
  ],
  selectedModels: {
    chat: "",
    embed: "Xenova/nomic-embed-text-v1.5",
    embedBackend: "auto",
    rerank: "Xenova/bge-reranker-base",
    rerankEnabled: false,
  },
  rag: {
    denseWeight: 0.4,
    keywordWeight: 0.4,
    rrfK: 60,
    memoryBoost: 0.15,
    rerankMinResults: 10,
    confidenceGate: 0.85,
    rerankIntents: ["learn", "refactor", "feature"],
    maxContextTokens: 3000,
  },
  learning: {
    enabled: true,
    patternExtractionIntervalMs: 300000,
    promptTuningThreshold: 0.5,
    maxPatternsPerRun: 5,
    lookbackMinutes: 30,
  },
  search: {
    defaultLimit: 10,
    defaultIntent: "learn",
    maxChunksBeforeRerank: 20,
  },
  indexing: {
    includePatterns: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.py",
      "**/*.rs",
      "**/*.go",
      "**/*.java",
      "**/*.md",
    ],
    excludePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/target/**"],
    chunkSize: 500,
    chunkOverlap: 50,
  },
  ui: {
    autoRefresh: true,
    refreshInterval: 30000,
  },
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

let _cachedConfig: BrainConfig | null = null;
let _configPath: string = "";

/**
 * Find the config file by checking common locations relative to projectRoot.
 */
function resolveConfigPath(projectRoot: string): string {
  // Prefer brain.config.json at project root
  const candidates = [
    path.join(projectRoot, "brain.config.json"),
    path.join(projectRoot, ".opencode", "brain.config.json"),
    path.join(projectRoot, "brain-plugin", "brain.config.json"),
    path.join(projectRoot, "brain-dashboard", "brain-dashboard-config.json"),
  ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) return fp;
  }
  // Default: project root
  return candidates[0];
}

/**
 * Load the shared brain config from the best available location.
 */
export function loadBrainConfig(projectRoot: string): BrainConfig {
  if (_cachedConfig && _configPath) return _cachedConfig;

  _configPath = resolveConfigPath(projectRoot);

  if (fs.existsSync(_configPath)) {
    try {
      const raw = fs.readFileSync(_configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<BrainConfig>;

      // Check for legacy dashboard config format and migrate
      if (parsed.version === undefined && "lmStudio" in parsed) {
        const legacy = parsed as any;
        _cachedConfig = {
          ...DEFAULT_CONFIG,
          providers: [
            {
              id: "lmstudio",
              name: "LM Studio",
              type: "lmstudio",
              baseURL: legacy.lmStudio?.baseURL
                ? `http://${legacy.lmStudio.baseURL.replace(/^https?:\/\//, "")}`
                : "http://localhost:1234",
              enabled: true,
            },
            {
              id: "ollama",
              name: "Ollama",
              type: "ollama",
              baseURL: legacy.ollama?.baseURL || "http://localhost:11434",
              enabled: true,
            },
          ],
          selectedModels: {
            chat: legacy.lmStudio?.preferredChat || legacy.ollama?.preferredChat || "",
            embed:
              legacy.lmStudio?.preferredEmbedding ||
              legacy.ollama?.preferredEmbedding ||
              "Xenova/nomic-embed-text-v1.5",
            embedBackend: "auto",
            rerank: legacy.lmStudio?.preferredReranker || "Xenova/bge-reranker-base",
            rerankEnabled: legacy.rag?.confidenceGate ? true : false,
          },
          rag: {
            denseWeight: legacy.rag?.denseWeight ?? 0.4,
            keywordWeight: legacy.rag?.keywordWeight ?? 0.4,
            rrfK: legacy.rag?.rrfK ?? 60,
            memoryBoost: legacy.rag?.memoryBoost ?? 0.15,
            rerankMinResults: legacy.rag?.rerankMinResults ?? 10,
            confidenceGate: legacy.rag?.confidenceGate ?? 0.85,
            rerankIntents: legacy.rag?.rerankIntents ?? ["learn", "refactor", "feature"],
            maxContextTokens: 3000,
          },
          learning: { ...DEFAULT_CONFIG.learning },
          search: {
            defaultLimit: legacy.search?.defaultLimit ?? 10,
            defaultIntent: legacy.search?.defaultIntent ?? "learn",
            maxChunksBeforeRerank: legacy.search?.maxChunksBeforeRerank ?? 20,
          },
          indexing: {
            ...DEFAULT_CONFIG.indexing,
            chunkSize: legacy.indexing?.chunkSize ?? 500,
            chunkOverlap: legacy.indexing?.chunkOverlap ?? 50,
          },
          ui: {
            autoRefresh: legacy.ui?.autoRefresh ?? true,
            refreshInterval: legacy.ui?.refreshInterval ?? 30000,
          },
        };
        // Migrate old location to new
        saveBrainConfig(projectRoot, _cachedConfig);
        return _cachedConfig;
      }

      _cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
      // Deep merge arrays
      if (parsed.providers) _cachedConfig.providers = parsed.providers;
      if (parsed.selectedModels)
        _cachedConfig.selectedModels = {
          ..._cachedConfig.selectedModels,
          ...parsed.selectedModels,
        };
      if (parsed.rag) _cachedConfig.rag = { ..._cachedConfig.rag, ...parsed.rag };
      if (parsed.learning)
        _cachedConfig.learning = { ..._cachedConfig.learning, ...parsed.learning };
      if (parsed.search) _cachedConfig.search = { ..._cachedConfig.search, ...parsed.search };
      if (parsed.indexing)
        _cachedConfig.indexing = { ..._cachedConfig.indexing, ...parsed.indexing };
      if (parsed.ui) _cachedConfig.ui = { ..._cachedConfig.ui, ...parsed.ui };

      return _cachedConfig;
    } catch (err) {
      console.error("[Brain/Config] Failed to parse config, using defaults:", err);
    }
  }

  _cachedConfig = { ...DEFAULT_CONFIG };
  return _cachedConfig;
}

/**
 * Save the config back to the shared file.
 */
export function saveBrainConfig(projectRoot: string, config: BrainConfig): void {
  const configPath = resolveConfigPath(projectRoot);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  _cachedConfig = config;
  _configPath = configPath;
  console.log(`[Brain/Config] Saved config to ${configPath}`);
}

/**
 * Get the path to the config file for display purposes.
 */
export function getConfigPath(projectRoot: string): string {
  if (_configPath) return _configPath;
  return resolveConfigPath(projectRoot);
}

/**
 * Clears in-memory cache (useful when config changes at runtime).
 */
export function clearConfigCache(): void {
  _cachedConfig = null;
  _configPath = "";
}

/**
 * Get a specific config section.
 */
export function getRagConfig(projectRoot: string): RagConfig {
  return loadBrainConfig(projectRoot).rag;
}

export function getLearningConfig(projectRoot: string): LearningConfig {
  return loadBrainConfig(projectRoot).learning;
}

export function getSelectedModels(projectRoot: string): SelectedModels {
  return loadBrainConfig(projectRoot).selectedModels;
}

export function getProviders(projectRoot: string): ProviderConfig[] {
  return loadBrainConfig(projectRoot).providers;
}
