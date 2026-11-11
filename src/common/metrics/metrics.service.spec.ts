import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('renderiza contadores com labels ordenados e escapados', () => {
    const metrics = new MetricsService();
    metrics.inc('selah_llm_calls_total', {
      outcome: 'ok',
      app: 'A',
      mode: 'text',
    });
    metrics.inc(
      'selah_llm_calls_total',
      { outcome: 'ok', app: 'A', mode: 'text' },
      2,
    );

    const text = metrics.render();
    expect(text).toContain('# TYPE selah_llm_calls_total counter');
    expect(text).toContain(
      'selah_llm_calls_total{app="A",mode="text",outcome="ok"} 3',
    );
  });

  it('histograma: buckets acumulativos, +Inf, soma e contagem', () => {
    const metrics = new MetricsService();
    metrics.observe('selah_llm_call_duration_seconds', { app: 'A' }, 0.04);
    metrics.observe('selah_llm_call_duration_seconds', { app: 'A' }, 3);

    const text = metrics.render();
    expect(text).toContain(
      'selah_llm_call_duration_seconds_bucket{app="A",le="0.05"} 1',
    );
    expect(text).toContain(
      'selah_llm_call_duration_seconds_bucket{app="A",le="2.5"} 1',
    );
    expect(text).toContain(
      'selah_llm_call_duration_seconds_bucket{app="A",le="5"} 2',
    );
    expect(text).toContain(
      'selah_llm_call_duration_seconds_bucket{app="A",le="+Inf"} 2',
    );
    expect(text).toContain('selah_llm_call_duration_seconds_sum{app="A"} 3.04');
    expect(text).toContain('selah_llm_call_duration_seconds_count{app="A"} 2');
  });

  it('gauge e coletado na hora do scrape', () => {
    const metrics = new MetricsService();
    let value = 1;
    metrics.defineGauge('selah_test_gauge', 'teste', () => [{ value }]);
    expect(metrics.render()).toContain('selah_test_gauge 1');
    value = 7;
    expect(metrics.render()).toContain('selah_test_gauge 7');
  });

  it('escapa aspas, barra e quebra de linha em valores de label', () => {
    const metrics = new MetricsService();
    metrics.inc('selah_http_requests_total', {
      route: 'a"b\\c\nd',
      app: 'A',
      method: 'GET',
      status: '200',
    });
    expect(metrics.render()).toContain('route="a\\"b\\\\c\\nd"');
  });

  it('app com nome fora do padrao vira "invalid" e passar de 50 apps vira "other"', () => {
    const metrics = new MetricsService();
    metrics.inc('selah_llm_calls_total', {
      app: 'a b"{}',
      mode: 'text',
      outcome: 'ok',
    });
    for (let i = 0; i < 60; i++) {
      metrics.inc('selah_llm_calls_total', {
        app: `App${i}`,
        mode: 'text',
        outcome: 'ok',
      });
    }
    const text = metrics.render();
    expect(text).toContain('app="invalid"');
    expect(text).toContain('app="App0"');
    expect(text).toContain('app="other"');
    expect(text).not.toContain('app="App59"');
  });

  it('ignora metrica nao definida e valores invalidos', () => {
    const metrics = new MetricsService();
    metrics.inc('nao_existe', {});
    metrics.inc('selah_llm_calls_total', { app: 'A' }, NaN);
    metrics.observe('selah_llm_call_duration_seconds', { app: 'A' }, -1);
    const text = metrics.render();
    expect(text).not.toContain('nao_existe');
    expect(text).not.toContain('selah_llm_calls_total{');
    expect(text).not.toContain('selah_llm_call_duration_seconds_count');
  });

  it('recordHttp conta a requisicao e a duracao', () => {
    const metrics = new MetricsService();
    metrics.recordHttp({
      app: 'LumenBack',
      method: 'POST',
      route: '/v1/x',
      status: 200,
      durationMs: 120,
    });
    const text = metrics.render();
    expect(text).toContain(
      'selah_http_requests_total{app="LumenBack",method="POST",route="/v1/x",status="200"} 1',
    );
    expect(text).toContain(
      'selah_http_request_duration_seconds_count{app="LumenBack",route="/v1/x"} 1',
    );
  });
});
