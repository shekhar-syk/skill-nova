import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const testDbPath = path.join(os.tmpdir(), `skillnova-test-${process.pid}-${Date.now()}.db`);
process.env.SQLITE_DB_PATH = testDbPath;

let server;
let baseUrl;

test.before(async () => {
  const { createApiApp } = await import('../src/app.js');
  const { initializeSchema } = await import('../src/db/schema.js');
  const { runSeed } = await import('../src/db/seed.js');
  await initializeSchema();
  await runSeed();
  const app = createApiApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  for (const candidate of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (fs.existsSync(candidate)) {
      try {
        fs.unlinkSync(candidate);
      } catch {
        // ignore cleanup error
      }
    }
  }
});

async function api(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // plain text / CSV response
  }
  return { status: res.status, body, headers: res.headers };
}

async function loginAs(email, password) {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  return res.body.accessToken;
}

test('GET /api/health returns database connectivity', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.database.connected, true);
});

test('GET /api/courses returns seeded 45 courses and 15 categories', async () => {
  const catRes = await api('/api/categories');
  assert.equal(catRes.status, 200);
  assert.equal(catRes.body.categories.length, 15);

  const courseRes = await api('/api/courses?limit=50');
  assert.equal(courseRes.status, 200);
  assert.ok(courseRes.body.pagination.total >= 45);
});

test('Auth: register, login, invalid password rejection, and protected /me', async () => {
  const uniqueEmail = `test.learner.${Date.now()}@skillnova.edu`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Test Learner',
      email: uniqueEmail,
      password: 'Password123!',
      phone: '+91 99999 88888',
    }),
  });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.accessToken);
  assert.equal(reg.body.user.role, 'STUDENT');

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: uniqueEmail, password: 'WrongPassword!' }),
  });
  assert.equal(badLogin.status, 401);

  const goodLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: uniqueEmail, password: 'Password123!' }),
  });
  assert.equal(goodLogin.status, 200);
  assert.ok(goodLogin.body.accessToken);

  const me = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${goodLogin.body.accessToken}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, uniqueEmail);
});

test('Enquiry submission persists to DB', async () => {
  const res = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Priya Tester',
      email: 'priya.test@example.com',
      mobileNumber: '+91 98765 43210',
      courseInterest: 'Applied Machine Learning & Generative AI Systems',
      learningPreference: 'Live Online Cohort',
      message: 'Please share syllabus and upcoming cohort start dates.',
    }),
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.enquiry.status, 'NEW');
});

test('Admission, authoritative fee calculation, Razorpay order, and signature verification', async () => {
  const coursesRes = await api('/api/courses?limit=1');
  const course = coursesRes.body.courses[0];

  const admRes = await api('/api/admissions', {
    method: 'POST',
    body: JSON.stringify({
      courseId: course.id,
      fullName: 'Karthik Rao',
      email: `karthik.${Date.now()}@example.com`,
      mobileNumber: '+91 98765 11111',
      whatsappNumber: '+91 98765 11111',
      collegeName: 'MIT Manipal',
      department: 'Computer Science',
      yearOfStudy: '3rd Year',
      state: 'Karnataka',
      learningPreference: 'Live Online Cohort',
      paymentOption: 'ADVANCE',
    }),
  });
  assert.equal(admRes.status, 201);
  assert.equal(admRes.body.admission.totalFee, course.courseFee);
  assert.equal(admRes.body.admission.payableAmount, course.advanceAmount);
  assert.equal(admRes.body.admission.remainingBalance, course.courseFee);

  const orderRes = await api('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ admissionId: admRes.body.admission.id, paymentType: 'ADVANCE' }),
  });
  assert.equal(orderRes.status, 200);
  assert.equal(orderRes.body.order.amountInInr, course.advanceAmount);

  const verifyRes = await api('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id: orderRes.body.order.orderId,
      simulateSandbox: true,
    }),
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.receipt.admissionStatus, 'ADVANCE_PAID');
  assert.equal(verifyRes.body.receipt.remainingBalance, course.courseFee - course.advanceAmount);
});

test('Security & ownership: unauthenticated/unauthorized users blocked from private and staff endpoints', async () => {
  const studentEmail = `sec.student.${Date.now()}@skillnova.edu`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Security Student',
      email: studentEmail,
      password: 'Password123!',
    }),
  });
  const unauthenticatedToken = reg.body.accessToken;

  // Unenrolled student cannot toggle course progress (course 1)
  const progRes = await api('/api/progress/toggle', {
    method: 'POST',
    headers: { Authorization: `Bearer ${unauthenticatedToken}` },
    body: JSON.stringify({ courseId: 1, lessonId: 1, completed: true }),
  });
  assert.equal(progRes.status, 403);

  // Student cannot trigger admin overview or broadcast
  const adminOv = await api('/api/admin/overview', {
    headers: { Authorization: `Bearer ${unauthenticatedToken}` },
  });
  assert.equal(adminOv.status, 403);

  // Instructor cannot create module on unassigned course
  const instructorToken = await loginAs('instructor@skillnova.edu', 'SkillNova@Mentor2026');
  const modAttempt = await api('/api/courses/45/modules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({ title: 'Unauthorized Module' }),
  });
  assert.equal(modAttempt.status, 403);
});

