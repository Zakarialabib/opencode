import { getDatabase } from "../store";

/**
 * DETERMINISTIC EVAL-TO-TUNE CLOSED LOOP AUTO-TUNER
 * 
 * 1. Automatically queries the last 3 active sessions from the SQLite database.
 * 2. Compares the number of chunks actually used by the developer versus the total chunks retrieved.
 * 3. If the Context Efficiency (Used Chunks / Retrieved Chunks) is below 0.8 in all 3 sessions:
 *    - Automatically reduces the prompt's max context token limit by 20% to prevent amnesia and focus retrieval context.
 *    - Saves the optimized limit back to the SQLite config table.
 */
export function evaluateContextEfficiencyAndTune(projectRoot: string): void {
  const db = getDatabase(projectRoot);

  try {
    // Query 3 most recent sessions that have both retrieved chunks and used chunks specified
    const sessions = db.prepare(`
      SELECT retrieved_chunks, used_chunks, id
      FROM sessions
      WHERE retrieved_chunks IS NOT NULL AND used_chunks IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 3
    `).all() as Array<{ retrieved_chunks: string; used_chunks: string; id: string }>;

    if (sessions.length < 3) {
      console.log(`[Brain/Tuner] Not enough sessions with ratings to run efficiency auto-tuning (${sessions.length}/3)`);
      return;
    }

    const efficiencies: number[] = [];

    for (const session of sessions) {
      const retrievedList: string[] = JSON.parse(session.retrieved_chunks || "[]");
      const usedList: string[] = JSON.parse(session.used_chunks || "[]");

      const retrievedCount = retrievedList.length;
      const usedCount = usedList.length;

      const efficiency = retrievedCount > 0 ? usedCount / retrievedCount : 1.0;
      efficiencies.push(efficiency);

      console.log(`[Brain/Tuner] Session ${session.id}: retrieved=${retrievedCount}, used=${usedCount}, efficiency=${efficiency.toFixed(2)}`);
    }

    // Check if Context Efficiency was consistently below 0.8 across all 3 sessions
    const consistentlyLow = efficiencies.every(eff => eff < 0.8);

    if (consistentlyLow) {
      // Fetch current max context tokens, defaulting to 4096 if not configured
      const configRow = db.prepare("SELECT value FROM config WHERE key = 'max_context_tokens'").get() as { value: string } | undefined;
      const currentTokens = configRow ? parseInt(configRow.value, 10) : 4096;

      // Auto-reduce tokens by 20% to increase context density and focus
      const newTokens = Math.max(1024, Math.floor(currentTokens * 0.8));

      if (newTokens < currentTokens) {
        db.prepare(`
          INSERT OR REPLACE INTO config (key, value, updated_at)
          VALUES ('max_context_tokens', ?, ?)
        `).run(newTokens.toString(), Date.now());

        console.log(`[Brain/Tuner] ⚠️ Consistently low Context Efficiency detected (<0.8 for 3 sessions).`);
        console.log(`[Brain/Tuner] Auto-tuning max_context_tokens: reduced from ${currentTokens} to ${newTokens} to combat context pollution.`);
      }
    }
  } catch (error: any) {
    console.error(`[Brain/Tuner] Error running closed-loop auto-tuning:`, error.message);
  }
}
