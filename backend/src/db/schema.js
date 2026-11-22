import { ensureColumn, execRaw, isPostgres } from './index.js';

export async function initializeSchema() {
  const idCol = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const boolTrue = isPostgres ? 'BOOLEAN NOT NULL DEFAULT TRUE' : 'INTEGER NOT NULL DEFAULT 1';
  const boolFalse = isPostgres ? 'BOOLEAN NOT NULL DEFAULT FALSE' : 'INTEGER NOT NULL DEFAULT 0';
  const tsDefault = isPostgres ? 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' : "TEXT NOT NULL DEFAULT (datetime('now'))";
  const tsNullable = isPostgres ? 'TIMESTAMP' : 'TEXT';

  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id ${idCol},
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT')),
      phone TEXT,
      avatar_url TEXT,
      is_active ${boolTrue},
      reset_token TEXT,
      reset_token_expires ${tsNullable},
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id ${idCol},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      whatsapp_number TEXT,
      college_name TEXT,
      department TEXT,
      year_of_study TEXT,
      state TEXT,
      education_level TEXT,
      bio TEXT,
      github_url TEXT,
      linkedin_url TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS instructor_profiles (
      id ${idCol},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      headline TEXT NOT NULL,
      expertise TEXT NOT NULL DEFAULT '[]',
      years_experience INTEGER NOT NULL DEFAULT 5,
      company_background TEXT,
      bio TEXT,
      linkedin_url TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS course_categories (
      id ${idCol},
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      icon_name TEXT NOT NULL DEFAULT 'Code2',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS courses (
      id ${idCol},
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_summary TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES course_categories(id) ON DELETE RESTRICT,
      instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      thumbnail_url TEXT NOT NULL,
      technologies TEXT NOT NULL DEFAULT '[]',
      skill_level TEXT NOT NULL DEFAULT 'Intermediate' CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
      duration TEXT NOT NULL,
      duration_weeks INTEGER NOT NULL DEFAULT 12,
      course_fee INTEGER NOT NULL,
      advance_amount INTEGER NOT NULL,
      full_amount INTEGER NOT NULL,
      learning_outcomes TEXT NOT NULL DEFAULT '[]',
      internship_available ${boolTrue},
      internship_details TEXT,
      faqs TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
      featured ${boolFalse},
      rating_avg REAL NOT NULL DEFAULT 4.8,
      enrolled_count INTEGER NOT NULL DEFAULT 0,
      live_session_info TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS course_modules (
      id ${idCol},
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      module_order INTEGER NOT NULL DEFAULT 1,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id ${idCol},
      module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      lesson_type TEXT NOT NULL DEFAULT 'VIDEO' CHECK (lesson_type IN ('VIDEO', 'READING', 'LAB', 'LIVE')),
      video_url TEXT,
      content TEXT NOT NULL,
      resource_url TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      lesson_order INTEGER NOT NULL DEFAULT 1,
      is_free_preview ${boolFalse},
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS admissions (
      id ${idCol},
      registration_id TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      college_name TEXT NOT NULL,
      department TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      state TEXT NOT NULL,
      learning_preference TEXT NOT NULL DEFAULT 'Live Online Cohort',
      message TEXT,
      payment_option TEXT NOT NULL DEFAULT 'ADVANCE' CHECK (payment_option IN ('ADVANCE', 'FULL')),
      total_fee INTEGER NOT NULL,
      amount_paid INTEGER NOT NULL DEFAULT 0,
      remaining_balance INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAYMENT_PENDING' CHECK (status IN ('PENDING', 'PAYMENT_PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'APPROVED', 'REJECTED')),
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_notes TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS payments (
      id ${idCol},
      admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      receipt_number TEXT NOT NULL UNIQUE,
      payment_type TEXT NOT NULL CHECK (payment_type IN ('ADVANCE', 'FULL', 'BALANCE')),
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      razorpay_order_id TEXT NOT NULL UNIQUE,
      razorpay_payment_id TEXT UNIQUE,
      razorpay_signature TEXT,
      status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'SUCCESS', 'FAILED', 'REFUNDED')),
      failure_reason TEXT,
      gateway_mode TEXT NOT NULL DEFAULT 'RAZORPAY',
      paid_at ${tsNullable},
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'SUSPENDED')),
      progress_percent INTEGER NOT NULL DEFAULT 0,
      learning_hours REAL NOT NULL DEFAULT 0,
      enrolled_at ${tsDefault},
      completed_at ${tsNullable},
      UNIQUE (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      is_completed ${boolTrue},
      completed_at ${tsDefault},
      UNIQUE (user_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id ${idCol},
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      passing_score INTEGER NOT NULL DEFAULT 60,
      time_limit_minutes INTEGER NOT NULL DEFAULT 15,
      randomize_questions ${boolFalse},
      allow_negative_marking ${boolFalse},
      negative_marks_per_wrong REAL NOT NULL DEFAULT 0.25,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS questions (
      id ${idCol},
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'MCQ' CHECK (question_type IN ('MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER')),
      options TEXT NOT NULL DEFAULT '[]',
      correct_option_index INTEGER NOT NULL DEFAULT 0,
      correct_answers TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
      skill_tag TEXT NOT NULL DEFAULT 'Core Engineering',
      marks REAL NOT NULL DEFAULT 1,
      explanation TEXT,
      question_order INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id ${idCol},
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      answers TEXT NOT NULL,
      score INTEGER NOT NULL,
      raw_score REAL NOT NULL DEFAULT 0,
      negative_deducted REAL NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      passed ${boolFalse},
      skill_breakdown TEXT NOT NULL DEFAULT '{}',
      time_taken_seconds INTEGER NOT NULL DEFAULT 0,
      attempted_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      id ${idCol},
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'MCQ' CHECK (question_type IN ('MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER')),
      options TEXT NOT NULL DEFAULT '[]',
      correct_option_index INTEGER NOT NULL DEFAULT 0,
      correct_answers TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
      skill_tag TEXT NOT NULL DEFAULT 'Core Engineering',
      marks REAL NOT NULL DEFAULT 1,
      explanation TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id ${idCol},
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      max_score INTEGER NOT NULL DEFAULT 100,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id ${idCol},
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submission_url TEXT,
      submission_notes TEXT,
      file_name TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'REVIEWED', 'NEEDS_REVISION')),
      score INTEGER,
      instructor_feedback TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      submitted_at ${tsDefault},
      reviewed_at ${tsNullable},
      UNIQUE (assignment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id ${idCol},
      certificate_code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      course_title TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT 'Distinction',
      issued_at ${tsDefault},
      UNIQUE (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id ${idCol},
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      course_interest TEXT NOT NULL,
      learning_preference TEXT NOT NULL DEFAULT 'Live Online',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'FOLLOW_UP', 'CONVERTED', 'CLOSED')),
      assigned_counsellor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      follow_up_date TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS enquiry_notes (
      id ${idCol},
      enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL,
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id ${idCol},
      student_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      course_title TEXT NOT NULL,
      quote TEXT NOT NULL,
      outcome_metric TEXT NOT NULL,
      is_published ${boolTrue},
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id ${idCol},
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published ${boolTrue},
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      is_read ${boolFalse},
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS user_notifications (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
      action_url TEXT,
      is_read ${boolFalse},
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id ${idCol},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      announcements ${boolTrue},
      live_reminders ${boolTrue},
      assignment_deadlines ${boolTrue},
      quiz_results ${boolTrue},
      mentor_feedback ${boolTrue},
      payment_updates ${boolTrue},
      placement_updates ${boolTrue},
      email_digest ${boolTrue},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at ${tsDefault},
      revoked ${boolFalse},
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id ${idCol},
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at ${tsDefault}
    );

    -- AI LEARNING ASSISTANT
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'CONCEPT',
      language TEXT NOT NULL DEFAULT 'General',
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id ${idCol},
      conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'CONCEPT',
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at ${tsDefault}
    );

    -- GAMIFICATION SYSTEM
    CREATE TABLE IF NOT EXISTS student_points (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('LESSON', 'MODULE', 'QUIZ_PASS', 'COURSE_COMPLETE', 'STREAK_BONUS', 'ROADMAP_STEP', 'COMMUNITY_HELP')),
      event_key TEXT NOT NULL,
      points INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at ${tsDefault},
      UNIQUE (user_id, event_key)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id ${idCol},
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_name TEXT NOT NULL DEFAULT 'Award',
      xp_reward INTEGER NOT NULL DEFAULT 25,
      criteria_type TEXT NOT NULL,
      criteria_value INTEGER NOT NULL DEFAULT 1,
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS student_achievements (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      unlocked_at ${tsDefault},
      UNIQUE (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS learning_streaks (
      id ${idCol},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_activity_date TEXT,
      weekly_goal_minutes INTEGER NOT NULL DEFAULT 180,
      weekly_minutes_done INTEGER NOT NULL DEFAULT 0,
      week_start_date TEXT,
      updated_at ${tsDefault}
    );

    -- CAREER ROADMAP SYSTEM
    CREATE TABLE IF NOT EXISTS career_roadmaps (
      id ${idCol},
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      role_summary TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'Intermediate',
      estimated_weeks INTEGER NOT NULL DEFAULT 16,
      skill_categories TEXT NOT NULL DEFAULT '[]',
      practical_projects TEXT NOT NULL DEFAULT '[]',
      interview_prep TEXT NOT NULL DEFAULT '[]',
      assessment_questions TEXT NOT NULL DEFAULT '[]',
      is_published ${boolTrue},
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS roadmap_steps (
      id ${idCol},
      roadmap_id INTEGER NOT NULL REFERENCES career_roadmaps(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL DEFAULT 1,
      skill_category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      recommended_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      estimated_hours INTEGER NOT NULL DEFAULT 12,
      project_task TEXT,
      created_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS student_roadmaps (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roadmap_id INTEGER NOT NULL REFERENCES career_roadmaps(id) ON DELETE CASCADE,
      completed_step_ids TEXT NOT NULL DEFAULT '[]',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      skill_assessment_score INTEGER,
      skill_assessment_result TEXT,
      is_primary ${boolTrue},
      selected_at ${tsDefault},
      updated_at ${tsDefault},
      UNIQUE (user_id, roadmap_id)
    );

    -- LIVE CLASS MANAGEMENT & ATTENDANCE
    CREATE TABLE IF NOT EXISTS live_sessions (
      id ${idCol},
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      meeting_url TEXT NOT NULL,
      meeting_platform TEXT NOT NULL DEFAULT 'Google Meet',
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED')),
      cancel_reason TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id ${idCol},
      session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'ABSENT')),
      joined_at ${tsDefault},
      notes TEXT,
      UNIQUE (session_id, user_id)
    );

    -- PLACEMENT & INTERNSHIP PORTAL
    CREATE TABLE IF NOT EXISTS companies (
      id ${idCol},
      name TEXT NOT NULL UNIQUE,
      industry TEXT NOT NULL,
      location TEXT NOT NULL,
      website_url TEXT,
      description TEXT NOT NULL,
      logo_url TEXT,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS job_opportunities (
      id ${idCol},
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      opportunity_type TEXT NOT NULL DEFAULT 'JOB' CHECK (opportunity_type IN ('JOB', 'INTERNSHIP')),
      location TEXT NOT NULL,
      work_mode TEXT NOT NULL DEFAULT 'Hybrid',
      stipend_or_ctc TEXT NOT NULL,
      eligibility TEXT NOT NULL,
      required_skills TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL,
      application_deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS job_applications (
      id ${idCol},
      opportunity_id INTEGER NOT NULL REFERENCES job_opportunities(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resume_url TEXT NOT NULL,
      resume_filename TEXT,
      cover_note TEXT,
      portfolio_url TEXT,
      status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED')),
      admin_remarks TEXT,
      recommended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recommendation_note TEXT,
      applied_at ${tsDefault},
      updated_at ${tsDefault},
      UNIQUE (opportunity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS student_recommendations (
      id ${idCol},
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES job_opportunities(id) ON DELETE SET NULL,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      endorsement_note TEXT NOT NULL,
      created_at ${tsDefault}
    );

    -- STUDENT COMMUNITY FORUMS
    CREATE TABLE IF NOT EXISTS discussions (
      id ${idCol},
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      is_pinned ${boolFalse},
      is_locked ${boolFalse},
      is_hidden ${boolFalse},
      is_reported ${boolFalse},
      report_reason TEXT,
      likes_count INTEGER NOT NULL DEFAULT 0,
      replies_count INTEGER NOT NULL DEFAULT 0,
      accepted_reply_id INTEGER,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS discussion_replies (
      id ${idCol},
      discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
      parent_reply_id INTEGER REFERENCES discussion_replies(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_accepted ${boolFalse},
      is_hidden ${boolFalse},
      is_reported ${boolFalse},
      report_reason TEXT,
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at ${tsDefault},
      updated_at ${tsDefault}
    );

    CREATE TABLE IF NOT EXISTS discussion_likes (
      id ${idCol},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('DISCUSSION', 'REPLY')),
      target_id INTEGER NOT NULL,
      created_at ${tsDefault},
      UNIQUE (user_id, target_type, target_id)
    );

    CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
    CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
    CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_email ON admissions(email);
    CREATE INDEX IF NOT EXISTS idx_payments_admission ON payments(admission_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
    CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
    CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_points_user ON student_points(user_id);
    CREATE INDEX IF NOT EXISTS idx_points_created ON student_points(created_at);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_course ON live_sessions(course_id);
    CREATE INDEX IF NOT EXISTS idx_job_apps_user ON job_applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_discussions_course ON discussions(course_id);
    CREATE INDEX IF NOT EXISTS idx_user_notif_user ON user_notifications(user_id);
  `;

  await execRaw(ddl);

  // Non-destructive column upgrades for pre-existing tables
  await ensureColumn('quizzes', 'randomize_questions', 'BOOLEAN NOT NULL DEFAULT FALSE', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('quizzes', 'allow_negative_marking', 'BOOLEAN NOT NULL DEFAULT FALSE', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('quizzes', 'negative_marks_per_wrong', 'REAL NOT NULL DEFAULT 0.25', 'REAL NOT NULL DEFAULT 0.25');

  await ensureColumn('questions', 'question_type', "TEXT NOT NULL DEFAULT 'MCQ'", "TEXT NOT NULL DEFAULT 'MCQ'");
  await ensureColumn('questions', 'correct_answers', "TEXT NOT NULL DEFAULT '[]'", "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('questions', 'difficulty', "TEXT NOT NULL DEFAULT 'Medium'", "TEXT NOT NULL DEFAULT 'Medium'");
  await ensureColumn('questions', 'skill_tag', "TEXT NOT NULL DEFAULT 'Core Engineering'", "TEXT NOT NULL DEFAULT 'Core Engineering'");
  await ensureColumn('questions', 'marks', 'REAL NOT NULL DEFAULT 1', 'REAL NOT NULL DEFAULT 1');

  await ensureColumn('quiz_attempts', 'raw_score', 'REAL NOT NULL DEFAULT 0', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('quiz_attempts', 'negative_deducted', 'REAL NOT NULL DEFAULT 0', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('quiz_attempts', 'skill_breakdown', "TEXT NOT NULL DEFAULT '{}'", "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn('quiz_attempts', 'time_taken_seconds', 'INTEGER NOT NULL DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0');

  await ensureColumn('ai_messages', 'model_id', "TEXT DEFAULT 'gemini-4-hydrogen'", "TEXT DEFAULT 'gemini-4-hydrogen'");
  await ensureColumn('ai_messages', 'grounding_sources', 'TEXT', 'TEXT');
}
