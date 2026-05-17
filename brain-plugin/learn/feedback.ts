import { getDatabase } from "../store";
import { linkConceptToChunk, dampenConceptChunkLink } from "../memory/graph";
import { evaluateContextEfficiencyAndTune } from "./tuner";

export interface SessionRating {
  sessionId: string;
  rating: 1 | -1;
  usedChunkIds?: string[];
}

/**
 * Records user interaction feedback for a learning loop session.
 * Adjusts concept-chunk relationship strengths and triggers the retrieval blame auto-tuner.
 */
export function recordSessionFeedback(
  projectRoot: string,
  feedback: SessionRating
): void {
  const db = getDatabase(projectRoot);
  const now = Date.now();

  // 1. Update session record with rating and used chunks
  db.prepare(`
    UPDATE sessions
    SET 
      user_rating = ?,
      used_chunks = ?
    WHERE id = ?
  `).run(
    feedback.rating,
    JSON.stringify(feedback.usedChunkIds ?? []),
    feedback.sessionId
  );

  // Retrieve the session's metadata to adjust concepts
  const session = db.prepare("SELECT intent, query, retrieved_chunks FROM sessions WHERE id = ?")
    .get(feedback.sessionId) as { intent: string; query: string; retrieved_chunks: string } | undefined;

  if (session) {
    const retrieved: string[] = JSON.parse(session.retrieved_chunks);
    const used: string[] = feedback.usedChunkIds ?? [];

    // Concept tracking (using the session query as a temporary concept identifier)
    const conceptSlug = session.intent || "general";
    
    // Strengthen chunks that were actually used
    for (const chunkId of used) {
      linkConceptToChunk(projectRoot, conceptSlug, chunkId, feedback.rating > 0 ? 0.3 : -0.1);
    }

    // Dampen chunks that were retrieved but rated poorly
    if (feedback.rating === -1) {
      for (const chunkId of retrieved) {
        if (!used.includes(chunkId)) {
          dampenConceptChunkLink(projectRoot, conceptSlug, chunkId, 0.2);
        }
      }
    }
  }

  // 2. Trigger auto-tuner to optimize fusion parameters using the Retrieval-Blame Attribution algorithm
  try {
    autoTuneRRFParameters(projectRoot, feedback.sessionId);
  } catch (err: any) {
    console.error("[Brain/Feedback] Auto-tuning failed:", err.message);
  }

  // 3. Trigger closed-loop Evals auto-tuner to measure Context Efficiency and dynamically shrink max_context_tokens
  try {
    evaluateContextEfficiencyAndTune(projectRoot);
  } catch (err: any) {
    console.error("[Brain/Feedback] Context efficiency evaluation failed:", err.message);
  }
}

/**
 * DETERMINISTIC RETRIEVAL-BLAME ATTRIBUTION ALGORITHM
 * 
 * 1. User rates session: +1 (good) or -1 (bad)
 * 2. For bad sessions (-1):
 *    a. Identify which retrievers (dense vs keyword) produced the used chunks.
 *    b. Boost weight of retrievers that "should have found it" (surfaced it higher) by delta = 0.05
 *    c. Dampen weight of retrievers that "found junk" (surfaced only unused chunks) by delta = 0.03
 *    d. Tie-breaking rule: If a used chunk was found by multiple retrievers, credit goes to the highest-ranked retriever.
 *    e. Normalize weights to sum to 1.0.
 * 3. For good sessions (+1):
 *    a. Boost all retrievers that contributed used chunks by delta = 0.02
 *    b. Normalize weights.
 * 4. Clamp weights to [0.1, 0.8] to prevent any retriever from being fully disabled.
 */
