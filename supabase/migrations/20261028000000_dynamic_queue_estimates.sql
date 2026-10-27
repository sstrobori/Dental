-- Dynamic queue estimates
--
-- The existing service_minutes(uuid) function remains the baseline source. It
-- uses the clinic's configured default until enough completed visits exist,
-- then switches to the clinic's historical Call -> Served average.
--
-- Queue service is estimated sequentially. Although clinics.chairs exists,
-- queue entries are not assigned to a chair or provider, so multiple `called`
-- rows are not treated as parallel work.

create or replace function public.queue_current_service(
  p_clinic_id uuid
)
returns table (
  remaining_minutes integer,
  delayed boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_baseline integer := greatest(
    1,
    coalesce(public.service_minutes(p_clinic_id), 20)
  );
  v_started_at timestamptz;
  v_elapsed_minutes numeric;
  v_history_count integer := 0;
  v_history_p75 numeric;
  v_remaining_minutes numeric;
begin
  -- The earliest arrived/called row is the single active workload. Additional
  -- called rows remain full visits in the sequential queue estimate.
  select q.service_started_at
  into v_started_at
  from public.queue_entries q
  where q.clinic_id = p_clinic_id
    and q.status = 'called'
    and q.service_started_at is not null
    and q.created_at >= (
      date_trunc('day', now() at time zone 'Asia/Manila')
      at time zone 'Asia/Manila'
    )
  order by q.service_started_at, q.queued_at, q.id
  limit 1;

  if v_started_at is null then
    return query select null::integer, false;
    return;
  end if;

  v_elapsed_minutes := greatest(
    0,
    extract(epoch from (now() - v_started_at)) / 60.0
  );

  -- Prefer the clinic's recent Started -> Served 75th percentile once at
  -- least five trustworthy samples exist. service_started_at currently means
  -- staff confirmed arrival at the counter, not the exact treatment start.
  select
    count(*)::integer,
    percentile_cont(0.75) within group (order by sample.duration_minutes)
  into v_history_count, v_history_p75
  from (
    select
      extract(
        epoch from (
          coalesce(q.served_at, q.finished_at) - q.service_started_at
        )
      ) / 60.0 as duration_minutes
    from public.queue_entries q
    where q.clinic_id = p_clinic_id
      and q.service_started_at is not null
      and coalesce(q.served_at, q.finished_at) > q.service_started_at
    order by coalesce(q.served_at, q.finished_at) desc
    limit 50
  ) sample
  where sample.duration_minutes between 2 and 480;

  if v_elapsed_minutes < v_baseline then
    v_remaining_minutes := ceil(v_baseline - v_elapsed_minutes);
  else
    -- Never collapse an overdue in-progress visit to zero. With insufficient
    -- Started -> Served history, reserve half of the baseline as a conservative
    -- fallback. A reliable p75 may increase that remaining workload.
    v_remaining_minutes := ceil(v_baseline * 0.5);

    if v_history_count >= 5 and v_history_p75 is not null then
      v_remaining_minutes := greatest(
        v_remaining_minutes,
        ceil(v_history_p75 - v_elapsed_minutes)
      );
    end if;
  end if;

  return query
  select
    greatest(1, v_remaining_minutes::integer),
    v_elapsed_minutes > v_baseline;
end;
$$;

-- This additive RPC leaves the deployed queue_status() and my_active_visits()
-- definitions, return types, grants, and RLS behavior untouched. Both portals
-- merge these backend-calculated fields into their existing status rows.
create or replace function public.queue_estimate_metadata(
  p_entry_ids uuid[]
)
returns table (
  entry_id uuid,
  people_ahead integer,
  est_minutes integer,
  current_visit_delayed boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with targets as (
    select
      q.id,
      q.clinic_id,
      q.status,
      q.queued_at,
      q.queue_number
    from public.queue_entries q
    where q.id = any(coalesce(p_entry_ids, array[]::uuid[]))
      and q.status in ('waiting', 'called')
  )
  select
    target.id as entry_id,
    workload.people_ahead,
    case
      when target.status <> 'waiting' or workload.people_ahead = 0 then 0
      when current_service.remaining_minutes is null
        then workload.people_ahead * baseline.minutes
      else current_service.remaining_minutes
        + greatest(workload.people_ahead - 1, 0) * baseline.minutes
    end as est_minutes,
    case
      when target.status = 'waiting'
        then coalesce(current_service.delayed, false)
      else false
    end as current_visit_delayed
  from targets target
  cross join lateral (
    select greatest(
      1,
      coalesce(public.service_minutes(target.clinic_id), 20)
    )::integer as minutes
  ) baseline
  cross join lateral (
    select count(*)::integer as people_ahead
    from public.queue_entries ahead
    where target.status = 'waiting'
      and ahead.clinic_id = target.clinic_id
      and ahead.status in ('waiting', 'called')
      and ahead.created_at >= (
        date_trunc('day', now() at time zone 'Asia/Manila')
        at time zone 'Asia/Manila'
      )
      and (
        ahead.status = 'called'
        or (
          ahead.status = 'waiting'
          and (ahead.queued_at, ahead.queue_number, ahead.id)
            < (target.queued_at, target.queue_number, target.id)
        )
      )
  ) workload
  left join lateral public.queue_current_service(target.clinic_id) current_service
    on true
  order by array_position(p_entry_ids, target.id);
$$;

-- The internal helper is callable only by its owner/security-definer wrappers.
revoke all on function public.queue_current_service(uuid)
from public, anon, authenticated;

revoke all on function public.queue_estimate_metadata(uuid[])
from public;

grant execute on function public.queue_estimate_metadata(uuid[])
to anon, authenticated, service_role;

comment on function public.queue_estimate_metadata(uuid[]) is
  'Returns dynamic sequential estimates and non-private display metadata for active queue tickets.';
