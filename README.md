# Praevisus — Sistema de Monitoramento Defcon5

Praevisus é um Worker na Cloudflare que coleta títulos de notícias, aplica um filtro de relevância operacional e usa IA para classificar o que merece atenção. O objetivo é reduzir ruído e destacar sinais que possam afetar saúde, finanças, mobilidade e continuidade operacional.

## Visão geral

- Coleta feeds RSS de fontes públicas.
- Normaliza e deduplica títulos.
- Envia o conjunto para análise por IA.
- Persiste relatórios no KV da Cloudflare.
- Executa em dois modos:
  - `scheduled()` para a análise completa.
  - `/test` para validação rápida do fluxo.

## Arquitetura

- **Cloudflare Worker**: executa a lógica principal.
- **Cron**: dispara o monitor em intervalo fixo.
- **KV Storage**: guarda relatórios gerados.
- **NVIDIA API**: faz a análise dos títulos com o modelo configurado.

Consulte a documentação técnica em `docs/architecture.md`.

## Configuração

### Variáveis e bindings

- `NVIDIA_API_KEY`: segredo obrigatório para chamar a API da NVIDIA.
- `MONITOR_KV`: binding do namespace KV usado para armazenar relatórios.

### Configuração do Worker

- O Worker principal aponta para `src/index.js`.
- O agendamento cron atual roda a cada 15 minutos.
- Os feeds RSS ficam definidos no código e podem ser ampliados conforme a necessidade.

Mais detalhes em `docs/config.md`.

## Como executar

### Deploy

```bash
npx wrangler deploy
```

### Teste manual

Abra o endpoint `/test` no Worker publicado. Ele executa uma rodada leve e responde rápido.

### Ver logs

```bash
npx wrangler tail --format pretty
```

## Operação

Use `docs/operations.md` como manual de rotina para logs, cron, KV e atualização de feeds.

## Roadmap

Os próximos passos estão em `docs/roadmap.md`.

## Próximas integrações

- Crivo/Supabase para persistência consultável.
- WhatsApp para alertas.
- Especialistas temáticos para classificação por domínio.
- Painel público para consulta dos relatórios.
- Assinatura de relatórios como monetização.