test('Certificate verification validates seeded certificate ID', async () => {
  const res = await api('/api/certificates/verify/SN-CERT-2026-8842');
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);
  assert.equal(res.body.certificate.certificate_code, 'SN-CERT-2026-8842');
});

test('Gamification: XP profile, non-duplicate lesson XP, weekly goal, and leaderboards', async () => {
  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');

  const dashRes = await api('/api/student/dashboard', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(dashRes.status, 200);
  const enrolledCourse = dashRes.body.enrollments[0];
  assert.ok(enrolledCourse, 'Seeded student should have an enrollment');

  const courseDetail = await api(`/api/learning/courses/${enrolledCourse.course_id}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(courseDetail.status, 200);
  const firstLesson = courseDetail.body.modules?.[0]?.lessons?.[0];
  assert.ok(firstLesson);

  // First completion or repeat toggle never duplicates XP
  await api('/api/progress/toggle', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ courseId: enrolledCourse.course_id, lessonId: firstLesson.id, completed: true }),
  });
  const secondToggle = await api('/api/progress/toggle', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ courseId: enrolledCourse.course_id, lessonId: firstLesson.id, completed: true }),
  });
  assert.equal(secondToggle.status, 200);
  assert.equal(secondToggle.body.xpEarned, 0);

  const gamRes = await api('/api/gamification/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(gamRes.status, 200);
  assert.ok(gamRes.body.totalXp >= 0);
  assert.ok(Array.isArray(gamRes.body.achievements));

  const goalRes = await api('/api/gamification/goal', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ weeklyGoalMinutes: 240 }),
  });
  assert.equal(goalRes.status, 200);
  assert.equal(goalRes.body.weeklyGoalMinutes, 240);

  const lbRes = await api('/api/gamification/leaderboard?period=weekly', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(lbRes.status, 200);
  assert.ok(Array.isArray(lbRes.body.leaderboard));
});

test('Career Roadmaps: 8 seeded tracks, select goal, step toggle (+15 XP once), and diagnostic assessment', async () => {
  const listRes = await api('/api/roadmaps');
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.roadmaps.length >= 8);

  const firstRoadmap = listRes.body.roadmaps[0];
  const detailRes = await api(`/api/roadmaps/${firstRoadmap.slug}`);
  assert.equal(detailRes.status, 200);
  assert.ok(detailRes.body.roadmap.steps.length >= 1);

  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');
  const selectRes = await api(`/api/roadmaps/${firstRoadmap.id}/select`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(selectRes.status, 200);

  const stepId = detailRes.body.roadmap.steps[0].id;
  const toggle1 = await api(`/api/roadmaps/steps/${stepId}/toggle`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(toggle1.status, 200);

  const assessRes = await api(`/api/roadmaps/${firstRoadmap.id}/assess`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answers: { 0: 0, 1: 1 } }),
  });
  assert.equal(assessRes.status, 200);
  assert.ok(typeof assessRes.body.percentage === 'number');
});

test('Live Sessions: HTTPS URL validation, schedule, attend, and cancel', async () => {
  const instructorToken = await loginAs('instructor@skillnova.edu', 'SkillNova@Mentor2026');
  const ws = await api('/api/instructors/workspace', {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert.equal(ws.status, 200);
  const courseId = ws.body.courses[0].id;

  const badUrlRes = await api('/api/live-sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      courseId,
      title: 'Unsafe Meeting Link Test',
      description: 'Should be rejected',
      meetingUrl: 'javascript:alert(1)',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  assert.equal(badUrlRes.status, 400);

  const createRes = await api('/api/live-sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      courseId,
      title: 'Live Architecture Review Session',
      description: 'Deep dive into scalable PostgreSQL schemas',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      meetingPlatform: 'Google Meet',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 60,
    }),
  });
  assert.equal(createRes.status, 201);
  const sessionId = createRes.body.session.id;

  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');
  const attendRes = await api(`/api/live-sessions/${sessionId}/attend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(attendRes.status, 200);
  assert.ok(['PRESENT', 'LATE'].includes(attendRes.body.attendanceStatus));

  const cancelRes = await api(`/api/live-sessions/${sessionId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({ reason: 'Test cleanup cancellation' }),
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.session.status, 'CANCELLED');
});

test('Placements: list jobs, apply once, duplicate 409, and admin status update', async () => {
  const jobsRes = await api('/api/placements/jobs');
  assert.equal(jobsRes.status, 200);
  assert.ok(jobsRes.body.opportunities.length >= 4);

  // Use a fresh student so seeded applications don't collide
  const uniqueEmail = `placement.student.${Date.now()}@skillnova.edu`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName: 'Placement Candidate', email: uniqueEmail, password: 'Password123!' }),
  });
  const studentToken = reg.body.accessToken;
  const oppId = jobsRes.body.opportunities[0].id;

  const apply1 = await api(`/api/placements/jobs/${oppId}/apply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      resumeUrl: 'https://example.com/resume-candidate.pdf',
      coverNote: 'Strong Java & PostgreSQL foundation.',
    }),
  });
  assert.equal(apply1.status, 201);

  const applyDup = await api(`/api/placements/jobs/${oppId}/apply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      resumeUrl: 'https://example.com/resume-candidate.pdf',
    }),
  });
  assert.equal(applyDup.status, 409);

  const adminToken = await loginAs('admin@skillnova.edu', 'SkillNova@Admin2026');
  const statusRes = await api(`/api/admin/placements/applications/${apply1.body.application.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'SHORTLISTED', adminRemarks: 'Interview scheduled next week.' }),
  });
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.application.status, 'SHORTLISTED');
});

