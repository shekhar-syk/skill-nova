# SKILLNOVA — Online Learning & Career Development Platform

**Tagline:** *Learn Skills. Build Careers. Shape Your Future.*

SKILLNOVA is a production-oriented full-stack EdTech & Career Development platform featuring a 45-course dynamic catalog across 15 engineering tracks, public enquiry and admission workflows, Razorpay payment verification, a full LMS with timed multi-type quizzes and Question Bank, a server-side Gemini AI Learning Assistant, Gamification (XP, streaks, badges, leaderboards), interactive Career Roadmaps, Live Classes & Attendance, Placement & Internship Portal, Student Community Q&A, Centralized Notification Center, and Role-Based Student, Instructor, and Admin dashboards.

---

## Technology Stack

- **Frontend**: React.js, Vite, pure JavaScript (ES6+ `.jsx`/`.js`), Tailwind CSS v4, React Router DOM, Axios, Lucide React, Recharts, Framer Motion, jsPDF
- **Backend**: Node.js, Express.js (JavaScript), JWT Authentication + HTTP-only Refresh Cookies + CSRF origin checks, `bcryptjs`, Zod Validation, Helmet, Rate Limiting, Strict CORS
- **Database**: PostgreSQL (`pg` Pool with SSL for Aiven PostgreSQL) reconciled 1:1 with Prisma Schema & SQL Migrations (`backend/prisma/schema.prisma`, `backend/prisma/migrations/`). In `NODE_ENV=production`, PostgreSQL (`DATABASE_URL`) is strictly required (SQLite fallback is restricted to local development only).
- **AI & Integrations**: Google Gemini (`@google/genai`, server-side only via `/api/ai/*`), Razorpay Checkout + HMAC-SHA256 verification & webhooks, Cloudinary in-memory stream uploads, Resend transactional emails

---

## Project Structure

- `src/` — React frontend (`components/`, `layouts/`, `pages/`, `context/`, `services/`, `utils/`, `App.jsx`, `main.jsx`)
- `public/videos/` — Self-hosted looping homepage hero motion-graphic assets (`skillnova-hero.mp4`, `skillnova-hero.webm`, `skillnova-hero-poster.jpg`)
- `backend/` — Express REST API (`src/config/`, `src/db/`, `src/middleware/`, `src/routes/`, `src/services/`, `src/validators/`, `prisma/`, `tests/`)
- `server.ts` — Full-stack runtime server mounting Express REST API and Vite SPA on port `3000`
- `render.yaml` / `vercel.json` — Production deployment blueprints for Render backend and Vercel frontend

---

## Local Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env` and set `GEMINI_API_KEY` (to enable AI Learning Assistant), plus optional `DATABASE_URL`, `RAZORPAY_*`, `CLOUDINARY_*`, `RESEND_API_KEY`, `CORS_ALLOWED_ORIGINS`, and `ALLOW_SANDBOX_PAYMENTS`.
   - When `DATABASE_URL` is omitted locally (`NODE_ENV !== 'production'`), SKILLNOVA automatically initializes a persistent local SQLite database at `backend/data/skillnova.db` and seeds 15 categories, 45 courses, 8 career roadmaps, 8 badges, live sessions, placement opportunities, community Q&A, question bank items, and demo accounts.
3. **Start the full-stack application**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.
4. **Run automated backend integration tests**:
   ```bash
   npm test
   ```

---

## Demo Accounts (Sample Data)

