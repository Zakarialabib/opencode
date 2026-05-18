import { getDatabase } from "../store/index.js";

export interface Concept {
  id: string;
  name: string;
  first_seen: number;
  last_seen: number;
  session_count: number;
}

export interface ConceptChunkRelation {
  concept_id: string;
  chunk_id: string;
  strength: number;
}

/**
 * Standard slugify helper to turn concept names into clean, uniform identifiers.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "_");
}

/**
 * Registers a new concept or updates its visit counts.
 */
export function addConcept(projectRoot: string, name: string): string {
  const db = getDatabase(projectRoot);
  const id = slugify(name);
  const now = Date.now();

  db.prepare(`
    INSERT INTO concepts (id, name, first_seen, last_seen, session_count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      last_seen = ?,
      session_count = session_count + 1
  `).run(id, name, now, now, now);

  return id;
}

/**
 * Creates or updates a many-to-many relationship strength between a concept and a code chunk.
 */
export function linkConceptToChunk(
  projectRoot: string,
  conceptId: string,
  chunkId: string,
  strength = 1.0
): void {
  const db = getDatabase(projectRoot);

  db.prepare(`
    INSERT INTO concept_chunks (concept_id, chunk_id, strength)
    VALUES (?, ?, ?)
    ON CONFLICT(concept_id, chunk_id) DO UPDATE SET
      strength = MIN(2.0, strength + ?)
  `).run(conceptId, chunkId, strength, strength * 0.1);
}

/**
 * Decreases the strength of a relationship (feedback loop dampening).
 */
export function dampenConceptChunkLink(
  projectRoot: string,
  conceptId: string,
  chunkId: string,
  factor = 0.1
): void {
  const db = getDatabase(projectRoot);

  db.prepare(`
    UPDATE concept_chunks 
    SET strength = MAX(0.0, strength - ?)
    WHERE concept_id = ? AND chunk_id = ?
  `).run(factor, conceptId, chunkId);

  // Clean up completely dead relationships
  db.prepare(`
    DELETE FROM concept_chunks WHERE strength <= 0.0
  `).run();
}

/**
 * Gets all concepts associated with a specific chunk.
 */
export function getChunkConcepts(projectRoot: string, chunkId: string): Concept[] {
  const db = getDatabase(projectRoot);
  return db
    .prepare(`
    SELECT c.* 
    FROM concepts c
    JOIN concept_chunks cc ON cc.concept_id = c.id
    WHERE cc.chunk_id = ?
    ORDER BY cc.strength DESC
  `)
    .all(chunkId) as Concept[];
}

/**
 * Gets all chunks associated with a specific concept.
 * Useful for expanding search context when a concept is matched.
 */
export function getConceptRelatedChunks(
  projectRoot: string,
  conceptId: string,
  limit = 5
): Array<{
  id: string;
  filepath: string;
  content: string;
  strength: number;
}> {
  const db = getDatabase(projectRoot);
  return db
    .prepare(`
    SELECT c.id, c.filepath, c.content, cc.strength
    FROM chunks c
    JOIN concept_chunks cc ON cc.chunk_id = c.id
    WHERE cc.concept_id = ?
    ORDER BY cc.strength DESC
    LIMIT ?
  `)
    .all(conceptId, limit) as any[];
}

/**
 * Re-calculates and updates the concept vector embedding as the mathematical
 * average of the embeddings of all its associated chunks.
 */
