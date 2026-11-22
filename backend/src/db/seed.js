import bcrypt from 'bcryptjs';
import { query, queryOne } from './index.js';
import { CATEGORIES, COURSES_SEED, FAQS_SEED, TESTIMONIALS_SEED } from './seedData.js';
import { runUpgradeSeed } from './seedUpgrade.js';

export async function runSeed() {
  const existingCourses = await queryOne('SELECT COUNT(*) AS count FROM courses');
  if (Number(existingCourses?.count || 0) >= 45) {
    await runUpgradeSeed();
    return { seeded: false, message: 'Database already seeded with 45+ courses (upgrade records verified).' };
  }

  const adminPassHash = await bcrypt.hash('SkillNova@Admin2026', 10);
  const mentorPassHash = await bcrypt.hash('SkillNova@Mentor2026', 10);
  const studentPassHash = await bcrypt.hash('SkillNova@Student2026', 10);

  // 1. Seed Users across all 4 RBAC roles
  const usersSeed = [
    {
      fullName: 'Vikramaditya Rao (Sample Super Admin)',
      email: 'superadmin@skillnova.edu',
      passwordHash: adminPassHash,
      role: 'SUPER_ADMIN',
      phone: '+91 98001 00001',
    },
    {
      fullName: 'Nandini Iyer (Sample Admin)',
      email: 'admin@skillnova.edu',
      passwordHash: adminPassHash,
      role: 'ADMIN',
      phone: '+91 98001 00002',
    },
    {
      fullName: 'Dr. Vikram Aditya',
      email: 'instructor@skillnova.edu',
      passwordHash: mentorPassHash,
      role: 'INSTRUCTOR',
      phone: '+91 98001 10001',
    },
    {
      fullName: 'Priya Nair',
      email: 'priya.nair@skillnova.edu',
      passwordHash: mentorPassHash,
      role: 'INSTRUCTOR',
      phone: '+91 98001 10002',
    },
    {
      fullName: 'Arjun Mehta',
      email: 'arjun.mehta@skillnova.edu',
      passwordHash: mentorPassHash,
      role: 'INSTRUCTOR',
      phone: '+91 98001 10003',
    },
    {
      fullName: 'Elena Rostova',
      email: 'elena.rostova@skillnova.edu',
      passwordHash: mentorPassHash,
      role: 'INSTRUCTOR',
      phone: '+91 98001 10004',
    },
    {
      fullName: 'Ananya Sharma (Demo Student)',
      email: 'student@skillnova.edu',
      passwordHash: studentPassHash,
      role: 'STUDENT',
      phone: '+91 98450 22110',
    },
    {
      fullName: 'Rahul Verma (Demo Student)',
      email: 'rahul.verma@skillnova.edu',
      passwordHash: studentPassHash,
      role: 'STUDENT',
      phone: '+91 98450 22111',
    },
  ];

  const userMap = {};
  for (const u of usersSeed) {
    let row = await queryOne('SELECT id, email FROM users WHERE email = $1', [u.email]);
    if (!row) {
      row = await queryOne(
        `INSERT INTO users (full_name, email, password_hash, role, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email`,
        [u.fullName, u.email, u.passwordHash, u.role, u.phone, true]
      );
    }
    userMap[u.email] = row.id;
  }

  // Instructor Profiles
  const instructorProfiles = [
    {
      email: 'instructor@skillnova.edu',
      headline: 'Principal AI & ML Architect · Former DeepMind Research Engineer',
      expertise: ['PyTorch', 'LLMs', 'Distributed ML', 'Python'],
      yearsExperience: 11,
      companyBackground: 'Ex-DeepMind & Microsoft Research',
      bio: 'Led production recommendation and generative retrieval systems serving 40M+ daily learners.',
    },
    {
      email: 'priya.nair@skillnova.edu',
      headline: 'Staff Cloud Security & DevOps Lead',
      expertise: ['AWS', 'Kubernetes', 'Terraform', 'AppSec'],
      yearsExperience: 9,
      companyBackground: 'Ex-AWS & Cloudflare',
      bio: 'Specialized in zero-trust multi-cloud architectures, SOC automation, and Kubernetes platform engineering.',
    },
    {
      email: 'arjun.mehta@skillnova.edu',
      headline: 'Director of Systems, Full Stack & EV Mobility Engineering',
      expertise: ['React', 'Node.js', 'Java Spring', 'EV Powertrain'],
      yearsExperience: 12,
      companyBackground: 'Ex-Bosch Mobility & Atlassian',
      bio: 'Bridges enterprise full-stack software architecture with embedded automotive and EV powertrain simulation.',
    },
    {
      email: 'elena.rostova@skillnova.edu',
      headline: 'Principal Product Designer & Frontend Architect',
      expertise: ['Figma', 'Design Systems', 'React', 'Three.js'],
      yearsExperience: 10,
      companyBackground: 'Ex-Figma Partner Studio & Stripe',
      bio: 'Coaches engineers and designers in accessible design systems, spatial interfaces, and high-craft frontend execution.',
    },
  ];

  for (const ip of instructorProfiles) {
    const uid = userMap[ip.email];
    const existingIp = await queryOne('SELECT id FROM instructor_profiles WHERE user_id = $1', [uid]);
    if (!existingIp) {
      await query(
        `INSERT INTO instructor_profiles (user_id, headline, expertise, years_experience, company_background, bio)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uid, ip.headline, JSON.stringify(ip.expertise), ip.yearsExperience, ip.companyBackground, ip.bio]
      );
    }
  }

  // Student Profiles
  const demoStudentId = userMap['student@skillnova.edu'];
  const existingSp = await queryOne('SELECT id FROM student_profiles WHERE user_id = $1', [demoStudentId]);
  if (!existingSp) {
    await query(
      `INSERT INTO student_profiles (user_id, whatsapp_number, college_name, department, year_of_study, state, education_level, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        demoStudentId,
        '+91 98450 22110',
        'RV College of Engineering',
        'Computer Science & Engineering',
        'Final Year (4th Year)',
        'Karnataka',
        'B.E. Computer Science',
        'Focused on full-stack web architecture and applied AI systems.',
      ]
    );
  }

  // 2. Seed 15 Categories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    let row = await queryOne('SELECT id, slug FROM course_categories WHERE slug = $1', [cat.slug]);
    if (!row) {
      row = await queryOne(
        `INSERT INTO course_categories (name, slug, description, icon_name, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, slug`,
        [cat.name, cat.slug, cat.description, cat.iconName, cat.sortOrder]
      );
    }
    categoryMap[cat.slug] = row.id;
  }

  // 3. Seed 45 Courses + Modules + Lessons + Quizzes + Assignments
  const seededCourses = [];
  for (let i = 0; i < COURSES_SEED.length; i += 1) {
    const c = COURSES_SEED[i];
    let courseRow = await queryOne('SELECT id, slug, title, course_fee, advance_amount, full_amount FROM courses WHERE slug = $1', [c.slug]);
    if (!courseRow) {
      const catId = categoryMap[c.categorySlug];
      const instId = userMap[c.instructorEmail] || userMap['instructor@skillnova.edu'];
      const enrolledCount = 85 + ((i * 19) % 240);
      const ratingAvg = Number((4.7 + ((i % 3) * 0.1)).toFixed(1));
      const fullAmount = c.courseFee;

      courseRow = await queryOne(
        `INSERT INTO courses (
          title, slug, short_summary, description, category_id, instructor_id,
          thumbnail_url, technologies, skill_level, duration, duration_weeks,
          course_fee, advance_amount, full_amount, learning_outcomes,
          internship_available, internship_details, faqs, status, featured,
          rating_avg, enrolled_count, live_session_info
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, 'PUBLISHED', $19,
          $20, $21, $22
        ) RETURNING id, slug, title, course_fee, advance_amount, full_amount`,
        [
          c.title,
          c.slug,
          c.shortSummary,
          c.description,
          catId,
          instId,
          c.thumbnailUrl,
          JSON.stringify(c.technologies),
          c.skillLevel,
          c.duration,
          c.durationWeeks,
          c.courseFee,
          c.advanceAmount,
          fullAmount,
          JSON.stringify(c.outcomes),
          true,
          c.internshipDetails,
          JSON.stringify([
            {
              q: 'What prerequisites are required for this program?',
              a: c.skillLevel === 'Beginner'
                ? 'No prior industry experience is required; basic logical reasoning and laptop access are sufficient.'
                : 'Foundational programming familiarity or completion of an introductory engineering course is recommended.',
            },
            {
              q: 'Does this course include live mentor code reviews and internship credit?',
              a: 'Yes. Every enrolled learner receives weekly live cohort sessions, code/design reviews, and an industry internship certificate upon capstone approval.',
            },
          ]),
          c.featured,
          ratingAvg,
          enrolledCount,
          'Live Sessions: Sat & Sun · 7:00 PM – 9:00 PM IST + Midweek Lab Office Hours',
        ]
      );

      // Seed 3 Modules per course with 3 Lessons each
      const modulesSpec = [
        {
          title: `Module 1: Core Foundations & ${c.technologies[0] || 'Architecture'} Setup`,
          description: 'Establish professional tooling, architectural mental models, and first hands-on lab.',
          lessons: [
            { title: `Industry Landscape & Engineering Setup`, type: 'VIDEO', duration: 35, preview: true },
            { title: `Core Mechanics of ${c.technologies[0] || 'Core Systems'}`, type: 'READING', duration: 25, preview: false },
            { title: `Hands-On Lab 01: Production Environment & Starter Build`, type: 'LAB', duration: 50, preview: false },
          ],
        },
        {
          title: `Module 2: Applied ${c.technologies[1] || 'Systems'} & Production Workflows`,
          description: 'Build intermediate modules, integrate testing, and benchmark reliability.',
          lessons: [
            { title: `Deep Dive into ${c.technologies[1] || 'Modular Patterns'}`, type: 'VIDEO', duration: 45, preview: false },
            { title: `Error Handling, Security & Edge-Case Analysis`, type: 'READING', duration: 30, preview: false },
            { title: `Hands-On Lab 02: End-to-End Integration Sprint`, type: 'LAB', duration: 60, preview: false },
          ],
        },
        {
          title: `Module 3: Capstone Engineering, Optimization & Career Readiness`,
          description: 'Deliver an industry-grade capstone project and prepare for technical panels.',
          lessons: [
            { title: `Capstone Architecture Review & Deployment`, type: 'LIVE', duration: 60, preview: false },
            { title: `Performance Profiling & Portfolio Documentation`, type: 'READING', duration: 30, preview: false },
            { title: `Mock Technical Interview & System Walkthrough`, type: 'VIDEO', duration: 40, preview: false },
          ],
        },
      ];

      for (let mIdx = 0; mIdx < modulesSpec.length; mIdx += 1) {
        const mod = modulesSpec[mIdx];
        const modRow = await queryOne(
          `INSERT INTO course_modules (course_id, title, description, module_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [courseRow.id, mod.title, mod.description, mIdx + 1]
        );

        for (let lIdx = 0; lIdx < mod.lessons.length; lIdx += 1) {
          const les = mod.lessons[lIdx];
          await query(
            `INSERT INTO lessons (
              module_id, course_id, title, lesson_type, video_url, content,
              resource_url, duration_minutes, lesson_order, is_free_preview
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              modRow.id,
              courseRow.id,
              les.title,
              les.type,
              les.type === 'VIDEO' || les.type === 'LIVE' ? 'https://www.youtube.com/embed/dQw4w9WgXcQ' : null,
              `# ${les.title}\n\nIn this ${les.type.toLowerCase()} unit for **${c.title}**, you will apply ${c.technologies.join(', ')} to solve a real-world engineering scenario.\n\n### Practical Objectives\n1. Understand the underlying architecture and trade-offs.\n2. Implement and verify the deliverable in your local workspace.\n3. Document assumptions and submit for mentor feedback.`,
              `https://skillnova.edu/resources/${c.slug}-m${mIdx + 1}-l${lIdx + 1}.pdf`,
              les.duration,
              lIdx + 1,
              les.preview,
            ]
          );
        }
      }

      // Seed 1 Quiz per course with 4 questions
      const quizRow = await queryOne(
        `INSERT INTO quizzes (course_id, title, description, passing_score, time_limit_minutes)
         VALUES ($1, $2, $3, 60, 15) RETURNING id`,
        [
          courseRow.id,
          `${c.title.split(' ')[0]} Core Readiness Assessment`,
          `Validate your mastery of ${c.technologies.slice(0, 3).join(', ')} concepts before capstone review.`,
        ]
      );

      const quizQuestions = [
        {
          q: `Which primary stack combination is emphasized in ${c.title}?`,
          options: [
            `${c.technologies.slice(0, 2).join(' + ')}`,
            'Legacy Batch COBOL + FTP',
            'Manual Spreadsheet Macros Only',
            'Unversioned Local Scripts',
          ],
          correct: 0,
          exp: `${c.title} focuses on practical production mastery with ${c.technologies.slice(0, 2).join(' and ')}.`,
        },
        {
          q: 'What is the recommended SkillNova ratio between practical implementation and theory?',
          options: [
            '20% Practical / 80% Theory',
            '80% Practical / 20% Theory',
            '50% Slides / 50% Multiple Choice',
            '100% Passive Lectures',
          ],
          correct: 1,
          exp: 'SkillNova follows an 80% practical, 20% theory methodology backed by mentor code reviews.',
        },
        {
          q: 'Why should production systems enforce automated validation and testing before deployment?',
          options: [
            'To increase manual QA overhead',
            'To catch regressions early and guarantee contract safety',
            'To bypass version control history',
            'To disable error logging',
          ],
          correct: 1,
          exp: 'Automated validation and tests catch regressions before reaching production users.',
        },
        {
          q: 'Which deliverable validates graduation readiness for internship and career placement?',
          options: [
            'Attendance check-in only',
            'Reviewed capstone project, quizzes, and portfolio documentation',
            'Downloading slides without coding',
            'Skipping peer reviews',
          ],
          correct: 1,
          exp: 'A mentor-reviewed capstone project paired with passed assessments earns your verified certificate.',
        },
      ];

      for (let qIdx = 0; qIdx < quizQuestions.length; qIdx += 1) {
        const qq = quizQuestions[qIdx];
        await query(
          `INSERT INTO questions (quiz_id, question_text, options, correct_option_index, explanation, question_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [quizRow.id, qq.q, JSON.stringify(qq.options), qq.correct, qq.exp, qIdx + 1]
        );
      }

      // Seed 1 Assignment per course
      await query(
        `INSERT INTO assignments (course_id, title, description, due_date, max_score)
         VALUES ($1, $2, $3, $4, 100)`,
        [
          courseRow.id,
          `Capstone Lab: ${c.technologies[0] || 'Architecture'} Production Deliverable`,
          `Build and document a working solution applying ${c.technologies.join(', ')}. Include architecture notes, repository link, and verification screenshots or report.`,
          '2026-12-20',
        ]
      );
    }
    seededCourses.push(courseRow);
  }

  // 4. Seed Demo Enrollments, Admission, Payment, Certificate, Enquiries, Testimonials, FAQs
  const flagshipCourse = seededCourses[0];
  const fullStackCourse = seededCourses[3];

  if (flagshipCourse && fullStackCourse) {
    // Admission & Payment for Demo Student (Sample Record)
    const existingAdm = await queryOne('SELECT id FROM admissions WHERE registration_id = $1', ['SN-ADM-2026-1001']);
    let adm1Id = existingAdm?.id;
    if (!adm1Id) {
      const adm1 = await queryOne(
        `INSERT INTO admissions (
          registration_id, user_id, course_id, full_name, email, mobile_number, whatsapp_number,
          college_name, department, year_of_study, state, learning_preference,
          payment_option, total_fee, amount_paid, remaining_balance, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'FULL', $13, $13, 0, 'APPROVED')
        RETURNING id`,
        [
          'SN-ADM-2026-1001',
          demoStudentId,
          fullStackCourse.id,
          'Ananya Sharma (Demo Student)',
          'student@skillnova.edu',
          '+91 98450 22110',
          '+91 98450 22110',
          'RV College of Engineering',
          'Computer Science & Engineering',
          'Final Year (4th Year)',
          'Karnataka',
          'Live Online Cohort',
          fullStackCourse.course_fee,
        ]
      );
      adm1Id = adm1.id;

      await query(
        `INSERT INTO payments (
          admission_id, user_id, course_id, receipt_number, payment_type, amount, currency,
          razorpay_order_id, razorpay_payment_id, status, gateway_mode, paid_at
        ) VALUES ($1, $2, $3, $4, 'FULL', $5, 'INR', $6, $7, 'SUCCESS', 'RAZORPAY_TEST', CURRENT_TIMESTAMP)`,
        [
          adm1Id,
          demoStudentId,
          fullStackCourse.id,
          'SN-RCP-2026-1001',
          fullStackCourse.course_fee,
          'order_demo_sn_1001',
          'pay_demo_sn_1001',
        ]
      );
    }

    // Second sample admission (Advance Paid with balance)
    const rahulId = userMap['rahul.verma@skillnova.edu'];
    const existingAdm2 = await queryOne('SELECT id FROM admissions WHERE registration_id = $1', ['SN-ADM-2026-1002']);
    if (!existingAdm2) {
      const adv = flagshipCourse.advance_amount;
      const bal = flagshipCourse.course_fee - adv;
      const adm2 = await queryOne(
        `INSERT INTO admissions (
          registration_id, user_id, course_id, full_name, email, mobile_number, whatsapp_number,
          college_name, department, year_of_study, state, learning_preference,
          payment_option, total_fee, amount_paid, remaining_balance, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ADVANCE', $13, $14, $15, 'ADVANCE_PAID')
        RETURNING id`,
        [
          'SN-ADM-2026-1002',
          rahulId,
          flagshipCourse.id,
          'Rahul Verma (Demo Student)',
          'rahul.verma@skillnova.edu',
          '+91 98450 22111',
          '+91 98450 22111',
          'NIT Surathkal',
          'Information Technology',
          '3rd Year',
          'Karnataka',
          'Hybrid Mentor Cohort',
          flagshipCourse.course_fee,
          adv,
          bal,
        ]
      );

      await query(
        `INSERT INTO payments (
          admission_id, user_id, course_id, receipt_number, payment_type, amount, currency,
          razorpay_order_id, razorpay_payment_id, status, gateway_mode, paid_at
        ) VALUES ($1, $2, $3, $4, 'ADVANCE', $5, 'INR', $6, $7, 'SUCCESS', 'RAZORPAY_TEST', CURRENT_TIMESTAMP)`,
        [
          adm2.id,
          rahulId,
          flagshipCourse.id,
          'SN-RCP-2026-1002',
          adv,
          'order_demo_sn_1002',
          'pay_demo_sn_1002',
        ]
      );
    }

    // Enroll Demo Student in 2 courses (one completed with certificate, one active in progress)
    const enr1 = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [demoStudentId, fullStackCourse.id]);
    if (!enr1) {
      await query(
        `INSERT INTO enrollments (user_id, course_id, admission_id, status, progress_percent, learning_hours, completed_at)
         VALUES ($1, $2, $3, 'COMPLETED', 100, 48.5, CURRENT_TIMESTAMP)`,
        [demoStudentId, fullStackCourse.id, adm1Id]
      );
      const lessons = await query('SELECT id FROM lessons WHERE course_id = $1', [fullStackCourse.id]);
      for (const l of lessons.rows) {
        await query(
          'INSERT INTO lesson_progress (user_id, course_id, lesson_id, is_completed) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [demoStudentId, fullStackCourse.id, l.id, true]
        );
      }
      await query(
        `INSERT INTO certificates (certificate_code, user_id, course_id, student_name, course_title, grade)
         VALUES ($1, $2, $3, $4, $5, 'Distinction') ON CONFLICT DO NOTHING`,
        ['SN-CERT-2026-8842', demoStudentId, fullStackCourse.id, 'Ananya Sharma (Demo Student)', fullStackCourse.title]
      );
    }

    const enr2 = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [demoStudentId, flagshipCourse.id]);
    if (!enr2) {
      await query(
        `INSERT INTO enrollments (user_id, course_id, status, progress_percent, learning_hours)
         VALUES ($1, $2, 'ACTIVE', 33, 14.0)`,
        [demoStudentId, flagshipCourse.id]
      );
      const lessons2 = await query('SELECT id FROM lessons WHERE course_id = $1 ORDER BY id ASC LIMIT 3', [flagshipCourse.id]);
      for (const l of lessons2.rows) {
        await query(
          'INSERT INTO lesson_progress (user_id, course_id, lesson_id, is_completed) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [demoStudentId, flagshipCourse.id, l.id, true]
        );
      }
    }

    const rahulEnr = await queryOne('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [rahulId, flagshipCourse.id]);
    if (!rahulEnr) {
      await query(
        `INSERT INTO enrollments (user_id, course_id, status, progress_percent, learning_hours)
         VALUES ($1, $2, 'ACTIVE', 22, 9.5)`,
        [rahulId, flagshipCourse.id]
      );
    }
  }

  // 5. Seed Testimonials & FAQs
  const existingTestimonials = await queryOne('SELECT COUNT(*) AS count FROM testimonials');
  if (Number(existingTestimonials?.count || 0) === 0) {
    for (const t of TESTIMONIALS_SEED) {
      await query(
        `INSERT INTO testimonials (student_name, role_title, company_name, course_title, quote, outcome_metric, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.studentName, t.roleTitle, t.companyName, t.courseTitle, t.quote, t.outcomeMetric, true]
      );
    }
  }

  const existingFaqs = await queryOne('SELECT COUNT(*) AS count FROM faqs');
  if (Number(existingFaqs?.count || 0) === 0) {
    for (const f of FAQS_SEED) {
      await query(
        `INSERT INTO faqs (question, answer, category, sort_order, is_published)
         VALUES ($1, $2, $3, $4, $5)`,
        [f.question, f.answer, f.category, f.sortOrder, true]
      );
    }
  }

  // 6. Seed Sample Enquiries
  const existingEnq = await queryOne('SELECT COUNT(*) AS count FROM enquiries');
  if (Number(existingEnq?.count || 0) === 0) {
    await query(
      `INSERT INTO enquiries (full_name, email, mobile_number, course_id, course_interest, learning_preference, message, status)
       VALUES
       ('Aditya Joshi (Sample Enquiry)', 'aditya.joshi@example.com', '+91 98111 45201', $1, 'Applied Machine Learning & Generative AI Systems', 'Live Online Cohort', 'Looking for weekend batch timings and internship eligibility details.', 'NEW'),
       ('Sneha Reddy (Sample Enquiry)', 'sneha.reddy@example.com', '+91 98111 45202', $2, 'EV Powertrain Architecture, Motor Control & Inverters', 'Hybrid Lab Cohort', 'Interested in BMS and Simulink lab schedule for final-year EEE students.', 'CONTACTED')`,
      [seededCourses[0]?.id || null, seededCourses[39]?.id || null]
    );
  }

  // 7. Seed CMS Site Settings
  const settings = [
    ['hero_headline', 'Master Engineering Skills Built for Real Industry Careers'],
    ['hero_subheadline', '45+ mentor-led programs across AI, Full Stack Engineering, Cloud, DevOps, Cybersecurity, and Electric Vehicle Technology—combining 80% hands-on labs with verified internships.'],
    ['announcement_banner', 'Spring & Summer 2026 Engineering Cohorts Open · Advance Seat Reservation Available'],
    ['contact_email', 'admissions@skillnova.edu'],
    ['contact_phone', '+91 80 4192 8800'],
    ['contact_address', 'Level 7, Prestige Tech Park, Outer Ring Road, Bengaluru 560103'],
  ];
  for (const [k, v] of settings) {
    await query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO NOTHING`,
      [k, v]
    );
  }

  await runUpgradeSeed();
  return { seeded: true, coursesCount: seededCourses.length };
}
