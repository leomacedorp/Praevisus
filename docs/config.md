# Configuração do Praevisus

## Variáveis de ambiente

- `NVIDIA_API_KEY`
  - Obrigatória.
  - Usada para autenticar chamadas à API da NVIDIA.

## Bindings

- `MONITOR_KV`
  - Binding para o namespace KV.
  - Usado para persistir relatórios gerados pelo monitor.

## Agendamento

- Cron atual: `*/15 * * * *`
- Função do cron: executar a análise completa em intervalos regulares.

## Modelos

Modelos previstos para uso com a API:

- `deepseek-ai/deepseek-v4-pro`
- `nemotron-550b`

## Feeds

Os feeds RSS são definidos no Worker. Para adicionar novos:

- inclua a URL do feed na lista de fontes;
- confirme que o XML expõe `<title>`;
- teste a nova fonte antes de depender dela em produção.

## Observações

- Execução manual deve permanecer leve.
- Análise completa deve ficar com o agendamento.
- Mudanças de configuração devem ser acompanhadas por novo deploy.