| Role | Email | Password |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@skillnova.edu` | `SkillNova@Admin2026` |
| **ADMIN** | `admin@skillnova.edu` | `SkillNova@Admin2026` |
| **INSTRUCTOR** | `instructor@skillnova.edu` | `SkillNova@Mentor2026` |
| **STUDENT** | `student@skillnova.edu` | `SkillNova@Student2026` |

Verified sample certificate ID for public verification: `SN-CERT-2026-8842`.

---

## API Endpoint Reference

- **Health & Auth**: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`, `POST /api/auth/change-password`
- **Catalog & Courses**: `GET /api/categories`, `GET /api/courses` (supports `?free=true`, `?search=`, `?category=`, `?level=`, `?duration=`, `?sort=`), `GET /api/courses/:slugOrId`, `GET /api/public/cms`, `POST /api/courses`, `PUT /api/courses/:id`, `PATCH /api/courses/:id/status`, `DELETE /api/courses/:id`, `POST /api/courses/:id/modules`, `POST /api/modules/:moduleId/lessons`
- **Admissions, Enquiries & Payments**: `POST /api/enquiries`, `GET /api/enquiries`, `PATCH /api/enquiries/:id`, `POST /api/enquiries/:id/notes`, `POST /api/admissions`, `GET /api/admissions/track/:registrationId`, `GET /api/admissions/my`, `GET /api/admissions`, `PATCH /api/admissions/:id/status`, `POST /api/payments/create-order`, `POST /api/payments/verify`, `POST /api/payments/fail`, `POST /api/payments/webhook`, `GET /api/payments`
- **LMS, Analytics & Question Bank**: `GET /api/student/dashboard`, `GET /api/student/analytics`, `POST /api/enrollments/free`, `GET /api/learning/courses/:courseId`, `POST /api/progress/toggle`, `POST /api/quizzes/:quizId/submit`, `POST /api/quizzes`, `GET /api/question-bank`, `POST /api/question-bank`, `DELETE /api/question-bank/:id`, `POST /api/quizzes/:quizId/import-bank`, `POST /api/assignments/:assignmentId/submit`, `POST /api/assignments`, `PATCH /api/assignments/submissions/:submissionId/review`, `POST /api/certificates/generate`, `GET /api/certificates/my`, `GET /api/certificates/verify/:code`
- **AI Learning Assistant**: `GET /api/ai/conversations`, `GET /api/ai/conversations/:id`, `DELETE /api/ai/conversations/:id`, `POST /api/ai/chat`, `GET /api/admin/ai-analytics`
- **Gamification**: `GET /api/gamification/me`, `PUT /api/gamification/goal`, `GET /api/gamification/leaderboard`, `GET /api/admin/gamification-analytics`
- **Career Roadmaps**: `GET /api/roadmaps`, `GET /api/roadmaps/:slugOrId`, `POST /api/roadmaps/:id/select`, `POST /api/roadmaps/steps/:stepId/toggle`, `POST /api/roadmaps/:id/assess`, `POST /api/admin/roadmaps`, `POST /api/admin/roadmaps/:id/steps`, `DELETE /api/admin/roadmaps/:id`
- **Live Classes & Attendance**: `GET /api/live-sessions`, `GET /api/live-sessions/my-attendance`, `POST /api/live-sessions`, `PUT /api/live-sessions/:id`, `PATCH /api/live-sessions/:id/cancel`, `POST /api/live-sessions/:id/attend`, `GET /api/live-sessions/:id/attendance`, `POST /api/live-sessions/:id/attendance/mark`
- **Placements & Internships**: `GET /api/placements/companies`, `GET /api/placements/jobs`, `POST /api/placements/jobs/:id/apply`, `GET /api/placements/my-applications`, `POST /api/placements/recommend`, `POST /api/admin/placements/companies`, `POST /api/admin/placements/jobs`, `PATCH /api/admin/placements/jobs/:id/status`, `GET /api/admin/placements/applications`, `PATCH /api/admin/placements/applications/:id/status`
- **Community Q&A**: `GET /api/community/discussions`, `GET /api/community/discussions/:id`, `POST /api/community/discussions`, `POST /api/community/discussions/:id/replies`, `POST /api/community/likes`, `PATCH /api/community/replies/:replyId/accept`, `POST /api/community/report`, `GET /api/community/moderation`, `PATCH /api/community/moderate`
- **Notifications**: `GET /api/notifications/center`, `PATCH /api/notifications/center/:id/read`, `POST /api/notifications/center/read-all`, `GET /api/notifications/preferences`, `PUT /api/notifications/preferences`, `POST /api/admin/notifications/broadcast`
- **Instructor & Admin**: `GET /api/instructors/workspace`, `PATCH /api/instructors/courses/:id/live-info`, `GET /api/admin/overview`, `GET /api/admin/students`, `PATCH /api/admin/users/:id/active`, `GET /api/admin/instructors`, `POST /api/admin/instructors`, `PATCH /api/admin/instructors/:id/assign-course`, `PUT /api/admin/cms/settings`, `POST /api/admin/cms/testimonials`, `POST /api/admin/cms/faqs`, `GET /api/analytics/export/:type` (`payments`, `admissions`, `courses`, `student-performance`, `course-completion`), `POST /api/uploads`

---

## Deployment Instructions

### 1. Aiven PostgreSQL Setup
1. Provision a PostgreSQL service in **Aiven Console** and copy the Service URI (`postgres://...?sslmode=require`).
2. Apply Prisma migrations & seed:
   ```bash
   cd backend
   npx prisma migrate deploy
   node src/db/seed.js
   ```

### 2. Render Backend Deployment
1. Connect the repository using the included `render.yaml` blueprint or create a **Web Service** on Render.
2. **Build Command**: `npm install && cd backend && npx prisma generate` | **Start Command**: `cd backend && npx prisma migrate deploy && node src/db/seed.js && node src/server.js`.
3. Configure Production Environment Variables: `NODE_ENV=production`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `ALLOW_SANDBOX_PAYMENTS=false`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`.
4. Set Health Check Path to `/api/health`.

### 3. Vercel Frontend Deployment
1. Import repository in **Vercel** (`Framework Preset: Vite`, Build Command `npm run build`, Output Directory `dist`).
2. Set `VITE_API_BASE_URL=https://your-render-service.onrender.com/api` and `VITE_RAZORPAY_KEY_ID`.