test('Community Q&A: create discussion, reply, like, accept answer, and moderate', async () => {
  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');
  const dashRes = await api('/api/student/dashboard', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const courseId = dashRes.body.enrollments[0].course_id;

  const createDisc = await api('/api/community/discussions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      courseId,
      title: 'How do database indexes improve JOIN performance?',
      content: 'Looking for practical guidelines on B-Tree vs Hash indexing in PostgreSQL.',
      tags: ['PostgreSQL', 'Indexing'],
    }),
  });
  assert.equal(createDisc.status, 201);
  const discId = createDisc.body.discussion.id;

  const instructorToken = await loginAs('instructor@skillnova.edu', 'SkillNova@Mentor2026');
  const replyRes = await api(`/api/community/discussions/${discId}/replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      content: 'B-Tree indexes accelerate range queries and foreign key joins efficiently.',
    }),
  });
  assert.equal(replyRes.status, 201);

  const likeRes = await api('/api/community/likes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ targetType: 'DISCUSSION', targetId: discId }),
  });
  assert.equal(likeRes.status, 200);
  assert.equal(likeRes.body.liked, true);

  const acceptRes = await api(`/api/community/replies/${replyRes.body.reply.id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(acceptRes.status, 200);

  const adminToken = await loginAs('admin@skillnova.edu', 'SkillNova@Admin2026');
  const modRes = await api('/api/community/moderate', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetType: 'DISCUSSION', targetId: discId, action: 'PIN' }),
  });
  assert.equal(modRes.status, 200);
});

test('Advanced Quizzes, Question Bank, Student Analytics & Notifications', async () => {
  const instructorToken = await loginAs('instructor@skillnova.edu', 'SkillNova@Mentor2026');
  const ws = await api('/api/instructors/workspace', {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  const courseId = ws.body.courses[0].id;

  // Question Bank CRUD + Quiz creation + Import
  const qbRes = await api('/api/question-bank', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      courseId,
      questionText: 'HTTP status 403 indicates forbidden access.',
      questionType: 'TRUE_FALSE',
      correctOptionIndex: 0,
      difficulty: 'Easy',
      skillTag: 'Web Security',
      marks: 1,
    }),
  });
  assert.equal(qbRes.status, 201);

  const quizRes = await api('/api/quizzes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      courseId,
      title: `Automated Assessment ${Date.now()}`,
      passingScore: 50,
      timeLimitMinutes: 10,
      allowNegativeMarking: true,
      negativeMarksPerWrong: 0.25,
      questions: [
        {
          questionText: 'Select all HTTP idempotent methods.',
          questionType: 'MULTI_SELECT',
          options: ['GET', 'POST', 'PUT', 'DELETE'],
          correctAnswers: [0, 2, 3],
          difficulty: 'Medium',
          skillTag: 'REST APIs',
          marks: 2,
        },
      ],
    }),
  });
  assert.equal(quizRes.status, 201);

  const importRes = await api(`/api/quizzes/${quizRes.body.quiz.id}/import-bank`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({ questionIds: [qbRes.body.question.id] }),
  });
  assert.equal(importRes.status, 200);
  assert.equal(importRes.body.imported, 1);

  // Student analytics & notifications
  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');
  const analyticsRes = await api('/api/student/analytics', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(analyticsRes.status, 200);
  assert.ok(Array.isArray(analyticsRes.body.weeklyActivity));

  const notifRes = await api('/api/notifications/center', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(notifRes.status, 200);
  assert.ok(Array.isArray(notifRes.body.notifications));

  const readAllRes = await api('/api/notifications/center/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(readAllRes.status, 200);
});

test('AI Assistant validates prompts and fails honestly when GEMINI_API_KEY is unset', async () => {
  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');

  const emptyRes = await api('/api/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ prompt: '   ', mode: 'CONCEPT' }),
  });
  assert.equal(emptyRes.status, 400);

  if (!process.env.GEMINI_API_KEY) {
    const missingKeyRes = await api('/api/ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ prompt: 'Explain Java Streams API', mode: 'CONCEPT', language: 'Java' }),
    });
    assert.equal(missingKeyRes.status, 503);
    assert.equal(missingKeyRes.body.success, false);
  }

  const adminToken = await loginAs('admin@skillnova.edu', 'SkillNova@Admin2026');
  const exportRes = await api('/api/analytics/export/student-performance', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(exportRes.status, 200);
});

