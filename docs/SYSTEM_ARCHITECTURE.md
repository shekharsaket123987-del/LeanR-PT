# LEANR by Fitelo

# System Architecture

**Version:** 1.0

**Purpose**

This document defines the complete technical architecture of LeanR.

It describes how every component of the platform communicates and how data flows through the system.

Unlike the PRD, this document is implementation-oriented.

It serves as the master architecture reference for developers, AI coding assistants, DevOps engineers, and future contributors.

---

# 1. Architecture Philosophy

LeanR follows a layered architecture.

Every layer has a single responsibility.

No UI component should directly access the database.

No business rules should exist inside React components.

Every business rule should be enforced by the backend and database.

The architecture prioritizes:

* Scalability
* Security
* Maintainability
* Testability
* Performance
* Separation of Concerns

---

# 2. High-Level Architecture

```text
                    Browser
                       │
        ┌──────────────┴──────────────┐
        │                             │
 Landing Website               Role Portals
(Client / Coach / Admin)
        │
        ▼
Next.js Frontend (React + TypeScript)
        │
Server Actions / API Routes
        │
Service Layer
        │
Business Rules
        │
Scheduling Engine
        │
Supabase PostgreSQL
        │
Storage / Auth / Realtime
```

---

# 3. Technology Stack

## Frontend

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion
* React Hook Form
* Zod
* Recharts

---

## Backend

* Next.js Server Actions
* Service Layer
* PostgreSQL Functions
* RPC
* Row Level Security

---

## Database

* PostgreSQL

Hosted by Supabase

---

## Authentication

Supabase Authentication

Role Based Access

Admin

Coach

Client

---

## Storage

Supabase Storage

Store

* Coach images
* Client progress photos
* PDFs
* Workout attachments

---

## Deployment

Frontend

Vercel

Backend

Supabase

Database

Supabase PostgreSQL

---

# 4. Application Layers

Layer 1

Presentation

React Components

---

Layer 2

Page Layer

App Router

---

Layer 3

Server Actions

Authentication

Validation

Calling services

---

Layer 4

Service Layer

Business logic

Authorization

Permissions

---

Layer 5

Scheduling Engine

Slot validation

Conflict detection

Recurring scheduling

Shadow coach

Capacity optimization

---

Layer 6

Database

Tables

Functions

Triggers

Views

Indexes

RLS

---

# 5. Frontend Architecture

The frontend is divided into

Public Website

Client Portal

Coach Portal

Admin Portal

Shared Components

UI Components

Hooks

Utilities

Services

---

# 6. Backend Architecture

The backend follows

Controller

↓

Server Action

↓

Service

↓

Database Function

↓

PostgreSQL

No React component should directly perform business operations.

---

# 7. Authentication Flow

User logs in.

↓

Supabase validates credentials.

↓

Session created.

↓

JWT issued.

↓

Middleware validates session.

↓

Role detected.

↓

Portal access granted.

---

# 8. Authorization

Admin

Full platform access.

Coach

Only assigned clients.

Own availability.

Own sessions.

Client

Own profile.

Own sessions.

Own coach.

Own bookings.

Everything enforced by RLS.

---

# 9. Scheduling Architecture

Scheduling is isolated.

Modules

Availability Engine

↓

Recurring Slot Engine

↓

Temporary Booking Engine

↓

Conflict Detection

↓

Capacity Validation

↓

Shadow Coach Engine

↓

Slot Recovery Engine

↓

Booking Confirmation

---

# 10. Notification Architecture

Events

↓

Notification Service

↓

Notification Templates

↓

Database

↓

Future Channels

* Email
* Push
* WhatsApp

---

# 11. Video Session Architecture

Booking

↓

Meeting Created

↓

Meeting Link Stored

↓

Coach

↓

Client

↓

Join Session

Future providers

* Daily
* 100ms
* Zoom

---

# 12. Reporting Architecture

Operational Data

↓

Views

↓

Analytics

↓

Charts

↓

Exports

CSV

PDF

---

# 13. Audit Architecture

Every important action

↓

Audit Service

↓

Audit Logs

Track

* User
* Time
* Entity
* Previous Value
* New Value
* Action

---

# 14. AI Architecture (Future)

Future AI modules

Coach Recommendation

↓

Schedule Optimization

↓

Capacity Forecasting

↓

Workout Recommendation

↓

Client Risk Prediction

↓

Business Insights

AI should consume existing services instead of bypassing business rules.

---

# 15. Scalability Strategy

Design for

100,000+ Clients

10,000+ Coaches

Millions of Bookings

Multiple Countries

Multiple Time Zones

The architecture should support horizontal scaling without major redesign.

---

# 16. Security Principles

* Row Level Security
* JWT Authentication
* Role Based Access
* Input Validation
* Secure Server Actions
* Environment Variable Protection
* Audit Logging
* Least Privilege Access

---

# 17. Error Handling

All services should return standardized responses.

Example:

```typescript
{
  success: true,
  data: ...
}
```

or

```typescript
{
  success: false,
  error: {
    code: "...",
    message: "..."
  }
}
```

---

# 18. Monitoring

Future integrations:

* Sentry
* Vercel Analytics
* Supabase Logs
* Performance Monitoring
* Error Tracking
* Audit Dashboard

---

# 19. Deployment Flow

```text
Developer

↓

GitHub

↓

GitHub Actions

↓

Vercel

↓

Supabase

↓

Production
```

---

# 20. Guiding Principle

Every feature added to LeanR must respect the existing architecture.

Developers should extend existing services rather than introducing duplicate logic.

Business rules must remain centralized.

The database is the source of truth.

The scheduling engine is the heart of the platform.

The frontend is responsible only for presenting data and collecting user input.

---

# 📁 Recommended Final Documentation Structure

At this point, your documentation should look like this:

```text
docs/
│
├── 01_VISION.md                     ⭐ Why LeanR exists
├── 02_PRD.md                        ⭐ Product requirements
├── 03_BUSINESS_OPERATIONS_SPEC.md   ⭐ Operational rules
├── 04_SYSTEM_ARCHITECTURE.md        ⭐ Technical architecture
├── 05_PROJECT_BLUEPRINT.md          ⭐ Engineering implementation
├── 06_ERD.md                        ⭐ Database model
├── 07_API.md                        ⭐ Service layer
├── 08_BUSINESS_RULES.md             ⭐ Configurable business rules
├── 09_SCHEDULING_ENGINE.md          ⭐ Scheduling logic
├── 10_BOOKING_SEQUENCE.md           ⭐ Sequence diagrams
├── 11_FOLDER_ARCHITECTURE.md        ⭐ Project structure
├── 12_DEPLOYMENT.md                 ⭐ DevOps & deployment
├── 13_TESTING_STRATEGY.md           ⭐ QA & testing
├── 14_SECURITY.md                   ⭐ Security practices
├── 15_AI_ROADMAP.md                 ⭐ Future AI capabilities
└── CHANGELOG.md                     ⭐ Version history
```

With this structure, someone new to the project—or an AI coding assistant—can understand the product in the right order: **Vision → Product → Operations → Architecture → Implementation → Deployment → Future roadmap**. This minimizes ambiguity and makes future development much more consistent.
