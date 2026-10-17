const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

// One transaction: two option groups, seven 0đ options, links to the same dishes as Thêm Topping (MG-001).
// Ids come from the current maximum inside the transaction. modifiers.group_name no longer exists (dropped in 0120).
export function buildSeedSql(apply: boolean, excludeProductNames: string[]): string {
  const exclude = excludeProductNames.length
    ? `\n  and p.name not in (${excludeProductNames.map(quote).join(", ")})`
    : "";
  return `begin;

do $$ begin
  perform pg_advisory_xact_lock(hashtext('modifier_groups:id'));
  perform pg_advisory_xact_lock(hashtext('modifiers:id'));
end $$;

create temp table seed_before on commit drop as
select (select count(*) from public.modifier_groups) as groups,
       (select count(*) from public.modifiers) as modifiers,
       (select count(*) from public.modifier_group_products where group_id = 'MG-001') as mg001_links,
       (select count(*) from public.modifier_group_products) as links;

insert into public.modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order, status)
select 'MG-' || lpad((m.n + v.ord)::text, 3, '0'), v.name, 'ONE', null, false, v.sort_order, 'ACTIVE'
from (values (1, 'Độ ngọt', 10), (2, 'Đá', 20)) as v(ord, name, sort_order),
     (select coalesce(max(substring(id from '^MG-([0-9]+)$')::integer), 0) as n from public.modifier_groups where id ~ '^MG-[0-9]+$') m;

insert into public.modifiers (id, name, price, status, product_id, group_id, is_default, max_qty)
select 'MOD-' || lpad((m.n + v.ord)::text, 3, '0'), v.name, 0, 'ACTIVE', null, g.id, v.is_default, null
from (values
  (1, 'Độ ngọt', 'Bình thường', true), (2, 'Độ ngọt', 'Ít ngọt', false), (3, 'Độ ngọt', 'Không đường', false),
  (4, 'Đá', 'Bình thường', true), (5, 'Đá', 'Ít đá', false), (6, 'Đá', 'Không đá', false), (7, 'Đá', 'Đá riêng', false)
) as v(ord, group_name, name, is_default)
join public.modifier_groups g on g.name = v.group_name,
     (select coalesce(max(substring(id from '^MOD-([0-9]+)$')::integer), 0) as n from public.modifiers where id ~ '^MOD-[0-9]+$') m;

insert into public.modifier_group_products (id, group_id, product_id)
select g.id || ':' || l.product_id, g.id, l.product_id
from public.modifier_groups g
join public.modifier_group_products l on l.group_id = 'MG-001'
join public.products p on p.id = l.product_id
where g.name in ('Độ ngọt', 'Đá')${exclude};

-- Guard: each new group must carry exactly the MG-001 dishes minus the excluded ones.
do $$ begin
  if exists (
    select 1 from public.modifier_groups g
    where g.name in ('Độ ngọt', 'Đá')
      and (select count(*) from public.modifier_group_products where group_id = g.id) <> (
        select count(*) from public.modifier_group_products l
        join public.products p on p.id = l.product_id
        where l.group_id = 'MG-001'${exclude})
  ) then
    raise exception 'new group dish count differs from MG-001 minus exclusions';
  end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'before', (select to_jsonb(b) from seed_before b),
  'after', jsonb_build_object(
    'groups', (select count(*) from public.modifier_groups),
    'modifiers', (select count(*) from public.modifiers),
    'mg001_links', (select count(*) from public.modifier_group_products where group_id = 'MG-001'),
    'links', (select count(*) from public.modifier_group_products)),
  'new_group_links', (select jsonb_object_agg(g.name, (select count(*) from public.modifier_group_products where group_id = g.id)) from public.modifier_groups g where g.name in ('Độ ngọt', 'Đá')),
  'new_groups', (select jsonb_agg(jsonb_build_array(id, name) order by id) from public.modifier_groups where name in ('Độ ngọt', 'Đá')),
  'new_options', (select jsonb_agg(jsonb_build_array(m.id, g.name, m.name) order by m.id) from public.modifiers m join public.modifier_groups g on g.id = m.group_id where g.name in ('Độ ngọt', 'Đá')),
  'linked_products', (select jsonb_object_agg(name, names) from (
    select g.name, jsonb_agg(p.name order by p.name) as names
    from public.modifier_groups g
    join public.modifier_group_products l on l.group_id = g.id
    join public.products p on p.id = l.product_id
    where g.name in ('Độ ngọt', 'Đá') group by g.name) x)
)) as result;

${apply ? "commit;" : "rollback;"}
`;
}
