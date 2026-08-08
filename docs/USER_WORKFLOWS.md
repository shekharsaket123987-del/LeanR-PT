# LEANR by Fitelo

# User Workflows

**Version:** 1.0

**Purpose**

This document defines every major workflow within the LeanR platform.

It explains how Clients, PT Coaches, and Admins interact with the system from start to finish.

These workflows define the expected behavior of the application and should remain consistent across future releases.

---

# 1. Workflow Philosophy

LeanR is designed to make complex operational processes feel simple for users.

Every workflow should:

* Minimize user effort
* Preserve coach continuity
* Reduce operational intervention
* Maintain scheduling consistency
* Prevent unnecessary errors

---

# 2. Client Journey

```text
Discover LeanR

↓

Book Assessment

↓

Attend Assessment

↓

Purchase Plan

↓

Coach Assigned

↓

Recurring Schedule Selected

↓

Regular PT Sessions

↓

Progress Tracking

↓

Subscription Renewal
```

---

# 3. New Client Onboarding Workflow

### Step 1

Client visits LeanR website.

↓

Clicks

"Book Assessment"

---

### Step 2

Client enters

* Name
* Email
* Phone

---

### Step 3

Admin assigns assessment coach.

---

### Step 4

Assessment session booked.

---

### Step 5

Coach conducts assessment.

Records:

* Goals
* Injuries
* Equipment
* Mobility
* Lifestyle
* Recommendations

---

### Step 6

Client purchases package.

---

### Step 7

Primary coach assigned.

---

### Step 8

Client selects recurring schedule.

Preferred order:

MWF

↓

TTS

↓

2-day schedule

↓

Daily

↓

Custom

---

### Step 9

Recurring slots reserved.

Client enters normal coaching lifecycle.

---

# 4. Regular Session Workflow

Client

↓

Receives reminder

↓

Join button activates

↓

Client joins session

↓

Coach joins session

↓

Workout conducted

↓

Coach records notes

↓

Attendance updated

↓

Client rates session

↓

Progress updated

---

# 5. Temporary Session Workflow

Client unavailable during normal schedule.

↓

Opens

Temporary Session

↓

System searches

Same coach availability

↓

Available replacement slots displayed

↓

Client selects replacement

↓

Original slot released

↓

Replacement session confirmed

---

# 6. Coach Leave Workflow

Coach submits leave.

↓

Admin reviews.

↓

Leave approved.

↓

Shadow Coach assigned.

↓

Upcoming affected sessions transferred.

↓

Clients notified.

↓

Primary coach resumes after leave.

---

# 7. Shadow Coach Workflow

Primary coach unavailable.

↓

System identifies affected sessions.

↓

Searches available coaches.

Priority:

Idle

↓

Cancelled slot

↓

Rescheduled slot

↓

Lowest utilization

↓

Best match

↓

Shadow coach assigned.

↓

Session completed.

↓

Notes transferred.

↓

Primary coach resumes.

---

# 8. Coach Change Workflow

Client requests coach change.

↓

Reason submitted.

↓

Admin reviews.

↓

Approve / Reject.

If approved:

↓

New coach selected.

↓

Recurring slots released.

↓

Client books new recurring schedule.

↓

Workout history transferred.

↓

Future sessions updated.

---

# 9. Cancellation Workflow

Client selects upcoming booking.

↓

System checks cutoff.

If outside cutoff:

↓

Cancel allowed.

↓

Recurring schedule maintained.

↓

Released slot returned to inventory.

↓

Notification sent.

---

# 10. Reschedule Workflow

Client requests reschedule.

↓

System validates availability.

↓

Conflict detection.

↓

Booking updated.

↓

Notifications sent.

Recurring schedule preserved.

---

# 11. Subscription Pause Workflow

Client requests pause.

↓

Admin approves.

↓

Subscription paused.

↓

Future recurring slots temporarily released.

↓

Subscription resumed later.

↓

Recurring schedule restored if available.

Otherwise

↓

Client selects new recurring schedule.

---

# 12. Inactivity Workflow

Client inactive.

↓

Reminder Email 1.

↓

Reminder Email 2.

↓

No response.

↓

Recurring slots released.

↓

Operations notified.

↓

Client remains enrolled.

↓

Client books new schedule upon return.

---

# 13. Admin Workflow

Admin logs in.

↓

Dashboard.

↓

Reviews alerts.

↓

Coach requests.

↓

Coach changes.

↓

Operations Center.

↓

Reports.

↓

Settings.

↓

Logout.

---

# 14. Coach Workflow

Coach logs in.

↓

Today's schedule.

↓

Upcoming sessions.

↓

Join session.

↓

Complete session.

↓

Workout notes.

↓

Availability updates.

↓

Logout.

---

# 15. Booking Workflow

Client selects booking.

↓

Scheduling engine.

↓

Capacity validation.

↓

Conflict detection.

↓

Temporary hold.

↓

Booking confirmation.

↓

Notification.

↓

Calendar updated.

---

# 16. Assessment Workflow

Assessment booked.

↓

Coach performs evaluation.

↓

Fitness profile created.

↓

Recommendations generated.

↓

Package suggested.

↓

Client converted.

↓

Primary coach assigned.

---

# 17. Notification Workflow

System event.

↓

Notification created.

↓

Stored in database.

↓

Delivered.

↓

User opens.

↓

Marked as read.

---

# 18. Error Workflows

Examples:

Coach unavailable.

↓

Suggest alternatives.

---

Capacity full.

↓

Offer waitlist.

---

Booking conflict.

↓

Suggest nearby slots.

---

Subscription expired.

↓

Prompt renewal.

---

# 19. Admin Override Workflow

Admin edits booking.

↓

Validation.

↓

Audit log.

↓

Notifications.

↓

System updated.

---

# 20. Complete LeanR Lifecycle

```text
Visitor

↓

Assessment

↓

Subscription

↓

Coach Assignment

↓

Recurring Schedule

↓

PT Sessions

↓

Progress

↓

Renewal

↓

Retention

↓

Referral

↓

Long-Term Client
```

---

# 21. Guiding Workflow Principle

Every workflow should answer three questions before implementation:

1. Does this improve the client experience?
2. Does this reduce operational effort?
3. Does this preserve coach continuity?

If the answer to any of these is **no**, the workflow should be reconsidered.

---

# Why this document matters

At this point, your documentation stack becomes very powerful:

```
01_VISION.md
        │
        ▼
02_PRD.md
        │
        ▼
03_BUSINESS_OPERATIONS_SPEC.md
        │
        ▼
04_SYSTEM_ARCHITECTURE.md
        │
        ▼
05_USER_WORKFLOWS.md
        │
        ▼
PROJECT_BLUEPRINT.md
        │
        ▼
API.md
        │
        ▼
ERD.md
        │
        ▼
Scheduling Engine
```

This order mirrors how experienced product and engineering teams communicate:

* **Vision** explains *why* the product exists.
* **PRD** explains *what* users need.
* **Business Operations** defines the business rules.
* **System Architecture** explains the technical design.
* **User Workflows** explains how every role moves through the system.
* **Engineering documents** then define exactly how to implement those workflows.

At this point, your documentation would be comprehensive enough that a new engineer—or an AI coding assistant—could understand both the business and technical context before writing code.
