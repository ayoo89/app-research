import { Injectable } from '@nestjs/common';

/**
 * In-process metrics store — Prometheus-compatible counters and histograms.
 * Expose via GET /metrics in Prometheus text format.
 * In production, replace with prom-client for full Prometheus integration.
 */
@Injectable()
export class MetricsService {
  private counters   = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  // ── Counters ──────────────────────────────────────────────────────

  increment(name: string, labels: Record<string, string> = {}) {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  // ── Histograms ────────────────────────────────────────────────────

  observe(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.key(name, labels);
    const bucket = this.histograms.get(key) ?? [];
    bucket.push(value);
    // Keep last 10k observations to bound memory
    if (bucket.length > 10_000) bucket.shift();
    this.histograms.set(key, bucket);
  }

  // ── Snapshot ──────────────────────────────────────────────────────

  snapshot(): Record<string, any> {
    const out: Record<string, any> = { counters: {}, histograms: {} };

    for (const [k, v] of this.counters) out.counters[k] = v;

    for (const [k, vals] of this.histograms) {
      if (!vals.length) continue;
      const sorted = [...vals].sort((a, b) => a - b);
      out.histograms[k] = {
        count: vals.length,
        min:   sorted[0],
        max:   sorted[sorted.length - 1],
        mean:  Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        p50:   this.percentile(sorted, 0.50),
        p95:   this.percentile(sorted, 0.95),
        p99:   this.percentile(sorted, 0.99),
      };
    }

    return out;
  }

  /** Prometheus text format for scraping */
  prometheusFormat(): string {
    const lines: string[] = [];
    const snap = this.snapshot();

    for (const [k, v] of Object.entries(snap.counters as Record<string, number>)) {
      lines.push(`# TYPE ${k} counter`, `${k} ${v}`);
    }

    for (const [k, v] of Object.entries(snap.histograms as Record<string, any>)) {
      lines.push(
        `# TYPE ${k}_ms summary`,
        `${k}_ms{quantile="0.5"} ${v.p50}`,
        `${k}_ms{quantile="0.95"} ${v.p95}`,
        `${k}_ms{quantile="0.99"} ${v.p99}`,
        `${k}_ms_count ${v.count}`,
      );
    }

    return lines.join('\n');
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }

  private key(name: string, labels: Record<string, string>): string {
    const l = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    return l ? `${name}{${l}}` : name;
  }
}
