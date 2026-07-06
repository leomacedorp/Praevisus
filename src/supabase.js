function createSupabaseRequest(env, path, options = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL não configurada.');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }

  return fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
}

async function insertRows(env, tableName, rows) {
  const response = await createSupabaseRequest(env, tableName, {
    method: 'POST',
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed for ${tableName}: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function saveRun(env, runData, items = []) {
  const runPayload = {
    generated_at: runData.generated_at,
    source_count: runData.source_count,
    item_count: runData.item_count,
    signal_count: runData.signal_count,
    noise_count: runData.noise_count,
    alert_level: runData.alert_level,
    report_html_path: runData.report_html_path ?? null,
    report_json_path: runData.report_json_path ?? null,
    local_context: runData.local_context ?? {},
    domain_breakdown: runData.domain_breakdown ?? {}
  };

  const insertedRuns = await insertRows(env, 'monitor_runs', [runPayload]);
  const runRow = Array.isArray(insertedRuns) ? insertedRuns[0] : insertedRuns;
  const runId = runRow?.id;

  if (!runId) {
    throw new Error('Supabase não retornou o id da execução monitor_runs.');
  }

  const itemRows = items.map(item => ({
    run_id: runId,
    source: item.source ?? '',
    title: item.title ?? '',
    link: item.link ?? '',
    published_at: item.published_at ?? null,
    domain: item.domain ?? 'outros',
    verdict: item.verdict ?? 'noise',
    confidence: item.confidence ?? 0,
    cui_bono: item.cui_bono ?? '',
    local_impact: item.local_impact ?? '',
    action: item.action ?? '',
    horizon_hours: item.horizon_hours ?? null,
    specialist_briefs: item.specialist_briefs ?? [],
    raw: item.raw ?? {}
  }));

  if (itemRows.length > 0) {
    await insertRows(env, 'monitor_items', itemRows);
  }

  return {
    run: runRow,
    items_saved: itemRows.length
  };
}
