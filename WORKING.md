# AlgoChat Project Working

This file explains what the project does, how the full system works, and how the frontend and backend connect.

## 1. What This Project Is

AlgoChat is a WhatsApp CRM and business operations dashboard.

It helps a business:

- manage WhatsApp conversations
- store and track leads/contacts
- create product and service catalogs
- create orders and appointments
- manage booking-based businesses like hotels, restaurants, and events
- automate replies with AI
- collect payments through Razorpay
- track billing, token usage, and dashboard subscriptions
- manage multiple admins and access rules

The project is split into two applications:

- `algoaura-frontend`: Next.js dashboard UI
- `algoaura-backend`: Next.js API routes plus an Express + Socket.IO + WhatsApp runtime

## 2. High-Level Architecture

### Frontend

The frontend is a Next.js app. Users open the dashboard here.

- App routes are inside `algoaura-frontend/app`
- Shared auth, layout, and UI components are inside `algoaura-frontend/app/components`
- Shared business helpers are inside `algoaura-frontend/lib`

Important point:

- frontend requests to `/api/*` are rewritten to the backend API through `algoaura-frontend/next.config.mjs`

That means the frontend talks to backend APIs without hardcoding every backend URL in each page.

### Backend

The backend has two parts:

1. Next.js API routes in `algoaura-backend/app/api`
2. A realtime server in `algoaura-backend/src/server.js`

The backend handles:

- authentication
- admin and profile management
- contacts, messages, catalog, orders, bookings, appointments
- reports and exports
- AI settings and automation config
- billing and payment APIs
- WhatsApp session management
- realtime status updates through Socket.IO

### Database

The project uses PostgreSQL.

- connection setup is in `algoaura-backend/src/db.js`
- most database access is centralized through `lib/db-helpers.js`

### Realtime and WhatsApp

The WhatsApp side runs through:

- `algoaura-backend/src/server.js`
- `algoaura-backend/src/whatsapp.js`

This layer manages:

- WhatsApp login/session state
- QR or pairing flows
- sending and receiving messages
- live status updates to the dashboard
- AI-driven reply generation
- payment reminder delivery

## 3. Main Runtime Flow

In normal local development, the project works like this:

1. User opens the frontend dashboard.
2. Frontend checks the current logged-in user through `/api/auth/me`.
3. If authenticated, the dashboard loads pages like Inbox, Contacts, Catalog, Orders, Billing, and Settings.
4. Frontend API calls go to backend Next.js routes.
5. If a page needs WhatsApp status or live updates, the frontend requests a short-lived backend JWT from `/api/auth/token`.
6. That backend JWT is used to connect to the Express/Socket.IO/WhatsApp server.
7. WhatsApp messages, order updates, payment reminders, and status changes are processed in backend services and persisted to PostgreSQL.

## 4. Authentication and Access Control

The auth system is more than a simple login form.

### Login

