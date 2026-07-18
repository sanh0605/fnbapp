-- Gate 3 Phase B: remove unused client-role table access, drop an orphaned
-- SECURITY DEFINER function, and track the live RLS event trigger.

revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.base_ingredients from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.brands from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.item_categories from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.modifiers from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.order_events from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.order_lines_v2 from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.orders_v2 from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.pos_drafts from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.product_categories from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.product_price_history from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.product_variants from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.production_items from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.production_orders from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.products from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.promotions from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.purchase_order_lines from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.purchase_orders from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.purchase_sources from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.purchased_items from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.recipes from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.semi_products from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.stock_adjustments from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.stock_ledger from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.suppliers from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.sync_state from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.units from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.uom_conversions from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.users from anon, authenticated;

drop function if exists public.next_order_num(uuid);

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

drop event trigger if exists ensure_rls;

create event trigger ensure_rls
 on ddl_command_end
 when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
 execute function public.rls_auto_enable();
