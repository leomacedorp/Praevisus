# Operação do Praevisus

## Logs

Use o comando abaixo para acompanhar o Worker em tempo real:

```bash
npx wrangler tail --format pretty
```

## Relatórios

Os relatórios são gravados no KV configurado para o Worker. Cada execução salva um registro com timestamp e resultados da análise.

## Cron

O monitor completo roda a cada 15 minutos. Se o cron não disparar, verifique a configuração de triggers no ambiente de publicação.

## Atualização de feeds

Para adicionar ou trocar fontes:

- altere a lista de feeds no Worker;
- mantenha fontes estáveis e com RSS válido;
- valide a nova fonte antes de colocá-la em produção.

## Reimplante

Depois de alterar o código, use:

```bash
npx wrangler deploy
```

## Teste manual

O endpoint `/test` deve ser usado apenas para smoke test. Ele confirma que o Worker responde e que o fluxo básico está ativo.

