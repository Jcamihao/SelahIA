import { Injectable } from '@nestjs/common';

type Labels = Record<string, string>;
type Series = { labels: Labels; value: number };
type HistogramSeries = {
  labels: Labels;
  counts: number[];
  sum: number;
  count: number;
};
type GaugeSample = { labels?: Labels; value: number };

const APP_NAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
// Teto de apps distintos no label `app`: no modo legado o nome vem de um header que o chamador
// escolhe, e sem teto um chamador poderia criar series infinitas na memoria.
const MAX_APP_LABEL_VALUES = 50;
const SECONDS_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 45, 90, 120];

const escapeLabel = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
const escapeHelp = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
const seriesKey = (labels: Labels) =>
  Object.keys(labels)
    .sort()
    .map((name) => `${name}=${labels[name]}`)
    .join('\u0000');
const renderLabels = (labels: Labels) => {
  const names = Object.keys(labels).sort();
  return names.length
    ? `{${names.map((name) => `${name}="${escapeLabel(labels[name])}"`).join(',')}}`
    : '';
};

// Metricas no formato texto do Prometheus, sem dependencia externa. So contadores, histogramas e
// gauges; nunca recebe conteudo de requisicao (so app, rota, status e numeros).
@Injectable()
export class MetricsService {
  private readonly counters = new Map<
    string,
    { help: string; series: Map<string, Series> }
  >();
  private readonly histograms = new Map<
    string,
    {
      help: string;
      buckets: number[];
      series: Map<string, HistogramSeries>;
    }
  >();
  private readonly gauges = new Map<
    string,
    { help: string; collect: () => GaugeSample[] }
  >();
  private readonly appValues = new Set<string>();

  constructor() {
    this.defineCounter(
      'selah_http_requests_total',
      'Requisicoes HTTP respondidas, por app, metodo, rota e status.',
    );
    this.defineHistogram(
      'selah_http_request_duration_seconds',
      'Duracao das requisicoes HTTP em segundos.',
    );
    this.defineCounter(
      'selah_llm_calls_total',
      'Chamadas ao LLM por app, modo e resultado (ok, quota, busy, circuit_open, budget, upstream_error, invalid_response, error).',
    );
    this.defineHistogram(
      'selah_llm_call_duration_seconds',
      'Duracao das chamadas ao provedor de LLM em segundos (so as que chegaram ao provedor).',
    );
    this.defineCounter(
      'selah_llm_tokens_total',
      'Tokens consumidos por app e tipo (prompt, output, total), conforme o provedor reporta.',
    );
    this.defineCounter(
      'selah_llm_circuit_transitions_total',
      'Mudancas de estado do circuit breaker do LLM.',
    );
  }

  defineCounter(name: string, help: string) {
    if (!this.counters.has(name)) {
      this.counters.set(name, { help, series: new Map() });
    }
  }

  defineHistogram(
    name: string,
    help: string,
    buckets: number[] = SECONDS_BUCKETS,
  ) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { help, buckets, series: new Map() });
    }
  }

  // Gauge calculado na hora do scrape (ex.: chamadas em andamento).
  defineGauge(name: string, help: string, collect: () => GaugeSample[]) {
    this.gauges.set(name, { help, collect });
  }

  inc(name: string, labels: Labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (!counter || !Number.isFinite(value) || value <= 0) return;
    const normalized = this.normalize(labels);
    const key = seriesKey(normalized);
    const series = counter.series.get(key);
    if (series) {
      series.value += value;
    } else {
      counter.series.set(key, { labels: normalized, value });
    }
  }

  observe(name: string, labels: Labels, seconds: number) {
    const histogram = this.histograms.get(name);
    if (!histogram || !Number.isFinite(seconds) || seconds < 0) return;
    const normalized = this.normalize(labels);
    const key = seriesKey(normalized);
    let series = histogram.series.get(key);
    if (!series) {
      series = {
        labels: normalized,
        counts: histogram.buckets.map(() => 0),
        sum: 0,
        count: 0,
      };
      histogram.series.set(key, series);
    }
    histogram.buckets.forEach((limit, index) => {
      if (seconds <= limit) series!.counts[index] += 1;
    });
    series.sum += seconds;
    series.count += 1;
  }

  recordHttp(input: {
    app: string;
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }) {
    const labels = {
      app: input.app,
      method: input.method,
      route: input.route,
      status: String(input.status),
    };
    this.inc('selah_http_requests_total', labels);
    this.observe(
      'selah_http_request_duration_seconds',
      { app: input.app, route: input.route },
      input.durationMs / 1000,
    );
  }

  render(): string {
    const lines: string[] = [];

    for (const [name, counter] of this.counters) {
      lines.push(`# HELP ${name} ${escapeHelp(counter.help)}`);
      lines.push(`# TYPE ${name} counter`);
      for (const series of counter.series.values()) {
        lines.push(`${name}${renderLabels(series.labels)} ${series.value}`);
      }
    }

    for (const [name, histogram] of this.histograms) {
      lines.push(`# HELP ${name} ${escapeHelp(histogram.help)}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const series of histogram.series.values()) {
        histogram.buckets.forEach((limit, index) => {
          lines.push(
            `${name}_bucket${renderLabels({ ...series.labels, le: String(limit) })} ${series.counts[index]}`,
          );
        });
        lines.push(
          `${name}_bucket${renderLabels({ ...series.labels, le: '+Inf' })} ${series.count}`,
        );
        lines.push(`${name}_sum${renderLabels(series.labels)} ${series.sum}`);
        lines.push(
          `${name}_count${renderLabels(series.labels)} ${series.count}`,
        );
      }
    }

    for (const [name, gauge] of this.gauges) {
      lines.push(`# HELP ${name} ${escapeHelp(gauge.help)}`);
      lines.push(`# TYPE ${name} gauge`);
      for (const sample of gauge.collect()) {
        lines.push(
          `${name}${renderLabels(sample.labels ?? {})} ${sample.value}`,
        );
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private normalize(labels: Labels): Labels {
    const normalized: Labels = {};
    for (const [name, value] of Object.entries(labels)) {
      normalized[name] = name === 'app' ? this.safeApp(value) : String(value);
    }
    return normalized;
  }

  private safeApp(app: string) {
    if (!APP_NAME_PATTERN.test(String(app))) return 'invalid';
    if (this.appValues.has(app)) return app;
    if (this.appValues.size >= MAX_APP_LABEL_VALUES) return 'other';
    this.appValues.add(app);
    return app;
  }
}
