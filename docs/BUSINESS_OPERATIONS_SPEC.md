# LEANR by Fitelo

# Business & Operations Specification

**Version:** 1.0

**Purpose:** Define every operational workflow, scheduling rule, business policy, automation, and exception handling used by the LeanR PT platform.

---

# 1. Objective

This document defines the operational behavior of LeanR.

Unlike the PRD, this document does **not** describe UI.

Unlike the Engineering Blueprint, this document does **not** describe implementation.

It defines the business decisions that the software must always enforce.

If any feature conflicts with this document, this document takes precedence.

---

# 2. Operational Philosophy

LeanR is an operations-first PT platform.

The objective is to:

* Maximize coach utilization.
* Preserve coach continuity.
* Reduce manual scheduling.
* Deliver predictable recurring coaching.
* Minimize operational costs.
* Automate repetitive decisions.

Every scheduling decision should improve both client experience and business efficiency.

---

# 3. Core Operational Principles

Every workflow in LeanR should follow these principles.

### Coach Continuity

Every client should have one dedicated primary PT coach.

Changing coaches is an exception, not a normal workflow.

---

### Recurring Scheduling

Clients reserve recurring schedules instead of individual sessions.

Recurring schedules always take priority over temporary bookings.

---

### Capacity Optimization

Unused coach capacity should be minimized.

Whenever a slot becomes available, it should immediately be reused.

---

### Automation First

Scheduling, slot allocation, reminders, and capacity balancing should be automated whenever possible.

Admins should only handle exceptional cases.

---

# 4. Client Lifecycle

A client progresses through the following lifecycle.

```
Lead

↓

Assessment Session

↓

Package Purchase

↓

Coach Assignment

↓

Recurring Slot Selection

↓

Regular PT Sessions

↓

Progress Tracking

↓

Subscription Completion

↓

Renewal / Exit
```

---

# 5. Coach Lifecycle

```
Coach Created

↓

Availability Configured

↓

Receives Clients

↓

Conducts Sessions

↓

Leave Management

↓

Shadow Coach Assignment (if required)

↓

Performance Tracking

↓

Active / Inactive
```

---

# 6. Session Lifecycle

```
Booking Created

↓

Upcoming

↓

Join Window Opens

↓

Live Session

↓

Completed

↓

Workout Notes

↓

Attendance

↓

Feedback

↓

Analytics Updated
```

Possible status changes:

```
Upcoming

↓

Completed

↓

Cancelled

↓

Missed

↓

Rescheduled
```

---

# 7. Subscription Lifecycle

```
Created

↓

Active

↓

Paused

↓

Resumed

↓

Completed

↓

Expired

↓

Renewed
```

---

# 8. Coach Assignment Rules

A client receives one primary coach.

Assignment considers:

* Coach specialization
* Coach availability
* Coach capacity
* Language preference
* Gender preference (if requested)

Once assigned:

* Coach remains constant.
* Client books only with that coach.
* Coach changes require approval.

---

# 9. Recurring Slot Reservation Rules

Clients reserve recurring schedules.

Example

Monday

Wednesday

Friday

6:00 AM

The system automatically reserves every future occurrence until:

* Subscription ends.
* Subscription pauses.
* Coach change approved.
* Client becomes inactive.
* Admin releases the slot.

Reserved recurring slots are never shown as available to new clients.

---

# 10. Progressive Scheduling Rules

Scheduling order:

Level 1

* Monday–Wednesday–Friday
* Tuesday–Thursday–Saturday

Level 2

Any two-day combinations.

Level 3

Daily.

Level 4

Fully custom.

Only available schedules should ever be displayed.

---

# 11. Temporary Booking Rules

Clients may request one-off replacement sessions.

Rules:

* Prefer same coach.
* Show only available slots.
* Booking closes 12 hours before the original session.
* Original recurring slot is released only for that occurrence.

Future recurring bookings remain unchanged.

---

# 12. Shadow Coach Rules

Shadow Coaches are used only for temporary continuity.

Triggers:

* Coach leave.
* Emergency.
* Shift conflict.
* Temporary unavailability.

Selection priority:

1. Idle coach
2. Cancelled slot
3. Rescheduled slot
4. Lowest utilization
5. Same specialization
6. Same language
7. Same gender preference

Primary coach remains assigned.

Only affected sessions are transferred.

---

# 13. Coach Change Workflow

Client requests coach change.

↓

Admin reviews request.

↓

Admin approves or rejects.

↓

If approved:

* Previous recurring slots released.
* New coach assigned.
* Client repeats scheduling process.
* History transferred.

Coach changes are never automatic.

---

# 14. Slot Recovery Rules

Released slots should immediately return to inventory.

Release triggers:

* Cancellation
* Reschedule
* Pause
* Subscription completion
* Inactivity
* Coach leave
* Manual admin release

Priority allocation:

1. Shadow Coach
2. Temporary booking
3. Assessment
4. Demo
5. New recurring booking

---

# 15. Client Inactivity Rules

A client becomes inactive when configured thresholds are met.

Workflow:

Week 1

* Reminder Email 1
* Reminder Email 2

Week 2

* Release future recurring slots.
* Notify operations.

Client remains enrolled but loses reserved schedule.

---

# 16. Assessment Session Rules

Every new client receives one assessment session.

Characteristics:

* Free
* Does not consume package sessions
* Longer duration
* Conducted by assigned coach

Assessment collects:

* Fitness level
* Goals
* Mobility
* Equipment
* Limitations
* Coach observations

---

# 17. Admin Override Rules

Admin may override:

* Session timing
* Coach assignment
* Slot release
* Capacity
* Pause
* Subscription
* Leave approval
* Coach availability
* Shadow coach assignment

Every override must be logged.

---

# 18. Notification Rules

Clients receive:

* Booking confirmation
* Session reminder
* Cancellation notice
* Coach unavailable
* Shadow coach assigned
* Coach change decision
* Assessment reminder

Coaches receive:

* New booking
* Cancellation
* Leave approval
* Shadow assignment
* Session reminder

Admins receive:

* Coach change requests
* Leave requests
* Capacity alerts
* Inactive clients
* Shadow assignments

---

# 19. Operational KPIs

The system should continuously monitor:

## Client KPIs

* Active clients
* Attendance rate
* Completion rate
* Retention
* Satisfaction

## Coach KPIs

* Utilization %
* Active clients
* Idle hours
* Ratings
* Sessions completed

## Business KPIs

* Capacity utilization
* Released slot usage
* Cancellation rate
* No-show rate
* Shadow Coach usage
* Manual interventions
* Revenue
* Session volume

---

# 20. Exception Handling

The platform must gracefully handle:

* Coach on leave
* Double booking attempts
* Client inactivity
* Subscription pause
* Coach resignation
* Emergency rescheduling
* Capacity exhaustion
* Assessment conversion
* Manual admin intervention

No exception should corrupt recurring schedules or session history.

---

# 21. Non-Negotiable Rules

The following rules must never be violated:

1. A coach cannot have overlapping sessions.
2. Recurring slots always have priority.
3. One client has one primary coach.
4. Coach changes require approval.
5. Assessment sessions never consume package sessions.
6. Released slots should be reused whenever possible.
7. Every important action must create an audit log.
8. Scheduling decisions should maximize coach utilization.
9. Client history must never be lost during coach changes.
10. Admin always has the ability to manually override operational decisions.

---

This document becomes the **operational constitution** of LeanR. Together with your **Vision**, **PRD**, and **Engineering Blueprint**, it gives both AI coding assistants and human developers a complete understanding of the product from business strategy down to day-to-day operations.
