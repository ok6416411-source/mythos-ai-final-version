CREATE TABLE public.mythos_tasks (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mythos_tasks TO authenticated;
GRANT ALL ON public.mythos_tasks TO service_role;
ALTER TABLE public.mythos_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tasks" ON public.mythos_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.mythos_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid,
  source text NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  measured boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mythos_token_usage_user_time ON public.mythos_token_usage (user_id, created_at DESC);
GRANT SELECT ON public.mythos_token_usage TO authenticated;
GRANT ALL ON public.mythos_token_usage TO service_role;
ALTER TABLE public.mythos_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own token usage" ON public.mythos_token_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mythos_token_summary(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'hour', COALESCE(SUM(total_tokens) FILTER (WHERE created_at > now() - interval '1 hour'), 0),
    'week', COALESCE(SUM(total_tokens) FILTER (WHERE created_at > now() - interval '7 days'), 0),
    'month', COALESCE(SUM(total_tokens) FILTER (WHERE created_at > now() - interval '30 days'), 0),
    'unmeasured', COUNT(*) FILTER (WHERE NOT measured AND created_at > now() - interval '30 days')
  ) FROM public.mythos_token_usage WHERE user_id = _user_id
$$;
REVOKE ALL ON FUNCTION public.mythos_token_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mythos_token_summary(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mythos_admit_task(_user_id uuid, _task_id uuid, _source text, _tier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; lim_h bigint; lim_w bigint; lim_m bigint; owner uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  SELECT user_id INTO owner FROM mythos_tasks WHERE id = _task_id;
  IF owner IS NOT NULL THEN
    IF owner <> _user_id THEN RETURN jsonb_build_object('allowed', false, 'reason', 'task_owner'); END IF;
    UPDATE mythos_tasks SET last_seen_at = now() WHERE id = _task_id;
    RETURN jsonb_build_object('allowed', true, 'continued', true, 'usage', mythos_token_summary(_user_id));
  END IF;
  s := mythos_token_summary(_user_id);
  SELECT NULLIF(value, '')::bigint INTO lim_h FROM app_settings WHERE key = 'token_limit_' || _tier || '_hour';
  SELECT NULLIF(value, '')::bigint INTO lim_w FROM app_settings WHERE key = 'token_limit_' || _tier || '_week';
  SELECT NULLIF(value, '')::bigint INTO lim_m FROM app_settings WHERE key = 'token_limit_' || _tier || '_month';
  IF (lim_h IS NOT NULL AND (s->>'hour')::bigint >= lim_h) OR (lim_w IS NOT NULL AND (s->>'week')::bigint >= lim_w)
     OR (lim_m IS NOT NULL AND (s->>'month')::bigint >= lim_m) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'token_limit', 'usage', s, 'limits', jsonb_build_object('hour', lim_h, 'week', lim_w, 'month', lim_m));
  END IF;
  INSERT INTO mythos_tasks(id, user_id, source) VALUES (_task_id, _user_id, left(_source, 20));
  RETURN jsonb_build_object('allowed', true, 'continued', false, 'usage', s, 'limits', jsonb_build_object('hour', lim_h, 'week', lim_w, 'month', lim_m));
END $$;
REVOKE ALL ON FUNCTION public.mythos_admit_task(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mythos_admit_task(uuid, uuid, text, text) TO service_role;