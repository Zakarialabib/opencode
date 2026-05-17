import { getDatabase } from "../store";
import { searchKeywordFTS } from "../store/fts";

export interface KeywordSearchResult {
  id: string;
  filepath: string;
  language: string;
  type: string;
  name: string;
  start_line: number;
  end_line: number;
  parent_id: string | null;
  content: string;
  score: number; // raw BM25 score (-bm25 rank)
}

/**
 * Searches the SQLite FTS5 index for lexical matching terms.
 * Matches prefix and wildcard terms, returning results ranked by BM25.
 */
export function getKeywordMatches(
  projectRoot: string,
  query: string,
  limit: number
): KeywordSearchResult[] {
  const db = getDatabase(projectRoot);
  return searchKeywordFTS(db, query, limit);
}
