# CareSlot: Hospital Doctor Availability and Appointment MVP

## 1. The problem
A patient travels to the hospital, and the doctor is on leave, late, or not in OPD that day. The patient loses time and money, and the hospital gets crowded and gets complaints.

## 2. The solution (one line)
Patients see a doctor's live status and book a time slot before leaving home, and they get notified instantly if anything changes.

## 3. Users
| Role | What they do |
|---|---|
| Patient | Find a doctor, see live status, book, cancel or reschedule, get alerts |
| Doctor | Set weekly schedule, mark today's status (Available / Delayed / On leave), see today's list |
| Admin (reception) | Add doctors and departments, view and manage all appointments |

## 4. MVP scope

**In scope**
1. Auth with roles (patient, doctor, admin)
2. Departments and doctor listing with search/filter
3. Doctor profile with **today's live status** badge
4. Weekly schedule and auto-generated time slots
5. Book, cancel and reschedule appointments (no double booking)
6. Doctor dashboard: today's appointments, status switch, mark completed
7. Notifications: in-app (realtime) and email when a doctor is delayed or on leave or an appointment is cancelled
8. Admin panel: manage doctors, departments, appointments

**Out of scope (v2)**
Payments, video consultation, prescriptions/EHR, SMS/WhatsApp, AI triage, multi-hospital support, queue token display.

## 5. Recommended stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (Postgres, Auth, Row Level Security, Realtime)
- **Email:** Resend (free tier)
- **Deploy:** Vercel and Supabase cloud
- **Later:** SMS via MSG91 or Twilio

## 6. Data model
- `profiles` (id, full_name, phone, role: patient|doctor|admin)
- `departments` (id, name)
- `doctors` (id, profile_id, department_id, specialization, qualification, experience_years, consultation_minutes)
- `doctor_schedules` (id, doctor_id, weekday 0-6, start_time, end_time)
- `doctor_daily_status` (id, doctor_id, date, status: available|delayed|on_leave|not_checked_in, delay_minutes, note)
- `appointments` (id, patient_id, doctor_id, date, start_time, end_time, status: booked|cancelled|completed|no_show, reason)
  - Unique constraint on (doctor_id, date, start_time) where status = 'booked', so double booking is impossible
- `notifications` (id, user_id, title, body, read, created_at)

## 7. Key flows
1. **Booking:** Patient picks doctor → date → sees free slots (schedule minus booked) → confirms → appointment saved and doctor notified.
2. **Doctor unavailable:** Doctor sets status "On leave" or "Delayed" → all booked patients for that date get an in-app and email notification → they can reschedule in one tap.
3. **Day of visit:** Patient opens the app and the doctor's status badge shows Available / Delayed / On leave before leaving home.

## 8. Build order (the workflow)

**Claude (planning/review) → Stitch (UI) → Antigravity (coding) → Claude (debug/review)**

Tip: save this file in your repo as `PROJECT.md`. Every Antigravity prompt below then stays short because the agent reads the context from it.

---

## Phase 0: Claude (spec and decisions)
Use this chat to refine anything in sections 1-7 before building. Ask Claude for:
- API route list and RLS policies
- Slot generation logic

## Phase 1: Stitch (design the screens)
Design one screen per prompt. Keep the same style line in all of them.

Style line to paste in each: *"Clean medical web app, white background, calming teal primary color, rounded cards, Inter font, mobile-first, accessible contrast."*

1. **Landing/search:** "Hospital doctor booking home page: search bar, department chips, list of doctor cards with photo, name, specialization and a live status badge (Available/Delayed/On leave). [style line]"
2. **Doctor profile and booking:** "Doctor profile page with today's status banner, about section, date picker strip, grid of time slots, and a Confirm Booking button. [style line]"
3. **My appointments (patient):** "Patient appointments page with Upcoming and Past tabs, each card showing doctor, date, time, status and Cancel/Reschedule buttons, plus a notification bell. [style line]"
4. **Doctor dashboard:** "Doctor dashboard: big status switcher (Available / Delayed with minutes / On leave), today's appointment timeline, Mark completed button. [style line]"
5. **Admin panel:** "Admin dashboard with sidebar (Doctors, Departments, Appointments), data tables with search, and Add Doctor form. [style line]"
6. **Login/Signup:** "Login and signup screen with role selection and a hospital illustration. [style line]"

Export each screen (code or screenshots) into a `/design` folder in your project for Antigravity to reference.

## Phase 2: Antigravity (build, one step at a time)
Run each prompt, test it, then move to the next. Don't skip testing.

**Step 1: Setup**
> Read PROJECT.md. Create a Next.js (App Router) + TypeScript + Tailwind project, install Supabase client, set up folder structure and env variables. Don't build features yet.

**Step 2: Database**
> Create Supabase SQL migration for the tables in PROJECT.md section 6, including the unique constraint to prevent double booking, and Row Level Security policies: patients see only their own appointments, doctors see their own, admins see everything.

**Step 3: Auth and roles**
> Implement Supabase auth (email + password), a profile row created on signup, role-based route protection with middleware, and login/signup pages matching /design/login.

**Step 4: Doctor listing**
> Build the home page and doctor listing with department filter and search, using /design as the visual reference. Seed 3 departments and 6 sample doctors.

**Step 5: Slots and booking**
> Build the doctor profile page: generate available slots from doctor_schedules minus booked appointments for the selected date, and a server action to book a slot that handles the double-booking error gracefully.

**Step 6: Patient appointments**
> Build My Appointments page with upcoming/past tabs, cancel and reschedule.

**Step 7: Doctor dashboard and live status**
> Build the doctor dashboard: schedule editor, today's status switcher writing to doctor_daily_status, today's appointment list with Mark completed. Show the live status badge on doctor cards and profiles using Supabase Realtime.

**Step 8: Notifications**
> When a doctor sets Delayed or On leave, or an appointment is cancelled, create notification rows for all affected patients and send an email via Resend. Add a notification bell with a realtime unread count.

**Step 9: Admin panel**
> Build the admin panel: add/edit doctors and departments, view and cancel any appointment.

**Step 10: Polish and deploy**
> Add loading and error states, empty states, mobile responsiveness, form validation, and deploy to Vercel with a README on setup.

## Phase 3: Claude (review and debug)
After each Antigravity step, paste any error or code here and ask for a review, especially for the RLS policies, the booking logic and the notification trigger.

---

## 9. MVP test checklist
- [ ] Two patients cannot book the same slot
- [ ] Patient can see the doctor's live status without refreshing
- [ ] Marking a doctor "On leave" notifies all booked patients
- [ ] A patient cannot see another patient's appointments
- [ ] Works well on a mobile screen

## 10. Suggested timeline
Setup and DB: 1 day · Auth and listing: 1-2 days · Booking: 2 days · Doctor dashboard and status: 2 days · Notifications: 1-2 days · Admin and polish: 2 days → about 2 weeks part-time.