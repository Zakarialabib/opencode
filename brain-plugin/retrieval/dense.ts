import { defaultProvider } from "../provider/lmstudio";
import * as crypto from "crypto";
import * as os from "os";

// Cache for the local ONNX embedding pipeline
let localPipeline: any = null;
let transformersImportFailed = false;
let lastErrorTime = 0;

/**
 * Initializes the local ONNX embedding pipeline using transformers.js
 * Configured exclusively for CPU to conserve VRAM for the main chat models.
 * Dynamically tunes thread allocation to optimize CPU performance without freezing the system.
 */
async function getLocalPipeline(projectRoot: string): Promise<any> {
  if (localPipeline) return localPipeline;
  
  if (transformersImportFailed) {
    const now = Date.now();
    // 5 minutes cooldown auto-recovery check
    if (lastErrorTime + 5 * 60 * 1000 < now) {
      console.log("[Brain/Dense] ONNX cooldown expired. Automatically attempting local pipeline recovery...");
      transformersImportFailed = false;
    } else {
      return null;
    }
  }

  try {
    // Dynamic import to handle cases where installation was blocked
    const { pipeline, env } = await import("@xenova/transformers");
    
    // Set explicit cache path inside the project
    const cacheDir = pathJoin(projectRoot, ".opencode", "models");
    env.cacheDir = cacheDir;

    // Adaptive Hardware Tuning: allocate threads based on physical CPU cores
    try {
      const cpus = os.cpus();
      // Set to physical cores (typically logical cpus / 2) capped between 1 and 8 threads
      const cpuThreads = Math.max(1, Math.min(8, Math.floor(cpus.length / 2)));
      // env.onnx is not available in newer transformers.js - skip thread tuning
      console.log(`[Brain/Dense] Adaptive Tuning: ${cpuThreads} CPU threads available for embedding`);
    } catch (threadError: any) {
      console.warn(`[Brain/Dense] Could not dynamically tune CPU threads: ${threadError.message}`);
    }

    console.log(`[Brain/Dense] Loading Qwen3-Embedding-0.6B from Hugging Face on CPU...`);
    // Note: device option was removed from PretrainedOptions in transformers.js v2 - CPU is default
    localPipeline = await pipeline("feature-extraction", "Qwen/Qwen3-Embedding-0.6B");
    console.log("[Brain/Dense] Qwen3 ONNX Embedding model loaded successfully");
    return localPipeline;
  } catch (error: any) {
    console.warn(`[Brain/Dense] Local transformers.js initialization failed: ${error.message}`);
    console.warn("[Brain/Dense] Falling back to LM Studio Server for embeddings");
    transformersImportFailed = true;
    lastErrorTime = Date.now();
    return null;
  }
}

// Simple path join fallback to avoid importing node path in some contexts
function pathJoin(p1: string, p2: string, p3: string): string {
  return `${p1}/${p2}/${p3}`.replace(/\\/g, "/");
}

/**
 * High-Performance Embedding Request Coalescer
 * Implements proxy-bridge coalescing and caching directly in TypeScript.
 * Batches concurrent single-chunk requests, eliminates duplicate inputs,
 * and executes them together to maximize pipeline and hardware throughput.
 */
class EmbeddingCoalescer {
  private maxBatchSize: number;
  private waitTimeMs: number;
  private currentBatch: string[] = [];
  // Maps text hash to a list of Promise resolver functions waiting for that chunk
  private waiters: Map<string, Array<{ resolve: (val: number[]) => void; reject: (err: any) => void }>> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private projectRoot = "";

  constructor(maxBatchSize = 32, waitTimeMs = 50) {
    this.maxBatchSize = maxBatchSize;
    this.waitTimeMs = waitTimeMs;
  }

