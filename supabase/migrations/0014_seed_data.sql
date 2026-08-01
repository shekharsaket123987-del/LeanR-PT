-- LEANR Phase 1 — 0014: Dev seed data
-- DEV ONLY — do not run against production. Run once on a fresh dev database.
--
-- auth.users rows are managed by Supabase Auth and are deliberately NOT
-- created by SQL here (hand-crafting them is fragile, and this project keeps
-- auth untouched). Two manual steps first:

-- STEP 1 — if you created a user BEFORE migration 0002 ran, backfill their
-- profile (the auto-provision trigger only fires for users created after).
-- Defaults new backfilled profiles to role 'client' — edit if that account
-- should be a coach/admin.
insert into profiles (id, role, full_name)
select u.id, 'client', coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

insert into client_profiles (profile_id)
select p.id from profiles p
where p.role = 'client' and not exists (select 1 from client_profiles cp where cp.profile_id = p.id);

insert into coach_profiles (profile_id)
select p.id from profiles p
where p.role = 'coach' and not exists (select 1 from coach_profiles cp where cp.profile_id = p.id);

-- STEP 2 — create these accounts via Dashboard -> Authentication -> Add User
-- (toggle "Auto Confirm User"), pasting the JSON into "User Metadata" for
-- each. The 0002 trigger auto-provisions their profiles/coach_profiles/
-- client_profiles row on creation.
--
--   Coaches:
--     arjun.mehta@leanr.dev   {"role":"coach","full_name":"Arjun Mehta"}
--     priya.nair@leanr.dev    {"role":"coach","full_name":"Priya Nair"}
--   Clients:
--     saket.shekhar@leanr.dev {"role":"client","full_name":"Saket Shekhar"}
--     ananya.rao@leanr.dev    {"role":"client","full_name":"Ananya Rao"}
--
-- STEP 3 — after creating them, run everything below.

