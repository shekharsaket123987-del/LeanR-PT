-- LEANR — 0035: Sales list view
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §2.6: a transaction-level sales list
-- (client, plan, sale date, amount) -- /admin/reports has CSV exports but
-- nothing at this granularity. Joins subscriptions to package_tiers for the
-- amount, same convention already established by revenue_trend_view
-- (migration 0010) -- subscriptions has no amount_paid of its own, so this
-- reads the package's current price, same simplification the existing
-- revenue view already makes. security_invoker=true so RLS applies as the
-- calling user, matching every other view in 0010.

create view sales_view with (security_invoker = true) as
select
  s.id as subscription_id,
  s.client_id,
  cpf.client_code,
  p.full_name as client_name,
  pt.name as package_name,
  pt.price as amount,
  s.started_at as sale_date
from subscriptions s
join package_tiers pt on pt.id = s.package_id
join client_profiles cpf on cpf.id = s.client_id
join profiles p on p.id = cpf.profile_id
order by s.started_at desc;
