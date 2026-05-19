export interface SearchResult {
  id: string;
  filepath: string;
  start_line: number;
  end_line: number;
  content: string;
  score: number;
}

export interface DiagnosticInfo {
  storage: {
    chunks: number;
    vectors: number;
    concepts: number;
    sessions: number;
  };
  vector: {
    active: boolean;
    version: string;
  };
  fts: {
    active: boolean;
    records: number;
  };
  lmStudio: {
    connected: boolean;
    models: string[];
  };
}

export interface SearchMetrics {
  precisionAtK: number[];
  mrr: number;
  avgLatencyMs: number;
  efficiency: number;
}

export interface BenchmarkResult {
  overallScore: number;
  tasksRun: number;
  metrics: SearchMetrics;
}

export function formatSearchResults(
  results: SearchResult[],
  query: string,
  timing: number
): string {
  const lines: string[] = [];

  lines.push(`## Search Results`);
  lines.push(`\n**Query:** ${query}`);
  lines.push(`**Found:** ${results.length} results in ${timing.toFixed(2)}ms\n`);

  results.forEach((result, index) => {
    const scorePercent = (result.score * 100).toFixed(1);
    const contentPreview = result.content.length > 200 
      ? result.content.substring(0, 200) + '...' 
      : result.content;

    lines.push(`### Result ${index + 1} (${scorePercent}%)`);
    lines.push(`- **File:** ${result.filepath}`);
    lines.push(`- **Lines:** ${result.start_line}-${result.end_line}`);
    lines.push(`- **Content:**`);
    lines.push('```');
    lines.push(contentPreview);
    lines.push('```');
    lines.push('');
  });

  return lines.join('\n');
}

export function formatDiagnostic(info: DiagnosticInfo): string {
  const lines: string[] = [];

  lines.push('## System Diagnostic\n');

  lines.push('### Storage');
  lines.push(`- Chunks: ${info.storage.chunks}`);
  lines.push(`- Vectors: ${info.storage.vectors}`);
  lines.push(`- Concepts: ${info.storage.concepts}`);
  lines.push(`- Sessions: ${info.storage.sessions}\n`);

  lines.push('### Vector Store');
  lines.push(`- Active: ${info.vector.active ? '✓' : '✗'}`);
  lines.push(`- Version: ${info.vector.version}\n`);

  lines.push('### Full-Text Search');
  lines.push(`- Active: ${info.fts.active ? '✓' : '✗'}`);
  lines.push(`- Records: ${info.fts.records}\n`);

  lines.push('### LM Studio');
  lines.push(`- Connected: ${info.lmStudio.connected ? '✓' : '✗'}`);
  lines.push(`- Models: ${info.lmStudio.models.length > 0 ? info.lmStudio.models.join(', ') : 'None'}`);

  return lines.join('\n');
}

export function formatMetrics(metrics: SearchMetrics): string {
  const lines: string[] = [];

  lines.push('## Search Metrics\n');

  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Precision@K | ${metrics.precisionAtK.map(p => (p * 100).toFixed(1) + '%').join(', ')} |`);
  lines.push(`| MRR | ${(metrics.mrr * 100).toFixed(1)}% |`);
  lines.push(`| Avg Latency | ${metrics.avgLatencyMs.toFixed(2)}ms |`);
  lines.push(`| Efficiency | ${(metrics.efficiency * 100).toFixed(1)}% |`);

  return lines.join('\n');
}

export function formatBenchmarkResult(result: BenchmarkResult): string {
  const lines: string[] = [];

  lines.push('## Benchmark Results\n');

  lines.push(`**Overall Score:** ${(result.overallScore * 100).toFixed(1)}%`);
  lines.push(`**Tasks Run:** ${result.tasksRun}\n`);

  lines.push('### Metrics Breakdown\n');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Precision@K | ${result.metrics.precisionAtK.map(p => (p * 100).toFixed(1) + '%').join(', ')} |`);
  lines.push(`| MRR | ${(result.metrics.mrr * 100).toFixed(1)}% |`);
  lines.push(`| Avg Latency | ${result.metrics.avgLatencyMs.toFixed(2)}ms |`);
  lines.push(`| Efficiency | ${(result.metrics.efficiency * 100).toFixed(1)}% |`);

  return lines.join('\n');
}
