-- 2026-10-14 audit A4 (docs/superpowers/plans/2026-10-14-khung-khau-hao.md).
-- The depreciation bands used to be changed one at a time, each step checked
-- against the whole price line, so adding, removing or moving a band was
-- always refused. This function replaces the whole table in one transaction.
--
-- p_bands is an array of {id: text|null, min_unit_price: bigint, term_months: int}.
-- The first min must be 0 and the mins must strictly increase (after sorting);
-- max_unit_price is not input, it is the next band's min (null on the last), so
-- the price line can never have a gap or an overlap. Rows with an id are
-- updated, rows missing from the array are deleted (no table references this
-- one: assets.term_months is a frozen copy, BR-COGS-008), rows without an id
-- are inserted with the next KH-NNN id. Returns the ids in min order.
--
-- Triggers on the touched table (derived from migration text, not read from
-- the live catalog -- supabase/CLAUDE.md; method as in 0100: grepped every
-- `create trigger` / `drop trigger` in supabase/migrations, 2026-10-14):
-- 0069_batch3_asset_register.sql creates exactly one,
-- trg_asset_depreciation_bands_touch, BEFORE UPDATE FOR EACH ROW,
-- public.touch_updated_at() (sets updated_at = now()). No queue, audit or
-- cascade.
--
-- New function name, no return type of an existing function changes, so it may
-- run before or after the code that calls it; the code needs it to exist.

create or replace function public.replace_asset_depreciation_bands(p_bands jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_min bigint := null;
  v_row record;
  v_next_number integer;
  v_ids jsonb := '[]'::jsonb;
  v_new_id text;
begin
  if p_bands is null or jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) = 0 then
    raise exception 'Phải có ít nhất một khung khấu hao';
  end if;

  lock table public.asset_depreciation_bands in share row exclusive mode;

  create temporary table tmp_bands on commit drop as
  select
    nullif(btrim(e->>'id'), '') as id,
    (e->>'min_unit_price')::bigint as min_unit_price,
    (e->>'term_months')::integer as term_months,
    lead((e->>'min_unit_price')::bigint) over (order by (e->>'min_unit_price')::bigint) as max_unit_price
  from jsonb_array_elements(p_bands) as e;


  for v_row in select * from tmp_bands order by min_unit_price loop
    if v_row.min_unit_price is null or v_row.term_months is null or v_row.term_months < 1 then
      raise exception 'Số tháng khấu hao phải là số nguyên từ 1 trở lên';
    end if;
    if v_prev_min is null then
      if v_row.min_unit_price <> 0 then
        raise exception 'Khung đầu tiên phải bắt đầu từ 0đ';
      end if;
    elsif v_row.min_unit_price <= v_prev_min then
      raise exception 'Giá bắt đầu của mỗi khung phải lớn hơn khung trước (% không lớn hơn %)', v_row.min_unit_price, v_prev_min;
    end if;
    v_prev_min := v_row.min_unit_price;
  end loop;

  if exists (select 1 from tmp_bands where id is not null group by id having count(*) > 1) then
    raise exception 'Một khung xuất hiện hai lần';
  end if;
  if exists (
    select 1 from tmp_bands t
    where t.id is not null
      and not exists (select 1 from public.asset_depreciation_bands b where b.id = t.id)
  ) then
    raise exception 'Không tìm thấy khung khấu hao đang sửa';
  end if;

  delete from public.asset_depreciation_bands
  where id not in (select id from tmp_bands where id is not null);

  update public.asset_depreciation_bands b
  set min_unit_price = t.min_unit_price,
      max_unit_price = t.max_unit_price,
      term_months = t.term_months
  from tmp_bands t
  where b.id = t.id;

  perform pg_advisory_xact_lock(hashtext('asset_depreciation_bands:id'));
  select coalesce(max((substring(id from '^KH-([0-9]+)$'))::integer), 0)
  into v_next_number
  from public.asset_depreciation_bands;

  for v_row in select * from tmp_bands where id is null order by min_unit_price loop
    v_next_number := v_next_number + 1;
    v_new_id := 'KH-' || lpad(v_next_number::text, 3, '0');
    insert into public.asset_depreciation_bands (id, min_unit_price, max_unit_price, term_months)
    values (v_new_id, v_row.min_unit_price, v_row.max_unit_price, v_row.term_months);
  end loop;

  select coalesce(jsonb_agg(id order by min_unit_price), '[]'::jsonb)
  into v_ids
  from public.asset_depreciation_bands;

  return v_ids;
end;
$$;

revoke all on function public.replace_asset_depreciation_bands(jsonb) from public, anon, authenticated;
grant execute on function public.replace_asset_depreciation_bands(jsonb) to service_role;
