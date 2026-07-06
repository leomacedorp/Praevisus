// src/index.js
// Hermes/Praevisus — usando NVIDIA NIM (DeepSeek-V4-Pro)

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, false));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isTest = url.pathname === '/test' || url.searchParams.get('run') === '1' || url.searchParams.get('test') === '1';

    if (isTest) {
      ctx.waitUntil(runMonitor(env, true));
      return new Response('✅ Monitor executado em background! Verifique os logs.', { status: 200 });
    }

    return new Response('📡 Praevisus ativo. Use /test ou ?run=1 para executar uma rodada manual.', { status: 200 });
  }
};

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

  let allTitles = [];
  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl);
      const text = await resp.text();
      const titles = text.match(/<title>(.*?)<\/title>/g) || [];
      titles.forEach(t => {
        const clean = t.replace(/<title>|<\/title>/g, '').trim();
        if (clean && clean.length > 10) allTitles.push(clean);
      });
    } catch (e) {
      console.error(`Erro ao buscar feed: ${feedUrl}`, e);
    }
  }

  allTitles = [...new Set(allTitles)];

  if (isTest) {
    allTitles = allTitles.slice(0, 5);
  }

  console.log(`📰 Coletados ${allTitles.length} títulos.`);

  if (isTest) {
    console.log('🧪 Modo teste: análise IA pulada para evitar timeout.');
    return;
  }

  if (allTitles.length === 0) return;

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
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const results = JSON.parse(match[0]);
      if (env.MONITOR_KV) {
        const key = `relatorio_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        await env.MONITOR_KV.put(key, JSON.stringify({ timestamp: new Date().toISOString(), results }));
        console.log(`✅ Relatório salvo no KV: ${key}`);
      }
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