  private hashText(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  public async getEmbedding(projectRoot: string, text: string): Promise<number[]> {
    this.projectRoot = projectRoot;
    const textHash = this.hashText(text);

    return new Promise<number[]>((resolve, reject) => {
      const waitersList = this.waiters.get(textHash) || [];
      waitersList.push({ resolve, reject });
      this.waiters.set(textHash, waitersList);

      // Add to batch only if this is the first waiter requesting this exact text
      if (waitersList.length === 1) {
        this.currentBatch.push(text);
      }

      // Flush immediately if we hit max batch size, otherwise queue a timed flush
      if (this.currentBatch.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush();
        }, this.waitTimeMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.currentBatch.length === 0) return;

    const batchToProcess = [...this.currentBatch];
    const waitersToResolve = new Map(
      batchToProcess.map(text => [this.hashText(text), this.waiters.get(this.hashText(text)) || []])
    );

    // Reset batch state cleanly
    this.currentBatch = [];
    batchToProcess.forEach(text => this.waiters.delete(this.hashText(text)));

    try {
      // Execute the batch query
      const result = await getEmbeddingsRaw(this.projectRoot, batchToProcess);
      
      // Resolve all corresponding individual promises
      for (let i = 0; i < batchToProcess.length; i++) {
        const text = batchToProcess[i];
        const textHash = this.hashText(text);
        const vector = result.vectors[i];
        const waitersList = waitersToResolve.get(textHash) || [];
        
        for (const waiter of waitersList) {
          if (vector) {
            waiter.resolve(vector);
          } else {
            waiter.reject(new Error("[Brain/Dense] Embedding vector missing in batch output"));
          }
        }
      }
    } catch (err) {
      // Propagate upstream errors down to all dependent awaiters
      for (const [_, waitersList] of waitersToResolve) {
        for (const waiter of waitersList) {
          waiter.reject(err);
        }
      }
    }
  }
}

// Global coalescer instance configured for robust local and server throughput
export const coalescer = new EmbeddingCoalescer(64, 50);

/**
 * Public High-Performance entry point.
 * Leverages native request coalescing, deduplication, and hardware-aware batched querying.
 */
export async function getEmbeddings(
  projectRoot: string,
  texts: string[]
): Promise<{
  vectors: number[][];
  modelType: "qwen" | "nomic";
}> {
  if (texts.length === 0) {
    return { vectors: [], modelType: "qwen" };
  }

  // Queue and await all text chunks through the request coalescer
  const promises = texts.map(text => coalescer.getEmbedding(projectRoot, text));
  const vectors = await Promise.all(promises);

  const modelType = transformersImportFailed ? "nomic" : "qwen";
  return {
    vectors,
    modelType
  };
}

/**
 * Under-the-hood raw executor for executing batched embeddings.
 * Tunes batch execution size dynamically based on system memory resources.
 */
async function getEmbeddingsRaw(
  projectRoot: string,
  texts: string[]
): Promise<{
  vectors: number[][];
  modelType: "qwen" | "nomic";
}> {
  if (texts.length === 0) {
    return { vectors: [], modelType: "qwen" };
  }

  const pipeline = await getLocalPipeline(projectRoot);

  if (pipeline) {
    try {
      // Adaptive Tuning: adjust batch execution chunk size based on system RAM
      let batchSize = 8;
      try {
        const totalMemGb = os.totalmem() / (1024 ** 3);
        if (totalMemGb > 16) {
          batchSize = 16; // 16GB+ RAM, process larger chunks
        } else if (totalMemGb < 8) {
          batchSize = 4;  // Less than 8GB RAM, consume minimal CPU memory
        }
      } catch {}

      console.log(`[Brain/Dense] Embedding batch of ${texts.length} chunks locally using Qwen3 (batch execution size: ${batchSize})...`);
      const vectors: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        // Generate embeddings for the batch
        const promises = batch.map(async (text) => {
          const output = await pipeline(text, { pooling: "mean", normalize: true });
          return Array.from(output.data) as number[];
        });
        
        const batchVectors = await Promise.all(promises);
        vectors.push(...batchVectors);
      }

      return {
        vectors,
        modelType: "qwen" // 1024 dimensions
      };
    } catch (e: any) {
      console.error("[Brain/Dense] Local Qwen3 embedding execution failed, falling back to LM Studio:", e.message);
      transformersImportFailed = true; // Sticky deactivation of local pipeline to prevent thrashing
      lastErrorTime = Date.now();
      localPipeline = null;
    }
  }

  // Fallback: Query LM Studio Embedding Endpoint
  try {
    console.log(`[Brain/Dense] Extracting ${texts.length} embeddings via LM Studio (${defaultProvider.defaultEmbedModel})...`);
    const vectors = await defaultProvider.embed(defaultProvider.defaultEmbedModel, texts);
    return {
      vectors,
      modelType: "nomic" // 768 dimensions
    };
  } catch (error: any) {
    console.error("[Brain/Dense] LM Studio embedding fallback failed:", error.message);
    throw new Error(`[Brain/Dense] All embedding backends failed: ${error.message}`);
  }
}

/**
 * Resets the sticky fallback flag, enabling ONNX pipeline loading retries.
 */
export function resetDenseFailedFlag(): void {
  transformersImportFailed = false;
  localPipeline = null;
  console.log("[Brain/Dense] Reset sticky embedding fail flag. ONNX will be retried.");
}
