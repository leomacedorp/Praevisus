async function testSupabaseCredentials(env) {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 'missing_env',
      message: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.'
    };
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/monitor_runs?select=id&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json'
    }
  });

  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body
  };
}

export { testSupabaseCredentials };

