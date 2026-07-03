// src/index.js
// Hermes — Sistema de Monitoramento Defcon5 (Cloudflare Worker)

export default {
  // Executa a cada 15 minutos via cron trigger
  async scheduled(event, env, ctx) {
    await runMonitor(env);
  },

  // Endpoint para teste manual: /test
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/test') {
      await runMonitor(env);
      return new Response('✅ Monitor executado! Verifique os logs.', { status: 200 });
    }
    return new Response('📡 Hermes ativo. Use /test para executar uma rodada manual.', { status: 200 });
  }
};

async function runMonitor(env) {
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('❌ Chave Gemini não configurada. Adicione GEMINI_API_KEY nas variáveis de ambiente.');
    return;
  }

  console.log('🛰️ Hermes iniciando coleta...');

  // 1. Coletar feeds RSS (exemplo: G1 e Folha)
  const feeds = [
    'https://g1.globo.com/rss/g1/',
    'https://feeds.folha.uol.com.br/folha/mercado/rss091.xml'
  ];

  let allTitles = [];
  for (const url of feeds) {
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const titles = text.match(/<title>(.*?)<\/title>/g) || [];
      titles.forEach(t => {
        const clean = t.replace(/<title>|<\/title>/g, '').trim();
        if (clean && clean.length > 10) allTitles.push(clean);
      });
    } catch (e) {
      console.error(`Erro ao buscar feed: ${url}`, e);
    }
  }

  allTitles = [...new Set(allTitles)];
  console.log(`📰 Coletados ${allTitles.length} títulos.`);

  if (allTitles.length === 0) return;

  // 2. Analisar com IA (Gemini)
  const prompt = `
  Atue como Analista Defcon5.
  Analise os seguintes títulos de notícias.
  Aplique o filtro: "Isso afeta a soberania (saúde, finanças, mobilidade) de um operador em Ribeirão Preto?"
  Se SIM, classifique como [SINAL] e justifique em 1 linha.
  Se NÃO, classifique como [RUÍDO].

  Títulos: ${JSON.stringify(allTitles)}

  Responda APENAS em JSON com a estrutura: [{"titulo": "x", "classificacao": "SINAL/RUÍDO", "motivo": "x"}]
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const results = JSON.parse(match[0]);
      // Salvar no KV se existir
      if (env.MONITOR_KV) {
        const key = `relatorio_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        await env.MONITOR_KV.put(key, JSON.stringify({ timestamp: new Date().toISOString(), results }));
        console.log(`✅ Relatório salvo no KV: ${key}`);
      }
      // Log dos sinais
      const sinais = results.filter(r => r.classificacao === 'SINAL');
      if (sinais.length > 0) {
        console.log('🔴 Sinais detectados:', sinais.map(s => s.titulo).join(', '));
      } else {
        console.log('⚫ Nenhum sinal crítico.');
      }
    }
  } catch (e) {
    console.error('❌ Erro na análise IA:', e);
  }
}