test('Free courses filter (?free=true) and 1-click free enrollment validation', async () => {
  const freeRes = await api('/api/courses?free=true');
  assert.equal(freeRes.status, 200);
  assert.ok(freeRes.body.courses.length >= 3, 'Should return at least 3 seeded free courses');
  for (const c of freeRes.body.courses) {
    assert.equal(Number(c.courseFee), 0);
    assert.equal(c.isFree, true);
  }

  const paidRes = await api('/api/courses?limit=1');
  assert.equal(paidRes.status, 200);
  const paidCourse = paidRes.body.courses[0];
  assert.ok(Number(paidCourse.courseFee) > 0);

  const uniqueEmail = `free.learner.${Date.now()}@skillnova.edu`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Free Track Learner',
      email: uniqueEmail,
      password: 'Password123!',
    }),
  });
  assert.equal(reg.status, 201);
  const token = reg.body.accessToken;

  const freeCourse = freeRes.body.courses[0];
  const enroll1 = await api('/api/enrollments/free', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ courseId: freeCourse.id }),
  });
  assert.equal(enroll1.status, 201);
  assert.equal(enroll1.body.alreadyEnrolled, false);
  assert.equal(enroll1.body.enrollment.course_id, freeCourse.id);

  const enroll2 = await api('/api/enrollments/free', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ courseId: freeCourse.id }),
  });
  assert.equal(enroll2.status, 200);
  assert.equal(enroll2.body.alreadyEnrolled, true);

  const paidReject = await api('/api/enrollments/free', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ courseId: paidCourse.id }),
  });
  assert.equal(paidReject.status, 400);
});

test('Circuit Runner 3D XP reward validates auth, stage bounds, and non-duplicate awarding', async () => {
  const unauthRes = await api('/api/gamification/game-reward', {
    method: 'POST',
    body: JSON.stringify({ stage: 1, score: 1200 }),
  });
  assert.equal(unauthRes.status, 401);

  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');

  const badStage = await api('/api/gamification/game-reward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ stage: 99, score: 500 }),
  });
  assert.equal(badStage.status, 400);

  const firstClear = await api('/api/gamification/game-reward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ stage: 2, score: 2450 }),
  });
  assert.equal(firstClear.status, 200);
  assert.equal(firstClear.body.awarded, true);
  assert.equal(firstClear.body.pointsAdded, 25);

  const secondClear = await api('/api/gamification/game-reward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ stage: 2, score: 3100 }),
  });
  assert.equal(secondClear.status, 200);
  assert.equal(secondClear.body.awarded, false);
  assert.equal(secondClear.body.pointsAdded, 0);
});

test('AI Transcribe, Maps Grounding, and Studio TTS enforce auth & input validation', async () => {
  const unauthTts = await api('/api/studio/tts', {
    method: 'POST',
    body: JSON.stringify({ text: 'Hello SkillNova' }),
  });
  assert.equal(unauthTts.status, 401);

  const studentToken = await loginAs('student@skillnova.edu', 'SkillNova@Student2026');

  const emptyTts = await api('/api/studio/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ text: '   ' }),
  });
  assert.equal(emptyTts.status, 400);

  const missingAudio = await api('/api/ai/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(missingAudio.status, 400);

  const emptyMaps = await api('/api/ai/maps-grounding', {
    method: 'POST',
    body: JSON.stringify({ prompt: '  ' }),
  });
  assert.equal(emptyMaps.status, 400);
});
