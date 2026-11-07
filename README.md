# EventEase

EventEase is a MERN event discovery and management starter with a responsive React/Vite frontend and an Express/MongoDB API.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB locally or a MongoDB Atlas connection string

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and a random `JWT_SECRET` (at least 32 characters).
2. Install and start the API:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

3. In a separate terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The frontend is served at `http://localhost:5173`, and the API health check is at `http://localhost:5000/api/health`. Vite proxies `/api` requests to the local API.

To deliver email, configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, and optionally `EMAIL_FROM` in the backend environment. Email delivery is explicitly logged as disabled when these are not set. Never commit `.env` files.

Paid events are priced in INR and use Razorpay Standard Checkout. Add Razorpay **Test Mode** API credentials to `backend/.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; never expose the secret in frontend variables or commit it. The backend creates orders, reserves capacity, verifies checkout signatures and payment amounts with Razorpay, and releases abandoned reservations after 30 minutes. Paid ticket cancellation/refunds are not automated; attendees should contact the event organizer.

To create the first administrator, set `ADMIN_EMAIL`, `ADMIN_NAME`, and a private `ADMIN_PASSWORD` (at least 12 characters) in `backend/.env`, then run `npm run admin:create` from `backend`. The command does not create public administrator signups.

## Included flows

- Attendee and organizer registration, login, persistent HTTP-only cookie sessions, password reset tokens, and profile updates.
- Public event discovery with text search, category/type/free/availability filters, sorting, event details, and organizer event submission.
- Organizer-defined booking slots with independent dates, locations, and capacity; attendees provide their booking name, email, phone, city, and optional note, then see the selected slot and booking status on their dashboard and ticket. Admins can review safe account profile and registration contact details, selected event slot, and payment status in the dashboard.
- Admin approval/rejection API and dashboard, event status controls, admin user management/statistics, and organizer-owned event listing.
- Capacity-guarded event registration, duplicate protection, cancellation, generated QR tickets, organizer check-in, saved events, and in-app notifications.
- Responsive landing, discovery, event detail, authentication and password reset, attendee/organizer dashboards, profile editing, saved events, notifications, ticket view, and event creation pages.

## API routes

The API is mounted under `/api`: `/auth`, `/events`, `/registrations`, `/users`, and `/notifications`. Protected endpoints accept the HTTP-only session cookie; bearer JWTs are also supported for API clients.

## Current integration boundaries

- Email verification and scheduled reminders are not configured. Password reset and welcome/registration email delivery require SMTP settings. Create the initial admin using the local-only `admin:create` command rather than allowing public admin registration.
- Event banner images currently use validated URLs; use a managed object-storage provider before enabling user uploads in production.

Run `npm run build` and `npm run lint` in `frontend` to validate the client. Run `npm test` in `backend` for API tests.
