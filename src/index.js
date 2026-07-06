// src/index.js
// Hermes/Praevisus — usando NVIDIA NIM (DeepSeek-V4-Pro)

import { saveRun } from './supabase.js';
import { testSupabaseCredentials } from './test-supabase.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, false));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isSmokeTest = url.pathname === '/test' || url.searchParams.get('test') === '1';
    const isFullRun = url.searchParams.get('run') === '1';

    if (url.pathname === '/test-supabase') {
      const result = await testSupabaseCredentials(env);
      return Response.json(result, { status: result.ok ? 200 : 500 });
    }

    if (isSmokeTest) {
      ctx.waitUntil(runMonitor(env, true));
      return new Response('✅ Monitor executado em background! Verifique os logs.', { status: 200 });
    }

    if (isFullRun) {
      ctx.waitUntil(runMonitor(env, false));
      return new Response('✅ Execução completa disparada em background! Verifique os logs.', { status: 200 });
    }

    return new Response('📡 Praevisus ativo. Use /test, /test-supabase ou ?run=1 para executar uma rodada manual.', { status: 200 });
  }
};

function makeTimestampKey(prefix) {
  return `${prefix}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function detectDomain(title, summary = '') {
  const haystack = `${title} ${summary}`.toLowerCase();
  const groups = {
    geopolítica: ['guerra', 'sanção', 'sancao', 'onu', 'israel', 'ucrânia', 'ucrania', 'eua', 'china', 'fed'],
    economia: ['dólar', 'dolar', 'selic', 'juros', 'inflação', 'inflacao', 'mercado', 'câmbio', 'cambio', 'bcb'],
    clima: ['chuva', 'tempestade', 'seca', 'onda de calor', 'frio', 'enchente', 'clima', 'inmet'],
    regulação: ['regulação', 'regulacao', 'norma', 'resolução', 'resolucao', 'anvisa', 'receita', 'lei', 'decreto'],
    saúde: ['saúde', 'saude', 'dengue', 'surto', 'vacina', 'hantavírus', 'hantavirus', 'covid'],
    logística: ['frete', 'combust', 'porto', 'rodovia', 'abastecimento', 'carga', 'estoque', 'alimento'],
  };

  for (const [domain, keywords] of Object.entries(groups)) {
    if (keywords.some(keyword => haystack.includes(keyword))) {
      return domain;
    }
  }

  return 'outros';
}

function localImpactHint(title, summary = '') {
  const haystack = `${title} ${summary}`.toLowerCase();
  const hints = ['ribeirão', 'ribeirao', 'sp', 'são paulo', 'sao paulo', 'bcb', 'pix', 'selic', 'dólar', 'dolar', 'saúde', 'saude'];
  return hints.some(keyword => haystack.includes(keyword));
}

function parseFeedEntries(feedUrl, text) {
  const blocks = [...text.matchAll(/<item[\s\S]*?<\/item>/gi)];
  const entries = blocks.length > 0 ? blocks.map(match => match[0]) : [...text.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map(match => match[0]);
  const items = [];

  for (const block of entries) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const publishedMatch = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    const summaryMatch = block.match(/<(?:description|summary|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    const publishedAt = publishedMatch ? publishedMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
    const summary = summaryMatch ? summaryMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

    if (!title || !link) {
      continue;
    }

    items.push({
      source: feedUrl,
      title,
      link,
      published_at: publishedAt,
      summary
    });
  }

  return items;
}

function analyzeFallback(sourceItem) {
  const domain = detectDomain(sourceItem.title, sourceItem.summary);
  const likelySignal = localImpactHint(sourceItem.title, sourceItem.summary) || domain !== 'outros';

  return {
    source: sourceItem.source,
    title: sourceItem.title,
    link: sourceItem.link,
    published_at: sourceItem.published_at,
    domain,
    verdict: likelySignal ? 'signal' : 'noise',
    confidence: likelySignal ? 0.65 : 0.25,
    cui_bono: likelySignal ? 'Sinal localizado por heurística local.' : 'Sem indício forte de impacto local.',
    local_impact: likelySignal ? 'Impacto local plausível, validar manualmente.' : 'Impacto local não evidente.',
    action: likelySignal ? 'Monitorar e validar em seguida.' : 'Seguir acompanhando sem escalada.',
    horizon_hours: likelySignal ? 24 : null,
    specialist_briefs: [],
    raw: { mode: 'fallback' }
  };
}

function normalizeAiItem(sourceItem, aiEntry = {}) {
  const classification = String(aiEntry.classificacao ?? aiEntry.verdict ?? aiEntry.classification ?? '').toLowerCase();
  const verdict = classification === 'signal' || classification === 'sinal' ? 'signal' : 'noise';
  const domain = aiEntry.domain ?? aiEntry.dominio ?? detectDomain(sourceItem.title, sourceItem.summary);
  const confidenceValue = Number(aiEntry.confidence ?? aiEntry.confianca ?? (verdict === 'signal' ? 0.8 : 0.2));
  const confidence = Number.isFinite(confidenceValue) ? confidenceValue : verdict === 'signal' ? 0.8 : 0.2;
  const specialistBriefs = Array.isArray(aiEntry.specialist_briefs) ? aiEntry.specialist_briefs : [];

  return {
    source: sourceItem.source,
    title: sourceItem.title,
    link: sourceItem.link,
    published_at: sourceItem.published_at,
    domain,
    verdict,
    confidence,
    cui_bono: String(aiEntry.motivo ?? aiEntry.cui_bono ?? ''),
    local_impact: String(aiEntry.impacto_local ?? aiEntry.local_impact ?? (verdict === 'signal' ? 'Impacto local potencial.' : 'Sem impacto local relevante.')),
    action: String(aiEntry.acao ?? aiEntry.action ?? (verdict === 'signal' ? 'Monitorar imediatamente.' : 'Sem ação prioritária.')),
    horizon_hours: aiEntry.janela_horas ?? aiEntry.horizon_hours ?? (verdict === 'signal' ? 24 : null),
    specialist_briefs: specialistBriefs,
    raw: aiEntry
  };
}

function normalizeAiResults(sourceItems, rawResults) {
  const entries = Array.isArray(rawResults)
    ? rawResults
    : Array.isArray(rawResults?.items)
      ? rawResults.items
      : Array.isArray(rawResults?.results)
        ? rawResults.results
        : [];

  const byId = new Map();
  const byTitle = new Map();
  sourceItems.forEach((item, index) => {
    byId.set(index + 1, item);
    byTitle.set(item.title.toLowerCase(), item);
  });

  const analyses = [];
  for (const entry of entries) {
    const resolvedSource =
      byId.get(Number(entry?.id)) ||
      byTitle.get(String(entry?.titulo ?? entry?.title ?? '').toLowerCase());

    if (!resolvedSource) {
      continue;
    }

    analyses.push(normalizeAiItem(resolvedSource, entry));
  }

  if (analyses.length === 0) {
    return sourceItems.map(analyzeFallback);
  }

  const seen = new Set(analyses.map(item => item.title.toLowerCase()));
  for (const sourceItem of sourceItems) {
    if (!seen.has(sourceItem.title.toLowerCase())) {
      analyses.push(analyzeFallback(sourceItem));
    }
  }

  return analyses;
}

function buildAlertLevel(signalCount) {
  if (signalCount >= 3) return 'red';
  if (signalCount > 0) return 'yellow';
  return 'green';
}

function buildReportHtml(runAt, feedUrls, analyses, summary) {
  const signalRows = analyses
    .filter(item => item.verdict === 'signal')
    .map(item => `<li><strong>${item.title}</strong> — ${item.cui_bono}</li>`)
    .join('');

  const feedList = feedUrls.map(feed => `<li>${feed}</li>`).join('');
  const breakdownList = Object.entries(summary.domain_breakdown)
    .map(([domain, count]) => `<li>${domain}: ${count}</li>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Praevisus Crivo</title>
</head>
<body>
  <h1>Praevisus Crivo</h1>
  <p>Executado em: ${runAt.toISOString()}</p>
  <p>Itens analisados: ${summary.item_count}</p>
  <p>Sinais: ${summary.signal_count}</p>
  <p>Ruído: ${summary.noise_count}</p>
  <p>Alerta: ${summary.alert_level}</p>
  <h2>Feeds</h2>
  <ul>${feedList}</ul>
  <h2>Distribuição por domínio</h2>
  <ul>${breakdownList}</ul>
  <h2>Sinais</h2>
  <ul>${signalRows || '<li>Nenhum sinal crítico.</li>'}</ul>
</body>
</html>`;
}

async function runMonitor(env, isTest = false) {
  const NVIDIA_API_KEY = env.NVIDIA_API_KEY;
  if (!NVIDIA_API_KEY) {
    console.error('❌ NVIDIA_API_KEY não configurada. Adicione via wrangler secret.');
    return;
  }

  console.log('🛰️ Praevisus iniciando coleta...');

  const feeds = [
    'https://g1.globo.com/rss/g1/',
    'https://feeds.folha.uol.com.br/folha/mercado/rss091.xml'
  ];

  let sourceItems = [];
  let feedErrors = 0;
  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl);
      const text = await resp.text();
      sourceItems.push(...parseFeedEntries(feedUrl, text));
    } catch (e) {
      feedErrors += 1;
      console.error(`Erro ao buscar feed: ${feedUrl}`, e);
    }
  }

  const dedupedItems = [];
  const seenKeys = new Set();
  for (const item of sourceItems) {
    const key = `${item.link.toLowerCase()}::${item.title.toLowerCase()}`;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    dedupedItems.push(item);
  }
  sourceItems = dedupedItems;

  if (isTest) {
    sourceItems = sourceItems.slice(0, 5);
  }

  console.log(`📰 Coletados ${sourceItems.length} títulos.`);

  if (isTest) {
    console.log('🧪 Modo teste: análise IA pulada para evitar timeout.');
    return;
  }

  if (sourceItems.length === 0) return;

  const prompt = `
  Atue como Analista Defcon5.
  Analise os seguintes títulos de notícias.
  Aplique o filtro: "Isso afeta a soberania (saúde, finanças, mobilidade) de um operador em Ribeirão Preto?"
  Se SIM, classifique como signal e justifique em 1 linha.
  Se NÃO, classifique como noise.

  Para cada item, devolva JSON com id, titulo, classificacao, motivo, dominio, confidence, impacto_local, acao, janela_horas e specialist_briefs.
  Mantenha a mesma ordem dos IDs.

  Itens: ${JSON.stringify(
    sourceItems.map((item, index) => ({
      id: index + 1,
      titulo: item.title,
      source: item.source,
      link: item.link,
      published_at: item.published_at,
      summary: item.summary,
      domain_hint: detectDomain(item.title, item.summary),
      local_hint: localImpactHint(item.title, item.summary)
    })),
    null,
    2
  )}

  Responda APENAS em JSON com uma lista de itens.
  `;

  const payload = {
    model: 'deepseek-ai/deepseek-v4-pro',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  try {
    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`❌ Erro na API NVIDIA: ${resp.status} ${resp.statusText}`, errorText);
      return;
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || '[]';
    let parsedResults;
    try {
      parsedResults = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      parsedResults = match ? JSON.parse(match[0]) : [];
    }

    const analyses = normalizeAiResults(sourceItems, parsedResults);
    const signals = analyses.filter(item => item.verdict === 'signal');
    const noises = analyses.filter(item => item.verdict !== 'signal');
    const domainBreakdown = analyses.reduce((accumulator, item) => {
      if (item.verdict === 'signal') {
        accumulator[item.domain] = (accumulator[item.domain] || 0) + 1;
      }
      return accumulator;
    }, {});
    const alertLevel = buildAlertLevel(signals.length);
    const generatedAt = new Date();
    const localContext = {
      status: feedErrors > 0 ? 'partial' : 'success',
      source_errors: feedErrors,
      analyzed_with_ai: true,
      feed_count: feeds.length
    };
    const summary = {
      item_count: analyses.length,
      signal_count: signals.length,
      noise_count: noises.length,
      alert_level: alertLevel,
      domain_breakdown: domainBreakdown
    };

    const reportJsonPath = makeTimestampKey('crivo_relatorio_json');
    const reportHtmlPath = makeTimestampKey('crivo_relatorio_html');

    if (env.MONITOR_KV) {
      await env.MONITOR_KV.put(reportJsonPath, JSON.stringify({
        generated_at: generatedAt.toISOString(),
        feeds,
        local_context: localContext,
        summary,
        analyses
      }));
      await env.MONITOR_KV.put(reportHtmlPath, buildReportHtml(generatedAt, feeds, analyses, summary));
      console.log(`✅ Relatórios salvos no KV: ${reportJsonPath}, ${reportHtmlPath}`);
    }

    if (signals.length > 0) {
      console.log('🔴 Sinais detectados:', signals.map(s => s.title).join(', '));
    } else {
      console.log('⚫ Nenhum sinal crítico.');
    }

    try {
      const runData = {
        generated_at: generatedAt.toISOString(),
        source_count: feeds.length,
        item_count: analyses.length,
        signal_count: signals.length,
        noise_count: noises.length,
        alert_level: alertLevel,
        report_html_path: reportHtmlPath,
        report_json_path: reportJsonPath,
        local_context: localContext,
        domain_breakdown: domainBreakdown
      };

      const saveResult = await saveRun(env, runData, analyses);
      console.log(`✅ Crivo atualizado: run=${saveResult.run?.id}, itens=${saveResult.items_saved}`);
    } catch (saveError) {
      console.error('❌ Erro ao salvar no Supabase (Crivo):', saveError);
    }
  } catch (e) {
    console.error('❌ Erro na análise IA:', e);
  }
}