-- Package tiers (matches mock-data.ts's 4 tiers)
insert into package_tiers (name, category, sessions_count, price, original_price, features, highlighted, is_active) values
  ('LeanR Advance', 'advance', 24, 45999, 54999,
   array['24 live 1:1 sessions', 'Custom program', 'Progress tracking'], true, true),
  ('PT Add-on — 12 Sessions', 'addon', 12, 14999, null,
   array['12 live 1:1 sessions'], false, true),
  ('PT Add-on — 24 Sessions', 'addon', 24, 27999, 31999,
   array['24 live 1:1 sessions'], true, true),
  ('PT Add-on — 48 Sessions', 'addon', 48, 51999, 59999,
   array['48 live 1:1 sessions'], false, true);

-- Coach profile enrichment
update coach_profiles set
  specialization = 'Strength & Conditioning', secondary_specializations = array['Fat Loss', 'Powerlifting'],
  years_experience = 8, bio = 'Strength coach focused on sustainable progressive overload.',
  certifications = array['NASM-CPT', 'CSCS'], languages = array['English', 'Hindi'],
  rating = 4.9, review_count = 214, status = 'active'
where profile_id = (select id from profiles where full_name = 'Arjun Mehta');

update coach_profiles set
  specialization = 'Weight Loss & Nutrition', secondary_specializations = array['Mobility'],
  years_experience = 6, bio = 'Helps clients build habits that outlast the program.',
  certifications = array['ACE-CPT'], languages = array['English', 'Hindi', 'Tamil'],
  rating = 4.8, review_count = 168, status = 'active'
where profile_id = (select id from profiles where full_name = 'Priya Nair');

-- Client profile enrichment
update client_profiles set
  medical_notes = 'Mild lower back stiffness — avoid heavy spinal loading without warmup.',
  equipment = array['Dumbbells', 'Resistance bands', 'Pull-up bar'],
  goals = array['Fat loss', 'Build strength'], joined_date = current_date - 90, status = 'active'
where profile_id = (select id from profiles where full_name = 'Saket Shekhar');

update client_profiles set
  medical_notes = 'None reported.', equipment = array['None yet'],
  goals = array['General fitness'], joined_date = current_date - 10, status = 'active'
where profile_id = (select id from profiles where full_name = 'Ananya Rao');

-- Coach availability: Mon–Sat 06:00–20:00 for every seeded coach
insert into coach_availability (coach_id, day_of_week, start_time, end_time)
select cop.id, dow, '06:00', '20:00'
from coach_profiles cop
join profiles p on p.id = cop.profile_id
cross join generate_series(1, 6) as dow
where p.full_name in ('Arjun Mehta', 'Priya Nair');

-- Subscriptions
insert into subscriptions (client_id, package_id, sessions_total, status, started_at)
select cp.id, pt.id, pt.sessions_count, 'active', now() - interval '30 days'
from client_profiles cp
join profiles p on p.id = cp.profile_id and p.full_name = 'Saket Shekhar'
join package_tiers pt on pt.name = 'LeanR Advance';

insert into subscriptions (client_id, package_id, sessions_total, status, started_at)
select cp.id, pt.id, pt.sessions_count, 'active', now() - interval '5 days'
from client_profiles cp
join profiles p on p.id = cp.profile_id and p.full_name = 'Ananya Rao'
join package_tiers pt on pt.name = 'PT Add-on — 12 Sessions';

-- A recurring pattern for Saket (Mon/Wed/Fri 18:30 with Arjun)
insert into recurring_slots (client_id, coach_id, subscription_id, day_of_week, start_time, duration_minutes)
select cp.id, cop.id, sub.id, dow, '18:30', 45
from client_profiles cp
join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Saket Shekhar'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Arjun Mehta'
join subscriptions sub on sub.client_id = cp.id
cross join unnest(array[1, 3, 5]) as dow;

-- Bookings across statuses for Saket/Arjun
insert into bookings (client_id, coach_id, subscription_id, scheduled_start, duration_minutes, session_type, status)
select cp.id, cop.id, sub.id, (current_date + 2) + time '18:30', 45, 'regular', 'upcoming'
from client_profiles cp join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Saket Shekhar'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Arjun Mehta'
join subscriptions sub on sub.client_id = cp.id;

insert into bookings (client_id, coach_id, subscription_id, scheduled_start, duration_minutes, session_type, status, rating, client_feedback)
select cp.id, cop.id, sub.id, (current_date - 2) + time '18:30', 45, 'regular', 'completed', 5, 'Great session, felt strong on squats.'
from client_profiles cp join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Saket Shekhar'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Arjun Mehta'
join subscriptions sub on sub.client_id = cp.id;

insert into bookings (client_id, coach_id, subscription_id, scheduled_start, duration_minutes, session_type, status, cancel_reason)
select cp.id, cop.id, sub.id, (current_date - 5) + time '18:30', 45, 'regular', 'cancelled', 'Client requested reschedule'
from client_profiles cp join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Saket Shekhar'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Arjun Mehta'
join subscriptions sub on sub.client_id = cp.id;

insert into bookings (client_id, coach_id, subscription_id, scheduled_start, duration_minutes, session_type, status)
select cp.id, cop.id, sub.id, (current_date - 16) + time '18:30', 45, 'regular', 'missed'
from client_profiles cp join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Saket Shekhar'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Arjun Mehta'
join subscriptions sub on sub.client_id = cp.id;

-- Workout note + attendance on the completed booking
insert into workout_notes (booking_id, client_id, coach_id, notes, homework)
select b.id, b.client_id, b.coach_id,
  'Strong session — increased squat load to 60kg for 5x5. Mobility in ankles improving.',
  '10min daily calf stretch.'
from bookings b where b.status = 'completed';

insert into attendance (booking_id, status, checked_in_at, checked_out_at, marked_by)
select b.id, 'present', b.scheduled_start, b.scheduled_start + (b.duration_minutes || ' minutes')::interval,
  (select profile_id from coach_profiles where id = b.coach_id)
from bookings b where b.status = 'completed';

-- A pending coach-change request for Ananya
insert into coach_change_requests (client_id, current_coach_id, reason, status)
select cp.id, cop.id, 'Schedule mismatch — looking for an earlier morning slot.', 'pending'
from client_profiles cp join profiles pc on pc.id = cp.profile_id and pc.full_name = 'Ananya Rao'
join coach_profiles cop on true
join profiles pco on pco.id = cop.profile_id and pco.full_name = 'Priya Nair';

-- A couple of notifications for Saket
insert into notifications (user_id, template_key, type, title, message)
select p.id, 'booking_confirmed', 'booking', 'Session booked', 'Your session with Arjun Mehta is confirmed.'
from profiles p where p.full_name = 'Saket Shekhar';

insert into notifications (user_id, template_key, type, title, message, read)
select p.id, 'session_reminder', 'reminder', 'Session starting soon', 'Your session with Arjun Mehta starts soon.', true
from profiles p where p.full_name = 'Saket Shekhar';