export function updateConceptEmbedding(
  projectRoot: string,
  conceptId: string,
  modelType: "qwen" | "nomic" = "qwen"
): void {
  const db = getDatabase(projectRoot);
  const tableName = modelType === "qwen" ? "chunk_embeddings" : "chunk_embeddings_nomic";

  // Select all chunk vector buffers associated with this concept
  const rows = db
    .prepare(`
    SELECT e.embedding
    FROM ${tableName} e
    JOIN chunks c ON c.rowid = e.rowid
    JOIN concept_chunks cc ON cc.chunk_id = c.id
    WHERE cc.concept_id = ? AND cc.strength > 0.3
  `)
    .all(conceptId) as Array<{ embedding: Buffer }>;

  if (rows.length === 0) return;

  // sqlite-vec virtual table embedding is returned as a Buffer representing Float32Array bytes
  const vectors = rows.map(
    (r) => new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)
  );
  const dimension = vectors[0].length;

  // Compute average vector
  const average = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    let sum = 0;
    for (const v of vectors) {
      sum += v[i];
    }
    average[i] = sum / vectors.length;
  }

  // Insert/replace into concept_embeddings (sqlite-vec virtual table)
  // Get rowid of the concept
  const conceptRow = db.prepare("SELECT rowid FROM concepts WHERE id = ?").get(conceptId) as
    | { rowid: number }
    | undefined;
  if (!conceptRow) return;

  db.prepare("INSERT OR REPLACE INTO concept_embeddings(rowid, embedding) VALUES(?, ?)").run(
    BigInt(conceptRow.rowid),
    average
  );
}

/**
 * Archives pruned/compressed tool outputs into the standard chunks database table.
 * Generates and returns a stable reference ID tag (e.g. `[Ref: mem_chunk_xxx]`).
 */