Login is handled by backend routes such as:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/token`

Main behavior:

- password-based login
- HTTP-only auth cookie
- rate limiting on login attempts
- optional email-based 2-factor login for admins

### Signup

Signup uses email verification:

- a verification code is sent by email
- after code verification, the admin account is created

### Roles

Main roles in the codebase:

- `super_admin`
- `client_admin`

### Restricted Mode

The app has a strong restricted/read-only mode.

If an account is inactive, expired, or its subscription is not active:

- the user can still view most data
- create/update/delete actions are blocked
- the UI visually disables action controls

This logic is enforced in both frontend and backend, not only in the UI.

## 5. Frontend Pages and What They Do

### `/dashboard`

This is the main overview page.

It shows:

- high-level stats
- recent messages
- lead/order/appointment metrics
- AI settings
- automation settings
- appointment business-hour settings
- billing summary for token-enabled accounts

This page is the control center for day-to-day operations.

### `/inbox`

This is the WhatsApp conversation workspace.

It supports:

- message listing
- filtering and search
- thread selection
- sending replies
- quick replies
- unread tracking
- WhatsApp readiness/status checks
- appointment-change intent hints in message text

It also uses the backend JWT flow to talk to the realtime WhatsApp server safely.

### `/contacts`

This is the lead/contact management page.

It supports:

- paginated contact list
- search
- contact detail view
- full chat history per contact
- latest requirement lookup
- sending direct chat replies
- toggling automation per contact
- deleting contacts

This page connects lead records with message history and customer requirements.

### `/catalog`

This is the products/services catalog manager.

It supports:

- creating products
- creating services
- categories, keywords, pricing, descriptions
- service duration
- booking eligibility
- WhatsApp visibility and sort order
- free-delivery eligibility for products

Catalog data is important because the AI and WhatsApp logic use it to answer customer questions.

### `/orders`

This is the product order management page.

It supports:

- order creation
- order status tracking
- fulfillment tracking
- payment status tracking
- payment details and notes
- linking customers to order history

Orders are intended for product-based businesses.

### `/appointments`

This is the scheduling and appointment management page.

It supports:

- service appointments
- booking appointments
- time slot management
- payment tracking for appointments
- filtering by appointment kind

This page works for service businesses and booking-enabled businesses.

### `/booking`

This page is a booking catalog builder for businesses like:

- hotels
- restaurants
- events

It supports:

- booking item setup
- booking categories
- search keywords
- price label and duration
- booking prompt text used during customer conversation

These booking items are designed to be discoverable through WhatsApp chats.

### `/revenue`

This page focuses on revenue analytics.

It shows:

- earned revenue
- booked revenue
- outstanding revenue
- subscription revenue
- AI spend
- net revenue
- trend charts

This is mainly relevant for product-oriented businesses.

### `/reports`

This page provides business reporting and export.

It includes:

- message trends
- lead status breakdown
- conversion metrics
- date range filters
- export to Excel and PDF

### `/billing`

This page manages billing operations.

It includes:

- summary of billing usage
- pay-as-you-go and prepaid flows
- Razorpay settings
- purchase history
- dashboard subscription configuration
- token system information
- admin billing controls for super admins

### `/settings`

This page is a mixed settings hub.

It includes:

- profile data
- business info
- theme and accent color
- password update
- 2-factor toggle
- WhatsApp connection/setup
- payment settings
- business type requests
- free-delivery rules

### `/admins`

This page is for super admins only.

It supports:

- viewing all admins
- updating admin role and status
- setting business type
- enabling booking
- enabling token billing
- controlling timed access
- handling business type change requests

### Secondary Pages

There are also additional pages in the codebase:

- `/broadcast`
- `/templates`
- `/signup`
- `/login`
- payment success/thank-you flows

`broadcast` and `templates` exist and have backend routes, but they are not currently shown in the main sidebar navigation.

## 6. Backend API Areas

The backend API is organized by business area.

### Auth

- `/api/auth/login`
- `/api/auth/signup`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/token`
- forgot/reset password routes
- Google auth routes

### Contacts and Messaging

- `/api/users`
- `/api/users/[id]`
- `/api/users/[id]/messages`
- `/api/users/[id]/requirements`
- `/api/messages`

### Catalog and Booking

- `/api/catalog`
- `/api/bookings`
- `/api/requirements`
- `/api/needs`

### Orders and Appointments

- `/api/orders`
- `/api/orders/[id]`
- `/api/orders/[id]/payment-link`
- `/api/appointments`
- `/api/appointments/[id]`

### Dashboard and Reports

- `/api/dashboard/stats`
- `/api/reports/overview`
- `/api/reports/export`

### Billing and Payments

- `/api/payments/summary`
- `/api/payments/pay`
- `/api/payments/verify`
- `/api/payments/prepaid`
- `/api/payments/purchases`
- `/api/payments/dashboard`
- `/api/payments/settings`
- `/api/payments/admins`
- `/api/payments/invoice`

### Admin and Profile

- `/api/admins`
- `/api/admins/[id]`
- `/api/admins/business-type-requests`
- `/api/profile`
- `/api/profile/password`
- `/api/profile/photo`
- `/api/profile/business-type-request`

### WhatsApp

- `/api/whatsapp/start`
- `/api/whatsapp/status`
- `/api/whatsapp/disconnect`

### AI Settings

- `/api/ai-settings`

## 7. How WhatsApp Automation Works

This is one of the most important parts of the project.

### Core Idea

The system connects a business WhatsApp account and turns incoming chats into CRM activity.

### Main WhatsApp Capabilities

- multi-admin WhatsApp sessions
- QR/pairing-based connection flow
- session cleanup for idle users/sessions
- message deduplication
- state persistence and recovery
- send admin replies from the dashboard
- send payment reminders with links

