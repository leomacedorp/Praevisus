# Supabase / Crivo

O Praevisus usa o Supabase como camada persistente do Crivo. O Cloudflare Worker grava cada execução em `monitor_runs` e cada item analisado em `monitor_items`.

## O que precisa existir no Supabase

- Projeto ativo: `uspogrvvrlrweciyfhgd`
- URL: `https://uspogrvvrlrweciyfhgd.supabase.co`
- Tabelas: `public.monitor_runs` e `public.monitor_items`
- Secret no Cloudflare Worker: `SUPABASE_SERVICE_ROLE_KEY`

> A `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é útil para frontend Next.js, mas não deve ser usada para ingestão backend. O Worker precisa da `service_role` porque grava dados automaticamente no banco.

## Aplicar schema

1. Abra o dashboard do Supabase.
2. Entre no projeto `uspogrvvrlrweciyfhgd`.
3. Vá em **SQL Editor**.
4. Cole e execute o conteúdo de `supabase/schema.sql`.

## Configurar secrets no Worker

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Valores esperados:

```text
SUPABASE_URL=https://uspogrvvrlrweciyfhgd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role do projeto>
```

## Validar conexão

Depois de aplicar o schema e configurar as secrets:

```bash
curl https://praevisus.infohausti.workers.dev/test-supabase
```

Resposta esperada:

```json
{"ok":true}
```

## Executar rodada manual

```bash
curl https://praevisus.infohausti.workers.dev/?run=1
npx wrangler tail --format pretty
```

Nos logs, procure por:

```text
✅ Crivo atualizado no Supabase:
```

