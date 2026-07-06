# Arquitetura do Praevisus

## Objetivo

Praevisus transforma notícias em sinais operacionais. A prioridade é identificar itens que possam exigir ação rápida, mantendo o fluxo simples o bastante para rodar em ambiente de edge.

## Fluxo de dados

1. Coleta de títulos em feeds RSS.
2. Limpeza e deduplicação.
3. Separação entre execução de teste e execução completa.
4. Envio do lote completo para análise IA.
5. Armazenamento do resultado no KV.
6. Exposição de logs e relatórios para verificação posterior.

Fluxo textual:

`[coleta] → [deduplicação] → [classificação IA] → [KV] → [relatórios]`

## Componentes

### Cloudflare Worker

É o ponto de entrada do sistema. Recebe chamadas HTTP e também execuções agendadas.

### Cron

Dispara a rotina completa em intervalo fixo. É o modo correto para análise extensa.

### KV

Serve como armazenamento leve para relatórios gerados pelo monitor.

### NVIDIA API

Executa a classificação dos títulos. O modelo configurado fornece a análise sem exigir infraestrutura própria de inferência.

## Decisões técnicas

- **NVIDIA NIM** foi escolhido porque entrega inferência externa com integração simples via HTTP.
- **KV** foi escolhido porque o uso é de leitura/gravação simples e a latência precisa ser baixa.
- **Cron separado de teste** evita que a validação manual dependa do tempo total da análise.
- **Modo teste leve** existe para smoke tests e checagem operacional rápida.

## Observações de operação

- A execução completa deve ficar no cron.
- O endpoint manual deve permanecer curto e previsível.
- O sistema deve priorizar sinal útil, não volume de processamento.

