# LEANR — Entity Relationship Diagram

Covers every table created in `supabase/migrations/0001`–`0009`. Views (0010) are omitted since they don't hold data of their own — see [api.md](./api.md) for what they expose.

```mermaid
erDiagram
    auth_users ||--|| profiles : "is"
    profiles ||--o| coach_profiles : "if role=coach"
    profiles ||--o| client_profiles : "if role=client"

    coach_profiles ||--o{ coach_availability : "has"
    coach_profiles ||--o{ coach_shifts : "has"
    coach_profiles ||--o{ coach_leave : "requests"

    client_profiles ||--o{ subscriptions : "purchases"
    package_tiers ||--o{ subscriptions : "sold as"

    client_profiles ||--o{ recurring_slots : "books"
    coach_profiles ||--o{ recurring_slots : "teaches"
    subscriptions ||--o{ recurring_slots : "funds"

    client_profiles ||--o{ temporary_bookings : "holds"
    coach_profiles ||--o{ temporary_bookings : "holds"

    coach_profiles ||--o{ assessment_sessions : "assigned"
    assessment_sessions ||--o| client_profiles : "converts to"

    client_profiles ||--o{ bookings : "attends"
    coach_profiles ||--o{ bookings : "runs"
    subscriptions ||--o{ bookings : "consumes"
    recurring_slots ||--o{ bookings : "generates"
    assessment_sessions ||--o| bookings : "becomes"

    bookings ||--o| attendance : "realized as"
    bookings ||--o| workout_notes : "logged as"
    client_profiles ||--o{ progress_logs : "tracks"

    client_profiles ||--o{ shadow_coach_assignments : "covered by"
    coach_profiles ||--o{ shadow_coach_assignments : "primary/shadow"

    client_profiles ||--o{ coach_change_requests : "requests"
    coach_profiles ||--o{ coach_change_requests : "current/new"

    profiles ||--o{ notifications : "receives"
    notification_templates ||--o{ notifications : "renders"

    profiles ||--o{ audit_logs : "acts as"

    profiles {
        uuid id PK "= auth.users.id"
        user_role role
        text full_name
        account_status account_status
    }
    coach_profiles {
        uuid id PK
        uuid profile_id FK
        text specialization
        numeric rating
        coach_status status
    }
    client_profiles {
        uuid id PK
        uuid profile_id FK
        text medical_notes
        client_status status
    }
    package_tiers {
        uuid id PK
        text name
        package_category category
        int sessions_count
        numeric price
    }
    subscriptions {
        uuid id PK
        uuid client_id FK
        uuid package_id FK
        int sessions_total
        subscription_status status
    }
    coach_availability {
        uuid id PK
        uuid coach_id FK
        smallint day_of_week
        time start_time
        time end_time
    }
    coach_shifts {
        uuid id PK
        uuid coach_id FK
        date shift_date
        shift_source source
    }
    coach_leave {
        uuid id PK
        uuid coach_id FK
        date starts_on
        date ends_on
        leave_status status
    }
    recurring_slots {
        uuid id PK
        uuid client_id FK
        uuid coach_id FK
        smallint day_of_week
        recurring_slot_status status
    }
    temporary_bookings {
        uuid id PK
        uuid client_id FK
        uuid coach_id FK
        timestamptz expires_at
        temporary_booking_status status
    }
    assessment_sessions {
        uuid id PK
        text prospect_name
        uuid assigned_coach_id FK
        uuid converted_client_id FK
        assessment_status status
    }
    bookings {
        uuid id PK
        uuid client_id FK
        uuid coach_id FK
        uuid subscription_id FK
        timestamptz scheduled_start
        booking_status status
        smallint rating
    }
    shadow_coach_assignments {
        uuid id PK
        uuid client_id FK
        uuid primary_coach_id FK
        uuid shadow_coach_id FK
        shadow_assignment_status status
    }
    coach_change_requests {
        uuid id PK
        uuid client_id FK
        uuid current_coach_id FK
        uuid new_coach_id FK
        coach_change_status status
    }
    attendance {
        uuid id PK
        uuid booking_id FK
        attendance_status status
    }
    workout_notes {
        uuid id PK
        uuid booking_id FK
        text notes
    }
    progress_logs {
        uuid id PK
        uuid client_id FK
        numeric weight
    }
    notification_templates {
        uuid id PK
        text key
        notification_type type
    }
    notifications {
        uuid id PK
        uuid user_id FK
        boolean read
    }
    audit_logs {
        uuid id PK
        uuid actor_id FK
        text action
        text entity_type
    }
    system_settings {
        text key PK
        jsonb value
    }
```
