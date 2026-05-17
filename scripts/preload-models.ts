#!/usr/bin/env npx tsx
/**
 * Pre-load models for orchestration demo
 */
import { defaultProvider, GPU_AWARE_MODELS } from "../brain-plugin/provider/lmstudio";

async function preloadModels() {
  console.log("🔄 Pre-loading models for orchestration demo...\n");

  const lmStudioUrl = process.env.LM_STUDIO_URL || "ws://127.0.0.1:1234";
  defaultProvider.setBaseURL(lmStudioUrl);

  // Load embedding model
  console.log(`📦 Loading: ${GPU_AWARE_MODELS.embed}`);
  try {
    const embedHandle = await defaultProvider.loadEmbeddingModel();
    console.log(`   ✓ Embedding model loaded`);
  } catch (err: any) {
    console.log(`   ⚠ Embedding: ${err.message}`);
  }

  // Check what's loaded now
  const loaded = await defaultProvider.getLoadedModels();
  console.log(`\n📋 Currently loaded: ${loaded.join(", ")}`);
  console.log("\n✅ Ready to run demo!");
}

preloadModels().catch(console.error);