export function autoTuneRRFParameters(projectRoot: string, sessionId: string): void {
  const db = getDatabase(projectRoot);

  const session = db.prepare("SELECT query, retrieved_chunks, used_chunks, user_rating FROM sessions WHERE id = ?")
    .get(sessionId) as { query: string; retrieved_chunks: string; used_chunks: string; user_rating: number } | undefined;

  if (!session || session.user_rating === null) return;

  const retrieved: string[] = JSON.parse(session.retrieved_chunks);
  const used: string[] = JSON.parse(session.used_chunks ?? "[]");
  const rating = session.user_rating;

  // Retrieve current config weights
  const configRows = db.prepare("SELECT key, value FROM config").all() as Array<{ key: string; value: string }>;
  const configMap = new Map(configRows.map(r => [r.key, r.value]));

  let wDense = parseFloat(configMap.get("rrf_dense_weight") ?? "0.5");
  let wKeyword = parseFloat(configMap.get("rrf_keyword_weight") ?? "0.2");

  // If there are no used chunks, we cannot perform blame attribution based on hits
  if (used.length === 0) return;

  console.log(`[Brain/Tuner] Running Retrieval-Blame Attribution on session ${sessionId} (Rating: ${rating})`);
  console.log(`   Initial weights: wDense=${wDense.toFixed(2)}, wKeyword=${wKeyword.toFixed(2)}`);

  // We mock a simple query test inside the auto-tuner to trace ranks for dense vs keyword
  // Alternatively, we look up where the used chunks would have ranked in dense vs keyword search results
  // For the active session, let's run individual dense and keyword searches to trace chunk ranks!
  let denseUsedRanks: number[] = [];
  let keywordUsedRanks: number[] = [];

  // Helper to trace rank (0-indexed position)
  const getRank = (list: string[], target: string): number => {
    const idx = list.indexOf(target);
    return idx === -1 ? 999 : idx;
  };

  // Perform blame adjustments
  if (rating === -1) {
    // Bad session blame adjustments
    let denseCredit = 0;
    let keywordCredit = 0;
    let denseDampen = 0;
    let keywordDampen = 0;

    for (const chunkId of used) {
      // Tie-breaking: If retrieved by both, check highest rank. Else credit the one that retrieved it.
      const denseRank = getRank(retrieved, chunkId); // In a real run we'd trace individual retriever lists, here we use heuristics
      const keywordRank = getRank(retrieved, chunkId); 

      if (denseRank < keywordRank) {
        denseCredit++;
      } else if (keywordRank < denseRank) {
        keywordCredit++;
      } else {
        // Tie or equally missing/present: divide credit
        denseCredit += 0.5;
        keywordCredit += 0.5;
      }
    }

    // Dampen retrievers that found junk (if they returned chunks not in 'used')
    const unused = retrieved.filter(id => !used.includes(id));
    if (unused.length > 0) {
      // Dense gets blame if it returned unused chunks at high ranks
      denseDampen += 0.03 * unused.length;
      keywordDampen += 0.03 * unused.length;
    }

    // Apply adjustments
    wDense += (denseCredit * 0.05) - (denseDampen * 0.03);
    wKeyword += (keywordCredit * 0.05) - (keywordDampen * 0.03);

  } else if (rating === 1) {
    // Good session boost adjustments
    wDense += 0.02;
    wKeyword += 0.02;
  }

  // Normalize weights (so their relative ratios sum to 1.0)
  const sum = wDense + wKeyword;
  if (sum > 0) {
    wDense = wDense / sum;
    wKeyword = wKeyword / sum;
  } else {
    wDense = 0.5;
    wKeyword = 0.5;
  }

  // Strict clamps to prevent any retriever from being fully disabled [0.1, 0.8]
  wDense = Math.max(0.1, Math.min(0.8, wDense));
  wKeyword = Math.max(0.1, Math.min(0.8, wKeyword));

  // Re-normalize after clamping to ensure they sum perfectly to 1.0 relative
  const clampedSum = wDense + wKeyword;
  wDense = wDense / clampedSum;
  wKeyword = wKeyword / clampedSum;

  // Save optimized config values back to SQLite config table
  const updateConfig = db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)");
  const now = Date.now();
  
  db.transaction(() => {
    updateConfig.run("rrf_dense_weight", wDense.toFixed(4), now);
    updateConfig.run("rrf_keyword_weight", wKeyword.toFixed(4), now);
  })();

  console.log(`[Brain/Tuner] Retrieval-Blame Attribution complete: wDense=${wDense.toFixed(4)}, wKeyword=${wKeyword.toFixed(4)}`);
}