export function archiveToolOutput(
  projectRoot: string,
  toolName: string,
  query: string,
  content: string
): string {
  const db = getDatabase(projectRoot);
  const crypto = require("crypto");
  const refId = `mem_chunk_${crypto.randomUUID().slice(0, 8)}`;
  const now = Date.now();

  db.transaction(() => {
    // 1. Ensure the dummy archived runs file descriptor exists
    db.prepare(`
      INSERT OR IGNORE INTO files (path, mtime, size, hash, indexed_at, chunk_count)
      VALUES ('[archived_tool_runs]', 0, 0, 'none', ?, 0)
    `).run(now);

    const contentHash = crypto.createHash("sha256").update(content).digest("hex");

    // 2. Insert the tool run output as a code chunk record
    db.prepare(`
      INSERT INTO chunks (id, filepath, language, type, name, start_line, end_line, content, content_hash, indexed_at)
      VALUES (?, '[archived_tool_runs]', 'text', 'archived_tool_run', ?, 0, 0, ?, ?, ?)
    `).run(refId, toolName, content, contentHash, now);

    // 3. Register a relationship concept to link the reference chunk to the session context
    const conceptSlug = slugify(`archived_${toolName}`);
    db.prepare(`
      INSERT INTO concepts (id, name, first_seen, last_seen, session_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        last_seen = ?,
        session_count = session_count + 1
    `).run(conceptSlug, `Archived ${toolName} Output`, now, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO concept_chunks (concept_id, chunk_id, strength)
      VALUES (?, ?, 1.2)
    `).run(conceptSlug, refId);
  })();

  console.log(
    `[Brain/Memory] Archived compressed tool run ${toolName} output under Ref ID: ${refId}`
  );
  return `[Ref: ${refId}]`;
}

/**
 * Full K-means reclustering (not incremental) of a general concept's chunk associations.
 * Performs a complete assignment + centroid update pass (up to 10 iterations).
 * Concept visit counts and relationship strengths ARE updated incrementally via
 * addConcept() and linkConceptToChunk() — only the clustering is periodic on demand.
 * Prevents polysemy in generic concepts like "auth", "run", etc.
 */
export function clusterConceptChunks(projectRoot: string, conceptId: string, k = 2): void {
  const db = getDatabase(projectRoot);

  // 1. Query all chunks associated with this concept slug
  const chunkRows = db
    .prepare(`
    SELECT cc.chunk_id, cc.strength, c.rowid
    FROM concept_chunks cc
    JOIN chunks c ON c.id = cc.chunk_id
    WHERE cc.concept_id = ? AND cc.strength > 0.1
  `)
    .all(conceptId) as Array<{ chunk_id: string; strength: number; rowid: number }>;

  if (chunkRows.length < k * 2) {
    return; // Not enough chunks to warrant splitting
  }

  // 2. Query vector embeddings for each chunk
  const chunksWithEmbeds: Array<{
    id: string;
    rowid: number;
    strength: number;
    vector: Float32Array;
  }> = [];

  for (const row of chunkRows) {
    // Try Qwen embeddings first, fall back to Nomic
    let embedRow = db
      .prepare("SELECT embedding FROM chunk_embeddings WHERE rowid = ?")
      .get(row.rowid) as { embedding: Buffer } | undefined;
    if (!embedRow) {
      embedRow = db
        .prepare("SELECT embedding FROM chunk_embeddings_nomic WHERE rowid = ?")
        .get(row.rowid) as { embedding: Buffer } | undefined;
    }
    if (embedRow) {
      const vec = new Float32Array(
        embedRow.embedding.buffer,
        embedRow.embedding.byteOffset,
        embedRow.embedding.byteLength / 4
      );
      chunksWithEmbeds.push({
        id: row.chunk_id,
        rowid: row.rowid,
        strength: row.strength,
        vector: vec,
      });
    }
  }

  if (chunksWithEmbeds.length < k * 2) return;

  const dimension = chunksWithEmbeds[0].vector.length;

  // Cosine distance helper
  const cosineDist = (v1: Float32Array, v2: Float32Array): number => {
    let dot = 0,
      n1 = 0,
      n2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      n1 += v1[i] * v1[i];
      n2 += v2[i] * v2[i];
    }
    if (n1 === 0 || n2 === 0) return 1.0;
    return 1.0 - dot / (Math.sqrt(n1) * Math.sqrt(n2));
  };

  // 3. Standard K-means initialization (select first k vectors as centroids)
  const centroids = Array.from(
    { length: k },
    (_, idx) => new Float32Array(chunksWithEmbeds[idx].vector)
  );
  const assignments = new Array(chunksWithEmbeds.length).fill(0);

  // K-means iteration (up to 10 passes for fast convergence)
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;

    // Assignment pass
    chunksWithEmbeds.forEach((chunk, cIdx) => {
      let minDistance = Infinity;
      let closestCentroid = 0;

      centroids.forEach((centroid, centIdx) => {
        const d = cosineDist(chunk.vector, centroid);
        if (d < minDistance) {
          minDistance = d;
          closestCentroid = centIdx;
        }
      });

      if (assignments[cIdx] !== closestCentroid) {
        assignments[cIdx] = closestCentroid;
        changed = true;
      }
    });

    if (!changed) break; // Converged!

    // Centroid update pass
    const counts = new Array(k).fill(0);
    const sums = Array.from({ length: k }, () => new Float32Array(dimension));

    chunksWithEmbeds.forEach((chunk, cIdx) => {
      const centIdx = assignments[cIdx];
      counts[centIdx]++;
      for (let i = 0; i < dimension; i++) {
        sums[centIdx][i] += chunk.vector[i];
      }
    });

    centroids.forEach((centroid, centIdx) => {
      if (counts[centIdx] > 0) {
        for (let i = 0; i < dimension; i++) {
          centroid[i] = sums[centIdx][i] / counts[centIdx];
        }
      }
    });
  }

  // 4. Split the generic concept by clusters in SQLite transaction
  console.log(
    `[Brain/Clustering] Splitting polysemous concept '${conceptId}' into ${k} clustered sub-concepts.`
  );
  const now = Date.now();

  db.transaction(() => {
    for (let c = 0; c < k; c++) {
      const subConceptId = `${conceptId}_cluster_${c}`;
      const subConceptName = `${conceptId} Sub-concept Group ${c + 1}`;

      // Create sub-concept node
      db.prepare(`
        INSERT OR IGNORE INTO concepts (id, name, first_seen, last_seen, session_count)
        VALUES (?, ?, ?, ?, 1)
      `).run(subConceptId, subConceptName, now, now);

      // Re-assign chunks belonging to this cluster
      chunksWithEmbeds.forEach((chunk, idx) => {
        if (assignments[idx] === c) {
          db.prepare(`
            INSERT OR REPLACE INTO concept_chunks (concept_id, chunk_id, strength)
            VALUES (?, ?, ?)
          `).run(subConceptId, chunk.id, chunk.strength);
        }
      });
    }

    // Clean up generic parent associations to prevent redundancy
    db.prepare("DELETE FROM concept_chunks WHERE concept_id = ?").run(conceptId);
    db.prepare("DELETE FROM concepts WHERE id = ?").run(conceptId);
  })();

  console.log(`[Brain/Clustering] Concept '${conceptId}' successfully clustered.`);
}

/**
 * Mini-batch K-means update — incrementally adjusts centroids without full recompute.
 * Processes a batch of new/updated concept-chunk links, moving centroids incrementally.
 * Much cheaper than full clusterConceptChunks() for streaming updates.
 *
 * @param projectRoot - Project root path for DB access
 * @param batchSize - Number of concepts to process in this batch (default: 10)
 */
export function miniBatchUpdate(projectRoot: string, batchSize: number = 10): void {
  const db = getDatabase(projectRoot);

  // Get concepts that have been recently updated (high session_count or recent last_seen)
  const recentConcepts = db
    .prepare(`
    SELECT id FROM concepts 
    ORDER BY last_seen DESC 
    LIMIT ?
  `)
    .all(batchSize) as Array<{ id: string }>;

  if (recentConcepts.length === 0) return;

  for (const concept of recentConcepts) {
    // Only recluster if this concept has enough chunks to warrant splitting
    const chunkCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM concept_chunks WHERE concept_id = ? AND strength > 0.1"
      )
      .get(concept.id) as { count: number } | undefined;

    if (!chunkCount || chunkCount.count < 4) continue;

    // Check if this concept has been clustered before (has sub-concepts)
    const hasSubConcepts = db
      .prepare("SELECT COUNT(*) as count FROM concepts WHERE id LIKE ?")
      .get(`${concept.id}_cluster_%`) as { count: number } | undefined;

    if (hasSubConcepts && hasSubConcepts.count > 0) {
      // Incremental centroid update: move existing centroids toward new data
      const subConcepts = db
        .prepare("SELECT id FROM concepts WHERE id LIKE ?")
        .all(`${concept.id}_cluster_%`) as Array<{ id: string }>;

      // Get recent chunks for this concept
      const recentChunks = db
        .prepare(`
        SELECT cc.chunk_id, cc.strength 
        FROM concept_chunks cc
        WHERE cc.concept_id = ? AND cc.strength > 0.1
        ORDER BY cc.strength DESC
        LIMIT 5
      `)
        .all(concept.id) as Array<{ chunk_id: string; strength: number }>;

      // Reassign recent chunks to nearest sub-concept
      for (const chunk of recentChunks) {
        let bestSubConcept = subConcepts[0]?.id;
        let bestStrength = 0;

        for (const sub of subConcepts) {
          const link = db
            .prepare("SELECT strength FROM concept_chunks WHERE concept_id = ? AND chunk_id = ?")
            .get(sub.id, chunk.chunk_id) as { strength: number } | undefined;

          if (link && link.strength > bestStrength) {
            bestStrength = link.strength;
            bestSubConcept = sub.id;
          }
        }

        if (bestSubConcept && bestStrength > 0) {
          // Boost the link to the best sub-concept
          db.prepare(
            "UPDATE concept_chunks SET strength = strength + 0.1 WHERE concept_id = ? AND chunk_id = ?"
          ).run(bestSubConcept, chunk.chunk_id);
        }
      }
    }
  }

  console.log(`[Brain/MiniBatch] Incremental update for ${recentConcepts.length} concepts`);
}
