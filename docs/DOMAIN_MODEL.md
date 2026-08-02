
# LEANR by Fitelo

# Domain Model

**Version:** 1.0

**Purpose**

This document defines the business entities that exist within LeanR.

Every database table, API endpoint, UI component, workflow, and business rule should use the terminology defined in this document.

This document is the single source of truth for LeanR's domain language.

---

# 1. Domain Philosophy

LeanR is not a booking application.

LeanR is a Personal Training Operating System.

Every entity in the platform exists to support three goals:

* Deliver consistent coaching.
* Optimize operations.
* Maintain coach continuity.

---

# 2. Core Business Domains

LeanR consists of the following domains:

```
Authentication

↓

User Management

↓

Client Management

↓

Coach Management

↓

Scheduling

↓

Sessions

↓

Subscriptions

↓

Operations

↓

Analytics

↓

Notifications

↓

Administration
```

---

# 3. User

A User is any authenticated person inside LeanR.

A user is always exactly one role.

Roles:

* Client
* Coach
* Admin

A user owns:

* Profile
* Notifications
* Audit history

---

# 4. Client

A Client is a customer receiving PT services.

A Client has:

* One profile
* One active subscription
* One primary coach
* One recurring schedule
* Many sessions
* Many progress logs
* Many notifications

A Client never directly owns coaches.

Coach assignment is managed by the platform.

---

# 5. Coach

A Coach is a certified trainer providing PT sessions.

A Coach owns:

* Availability
* Working hours
* Leave requests
* Assigned clients
* Workout notes
* Session history

A Coach never owns subscriptions.

---

# 6. Admin

Admins operate the platform.

Admins manage:

* Clients
* Coaches
* Sessions
* Packages
* Business rules
* Operations
* Reports

Admins do not participate in coaching.

---

# 7. Subscription

A Subscription represents a purchased PT package.

A subscription contains:

* Package
* Remaining sessions
* Status
* Start date
* End date

A subscription funds recurring sessions.

---

# 8. Package

A Package defines what can be purchased.

Examples:

* LeanR Advance
* PT Add-on 12
* PT Add-on 24
* PT Add-on 48

A package is reusable.

Subscriptions are instances of packages.

---

# 9. Assessment Session

Assessment Session is the first coaching interaction.

Properties:

* Free
* Longer duration
* Does not consume package sessions
* Generates coaching baseline

Every client should have at most one assessment per onboarding.

---

# 10. Booking

A Booking represents one scheduled PT session.

Booking lifecycle:

```
Created

↓

Upcoming

↓

Completed

↓

Cancelled

↓

Missed
```

A booking belongs to:

* One client
* One coach
* One subscription

---

# 11. Recurring Slot

Recurring Slot is one of LeanR's most important entities.

It is **not** a booking.

It represents a long-term reservation.

Example:

Monday

Wednesday

Friday

6:00 AM

Recurring Slots automatically generate bookings.

Recurring Slots define coach continuity.

---

# 12. Temporary Booking

Temporary Booking is a short-lived reservation.

Purpose:

Prevent double booking during confirmation.

Temporary bookings automatically expire.

They are never permanent.

---

# 13. Shadow Coach Assignment

A Shadow Assignment temporarily replaces the primary coach.

Properties:

* Temporary
* Date-bound
* Primary coach preserved
* Session-specific

Shadow Assignments never permanently transfer ownership.

---

# 14. Coach Change Request

Represents a client's request to permanently change coaches.

States:

Pending

Approved

Rejected

Approval creates a new recurring relationship.

---

# 15. Coach Availability

Defines recurring weekly working hours.

Coach Availability does not represent booked sessions.

It only defines possible working windows.

---

# 16. Coach Shift

Coach Shift overrides recurring availability.

Example:

Normal schedule:

9–5

Specific date:

12–8

Shift always overrides availability.

---

# 17. Coach Leave

Coach Leave blocks scheduling.

Leave affects:

* Booking generation
* Shadow assignments
* Capacity planning

---

# 18. Attendance

Attendance records participation.

Possible values:

* Present
* Late
* Missed
* Excused

Attendance belongs to a booking.

---