### AI Reply Flow

The AI layer uses:

- business profile information
- catalog data
- booking keywords
- conversation history
- admin-configured prompt/settings

The AI request utility is in `algoaura-backend/src/openrouter.js`.

The catalog context builder is in `algoaura-backend/src/catalog-ai-context.js`.

That means the bot does not answer blindly. It tries to answer using business-specific catalog knowledge first.

### AI Configuration

Admins can configure:

- whether AI is enabled
- the AI prompt
- blocklist text
- automation mode
- keyword-trigger mode
- recovery settings for pending WhatsApp messages
- appointment business-hour and slot settings

### Conversation Recovery

The codebase also includes persistence and recovery modules under `algoaura-backend/src/persistence`.

These are meant to:

- keep conversation/session state
- recover after restart/failure
- clean up stale sessions
- improve resilience for WhatsApp automation

## 8. Catalog, Orders, and Appointments Relationship

These three areas are connected.

### Catalog

Catalog items describe what the business sells.

- products are used for order workflows
- services are used for appointment workflows
- booking items are used for booking-style appointment workflows

### Orders

Orders are mainly for product selling.

They store:

- customer info
- item list
- payment state
- fulfillment state
- notes and payment references

### Appointments

Appointments are mainly for service and booking businesses.

They store:

- contact
- appointment type/kind
- start and end time
- status
- payment amounts and method

This lets the same CRM support multiple business models:

- product-only
- service-only
- mixed product + service
- booking-heavy businesses

## 9. Billing and Payment Logic

The project has two billing layers.

### A. Business Billing Inside the CRM

The CRM can create and track payments for customers using Razorpay.

Used for:

- order payments
- due payment reminders
- payment links
- payment verification

Important helper code:

- `algoaura-backend/lib/razorpay.js`

### B. Platform Billing for Using AlgoChat

The platform itself also bills admins.

This includes:

- token usage pricing
- prepaid balance
- pay-as-you-go
- dashboard subscription charges
- business type change charges

Important helper code:

- `algoaura-backend/lib/billing.js`

So the system handles both:

- customer payments for the business
- platform payments from the admin to AlgoChat

## 10. Email Features

Email is used for operational account flows.

Main use cases:

- signup verification code
- login 2-factor code
- password reset support

Email transport is built with Nodemailer and Gmail-style SMTP settings in `algoaura-backend/lib/mailer.js`.

## 11. Security and Reliability

The codebase includes several protective layers.

### Security

- HTTP-only auth cookie
- JWT verification
- scoped backend JWT for realtime server access
- rate limiting for auth flows
- security middleware in backend Express server
- role and subscription checks
- read-only enforcement in restricted mode

### Reliability

- caching for dashboard stats and AI settings
- session persistence/recovery modules
- graceful shutdown support
- integration, load, chaos, and property tests in backend test folders

## 12. Current Port and Environment Expectations

From the current code:

- frontend rewrite target defaults to `http://localhost:5000/api`
- backend API dev script runs Next.js on port `5000`
- WhatsApp/Socket server defaults to `3001` unless overridden by environment variables

The frontend also reads:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WHATSAPP_API_BASE`
- `NEXT_PUBLIC_WHATSAPP_SOCKET_URL`

If these values do not match your local backend/WhatsApp runtime, frontend features like Inbox or WhatsApp status will fail.

## 13. Simple End-to-End Example

Here is one realistic flow:

1. A customer sends a WhatsApp message asking about a product or booking.
2. The WhatsApp runtime receives the message.
3. The system checks business info, catalog context, automation settings, and message history.
4. AI may generate a business-aware reply.
5. The message is saved in the database.
6. The admin can open Inbox or Contacts and continue the conversation manually.
7. If the customer confirms a purchase, the admin creates an order or appointment.
8. If payment is needed, the system can create a Razorpay link.
9. Revenue and reports later reflect those transactions.

## 14. In Short

AlgoChat is not just a chat UI.

It is a combined system for:

- WhatsApp CRM
- lead management
- product/service/booking management
- orders and appointments
- AI automation
- payment collection
- admin and subscription control
- reporting and analytics

If you want, the next useful step is to convert this into:

- a cleaner `README.md`
- separate frontend and backend architecture docs
- an API documentation file
- a database table explanation file
