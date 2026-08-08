-- LEANR — 0036: Pause-days "promise" overrides
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §2.5/§3.11: a per-client override on
-- top of the plan template ("client has 15 pause-days remaining, admin
-- grants 15 more -> 30 total"). Scoped to pause-days only, per the spec's
-- own explicit note that this is the only promise type requested right now.
--
-- pause_days_used is deliberately NOT a stored column -- it's derived from
-- the existing pause_started/pause_ended client_timeline_events (already
-- logged by subscriptions.service.ts::pauseSubscription/resumeSubscription),
-- so there's no second counter that can drift out of sync with the actual
-- pause history.

alter table package_tiers add column default_pause_days int not null default 0;
alter table subscriptions add column pause_days_allowed int not null default 0;
