# LEANR by Fitelo

# Engineering Standards

**Version:** 1.0

**Purpose**

This document defines the engineering standards, coding conventions, architectural rules, quality expectations, and development practices for the LeanR platform.

Every contributor, human or AI, must follow these standards.

If generated code violates these standards, it should be considered incomplete.

---

# 1. Engineering Philosophy

LeanR is intended to be a production-grade SaaS platform.

Every implementation should prioritize:

* Simplicity
* Readability
* Maintainability
* Scalability
* Security
* Performance
* Testability

Never sacrifice long-term maintainability for short-term speed.

---

# 2. Architecture Principles

The project follows strict layered architecture.

```text
UI

↓

Server Actions

↓

Service Layer

↓

Database Functions

↓

PostgreSQL
```

Rules:

* UI never contains business logic.
* Services never render UI.
* Database never knows about React.
* APIs remain thin.
* Business rules live only once.

---

# 3. Folder Organization

Every new module should follow:

```
feature/

components/

hooks/

actions/

services/

types/

utils/

tests/
```

Avoid dumping unrelated utilities into generic folders.

---

# 4. Naming Conventions

Components

```
ClientDashboard.tsx
```

Hooks

```
useBookings.ts
```

Actions

```
createBookingAction.ts
```

Services

```
booking.service.ts
```

Database functions

```
confirm_booking()
```

Enums

```
BookingStatus
```

Interfaces

```
Booking
```

Never abbreviate names unnecessarily.

---

# 5. React Standards

Use:

* Functional Components
* TypeScript
* Hooks
* Server Components where appropriate
* Client Components only when interactivity is required

Avoid unnecessary state.

Prefer derived values over duplicated state.

---

# 6. TypeScript Standards

Always enable strict typing.

Avoid:

```ts
any
```

Prefer:

```ts
unknown
```

or properly typed interfaces.

---

# 7. Service Layer Rules

Every business operation must pass through a service.

Example:

```
React

↓

Server Action

↓

booking.service.ts

↓

RPC

↓

Postgres
```

React components must never directly manipulate business data.

---

# 8. Database Rules

The database is the source of truth.

Business constraints belong in PostgreSQL whenever possible.

Examples:

* Constraints
* Triggers
* RLS
* Functions
* Transactions

Avoid enforcing critical business rules only in JavaScript.

---

# 9. Error Handling

Every service returns a consistent response.

Example:

```ts
{
    success: true,
    data: ...
}
```

or

```ts
{
    success: false,
    error: {
        code,
        message
    }
}
```

Never expose raw database errors directly to the UI.

---

# 10. Logging

Every critical action should create:

* Audit Log
* Error Log (when applicable)
* Business Event

Examples:

* Booking created
* Booking cancelled
* Coach changed
* Shadow assigned

---

# 11. Security Standards

Never trust the frontend.

Always validate:

* Authentication
* Authorization
* Ownership
* Input
* Permissions

Every protected operation must pass RLS and service authorization.

---

# 12. API Design

APIs should:

* Be predictable
* Be versionable
* Return typed responses
* Validate inputs
* Never leak internal implementation

---

# 13. UI Standards

All screens should follow the LeanR Design System.

Use:

* Consistent spacing
* Consistent typography
* Shared components
* Skeleton loaders
* Empty states
* Error states
* Loading indicators

Never duplicate UI patterns.

---

# 14. Accessibility

All new UI should support:

* Keyboard navigation
* Screen readers
* Focus management
* Color contrast
* Accessible labels

Accessibility is a requirement, not an enhancement.

---

# 15. Performance

Optimize for:

* Fast initial load
* Efficient rendering
* Lazy loading where appropriate
* Minimal client-side JavaScript
* Efficient database queries

Measure performance before optimizing.

---

# 16. Git Standards

Every feature should use its own branch.

Example:

```
feature/client-booking

feature/shadow-coach

feature/operations-center
```

Commit messages:

```
feat: implement recurring slot reservation

fix: resolve booking conflict validation

refactor: move booking logic into service layer
```

Avoid vague messages like "update" or "changes".

---

# 17. Code Review Checklist

Before merging:

* Business rules followed
* RLS respected
* Types correct
* Tests updated
* Documentation updated
* No duplicate logic
* No hardcoded values
* UI consistent
* Error handling complete

---

# 18. Documentation Rules

Every new feature should update:

* PRD (if user-facing behavior changes)
* Business Operations (if workflow changes)
* API (if endpoints change)
* ERD (if schema changes)
* Changelog

Documentation is part of the feature, not an afterthought.

---

# 19. AI Development Rules

When using AI to generate code:

* Never accept generated code without review.
* Ask AI to explain architectural decisions.
* Generate one feature at a time.
* Test before moving to the next feature.
* Prefer extending existing services over creating new ones.

AI should follow existing architecture, not replace it.

---

# 20. Definition of Done

A feature is complete only when:

* Business logic implemented
* UI connected
* Service layer updated
* Database updated (if required)
* Security validated
* Error handling added
* Documentation updated
* Tests pass
* Code reviewed

If any of these are missing, the feature is considered incomplete.

---

# 21. Guiding Principle

Every line of code should answer one question:

> **Will this still be understandable, maintainable, and scalable one year from now?**

If the answer is **no**, redesign it before merging.

---

# My Recommendation

At this point, **stop writing high-level documents** and start building.

You now have documentation that covers:

* **Vision** → Why LeanR exists
* **PRD** → What the product does
* **Business Operations** → How the business operates
* **System Architecture** → How the system is built
* **User Workflows** → How users interact
* **Domain Model** → Business language
* **Product Roadmap** → Where the product is going
* **Engineering Standards** → How code should be written

That is more than enough for a strong engineering foundation. From here, your time will be better spent implementing features, updating these documents as the product evolves, rather than creating additional top-level specifications.