# 19. Workout Notes

Workout Notes capture coaching information.

Includes:

* Mobility
* Strength
* Weakness
* Homework
* Progress
* Pain
* Recommendations

Workout Notes are immutable historical records.

---

# 20. Progress Log

Progress Logs capture measurable client outcomes.

Examples:

* Weight
* Waist
* Body fat
* Strength
* Photos

Progress is independent of bookings.

---

# 21. Notification

Notification informs users of events.

Examples:

* Booking
* Reminder
* Feedback
* System

Notifications may later be delivered through:

* In-app
* Email
* WhatsApp
* Push

---

# 22. Audit Log

Audit Log records platform activity.

Every important operation should create an audit entry.

Purpose:

* Compliance
* Debugging
* Accountability

Audit Logs are append-only.

---

# 23. System Settings

System Settings store configurable business rules.

Examples:

* Session duration
* Join window
* Cutoff hours
* Inactivity threshold

Business logic must read from System Settings rather than hardcoded values.

---

# 24. Operations Center

Operations Center is an admin capability, not a database entity.

It aggregates:

* Capacity
* Idle coaches
* Shadow assignments
* Released slots
* Coach changes
* Inactive clients
* Alerts

---

# 25. Relationships

```
User
│
├── Client
│     ├── Subscription
│     ├── Recurring Slot
│     ├── Booking
│     ├── Progress Log
│     └── Notifications
│
├── Coach
│     ├── Availability
│     ├── Shift
│     ├── Leave
│     ├── Workout Notes
│     └── Assigned Clients
│
└── Admin
      └── Operations
```

---

# 26. Business Invariants

The following must always be true:

* A Client has only one primary coach at a time.
* A Booking belongs to exactly one Client and one Coach.
* A Recurring Slot generates many Bookings.
* A Coach cannot have overlapping Bookings.
* A Temporary Booking must expire or be confirmed.
* A Shadow Assignment never permanently changes the primary coach.
* A Coach Change Request is the only supported way to permanently change coaches.
* Assessment Sessions never consume package sessions.
* Audit Logs are never modified after creation.

---

# 27. Domain Events

Examples of important events:

* ClientRegistered
* AssessmentBooked
* SubscriptionPurchased
* CoachAssigned
* RecurringSlotCreated
* BookingConfirmed
* BookingCancelled
* BookingCompleted
* CoachLeaveApproved
* ShadowCoachAssigned
* CoachChangeRequested
* CoachChanged
* SubscriptionPaused
* SubscriptionResumed
* ClientMarkedInactive

These events can later drive notifications, analytics, automations, and AI.

---

# 28. Ubiquitous Language

Everyone working on LeanR should use these terms consistently.

| Correct Term         | Avoid                                                      |
| -------------------- | ---------------------------------------------------------- |
| Client               | User, Customer                                             |
| Coach                | Trainer, PT                                                |
| Booking              | Appointment                                                |
| Recurring Slot       | Weekly Booking                                             |
| Shadow Coach         | Backup Trainer                                             |
| Assessment Session   | Trial Session                                              |
| Subscription         | Membership                                                 |
| Package              | Plan                                                       |
| Coach Change Request | Transfer                                                   |
| Operations Center    | Admin Dashboard (when referring to the operational module) |

---

# 29. Guiding Principle

The domain model should remain stable even as technology changes.

Whether LeanR is implemented in Next.js, Flutter, React Native, or another platform, these business concepts should remain unchanged.

---

## Why this document is valuable

At this stage, your documentation becomes something that even large engineering teams use:

```
01_VISION.md
        ↓
02_PRD.md
        ↓
03_BUSINESS_OPERATIONS_SPEC.md
        ↓
04_SYSTEM_ARCHITECTURE.md
        ↓
05_USER_WORKFLOWS.md
        ↓
06_DOMAIN_MODEL.md
        ↓
PROJECT_BLUEPRINT.md
        ↓
ERD.md
        ↓
API.md
        ↓
Scheduling Engine.md
```

From here onward, any AI assistant or new developer can first understand the **business language**, then the **user flows**, and finally the **technical implementation**, which greatly reduces ambiguity as the project grows.
