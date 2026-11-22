import { query, queryOne } from './index.js';
import { FREE_INTRO_COURSES_SEED } from './seedData.js';

const ACHIEVEMENTS_SEED = [
  {
    code: 'FIRST_LESSON',
    title: 'First Step',
    description: 'Complete your first course lesson.',
    iconName: 'BookOpen',
    xpReward: 15,
    criteriaType: 'LESSONS_COMPLETED',
    criteriaValue: 1,
  },
  {
    code: 'MODULE_FINISHER',
    title: 'Module Finisher',
    description: 'Complete all lessons inside a course module.',
    iconName: 'Layers',
    xpReward: 25,
    criteriaType: 'MODULES_COMPLETED',
    criteriaValue: 1,
  },
  {
    code: 'QUIZ_ACE',
    title: 'Assessment Ace',
    description: 'Pass a course assessment quiz.',
    iconName: 'CheckSquare',
    xpReward: 30,
    criteriaType: 'QUIZZES_PASSED',
    criteriaValue: 1,
  },
  {
    code: 'STREAK_3',
    title: '3-Day Momentum',
    description: 'Study for 3 consecutive days.',
    iconName: 'Flame',
    xpReward: 40,
    criteriaType: 'STREAK_DAYS',
    criteriaValue: 3,
  },
  {
    code: 'STREAK_7',
    title: '7-Day Consistency',
    description: 'Maintain a 7-day learning streak.',
    iconName: 'Zap',
    xpReward: 100,
    criteriaType: 'STREAK_DAYS',
    criteriaValue: 7,
  },
  {
    code: 'COURSE_GRADUATE',
    title: 'Course Graduate',
    description: 'Complete 100% of an entire SkillNova course.',
    iconName: 'Award',
    xpReward: 100,
    criteriaType: 'COURSES_COMPLETED',
    criteriaValue: 1,
  },
  {
    code: 'ROADMAP_EXPLORER',
    title: 'Career Architect',
    description: 'Select a Career Roadmap and complete a milestone.',
    iconName: 'Compass',
    xpReward: 25,
    criteriaType: 'ROADMAP_STEPS',
    criteriaValue: 1,
  },
  {
    code: 'COMMUNITY_HELPER',
    title: 'Peer Mentor',
    description: 'Contribute helpful answers in the Student Community.',
    iconName: 'MessageSquare',
    xpReward: 25,
    criteriaType: 'COMMUNITY_POSTS',
    criteriaValue: 1,
  },
];

const ROADMAPS_SEED = [
  {
    title: 'Java Full Stack Developer',
    slug: 'java-full-stack-developer',
    roleSummary: 'Enterprise Spring Boot microservices paired with modern React frontends and PostgreSQL.',
    description: 'Master Core Java, OOP design patterns, Spring Boot 3, REST security, React, and cloud deployment for enterprise engineering roles.',
    difficulty: 'Intermediate',
    estimatedWeeks: 20,
    courseMatchKeywords: ['java', 'spring', 'full stack'],
    skillCategories: ['Core Java & DSA', 'Spring Boot & Microservices', 'Relational Databases & SQL', 'React Frontend'],
    practicalProjects: [
      'Multi-Tenant Banking Ledger API with Spring Security & JWT',
      'E-Commerce Order Orchestrator with PostgreSQL & React Admin',
      'Distributed Notification Service with Docker & CI/CD',
    ],
    interviewPrep: [
      'JVM Memory Model, Garbage Collection & Concurrency Primitives',
      'Spring Boot Dependency Injection, Transactions & N+1 Query Tuning',
      'System Design: Rate Limiter & Idempotent Payment Processing',
    ],
    assessmentQuestions: [
      { question: 'Which annotation marks a Spring Boot class as a REST controller returning JSON?', options: ['@Service', '@RestController', '@Entity', '@Repository'], correctIndex: 1 },
      { question: 'Which collection guarantees unique elements with O(1) average lookup in Java?', options: ['ArrayList', 'LinkedList', 'HashSet', 'TreeMap'], correctIndex: 2 },
      { question: 'What HTTP status code represents a newly created resource?', options: ['200', '201', '204', '409'], correctIndex: 1 },
    ],
    steps: [
      { category: 'Core Java & DSA', title: 'Java 21 Fundamentals, Collections & Concurrency', description: 'Build rock-solid OOP, Streams API, exception handling, and multithreading foundations.', hours: 28, task: 'Implement a thread-safe LRU cache and unit test suite.' },
      { category: 'Relational Databases & SQL', title: 'PostgreSQL Schema Design & Query Optimization', description: 'Master normalization, indexing, joins, transactions, and ACID isolation levels.', hours: 20, task: 'Design a normalized 8-table schema with composite indexes.' },
      { category: 'Spring Boot & Microservices', title: 'Spring Boot 3 REST APIs, JPA & JWT Auth', description: 'Build layered REST services with validation, RBAC security, and integration tests.', hours: 36, task: 'Ship an authenticated Task & RBAC API.' },
      { category: 'React Frontend', title: 'React SPA Integration & Production Deployment', description: 'Connect React dashboards with Spring Boot APIs and deploy with Docker.', hours: 30, task: 'Deploy a full-stack React + Spring Boot portfolio app.' },
    ],
  },
  {
    title: 'Python Developer',
    slug: 'python-developer',
    roleSummary: 'Clean Pythonic software engineering, FastAPI/Django backends, automation, and testing.',
    description: 'Progress from idiomatic Python internals and typing to scalable API services, async workflows, and production testing.',
    difficulty: 'Beginner',
    estimatedWeeks: 16,
    courseMatchKeywords: ['python', 'django', 'fastapi'],
    skillCategories: ['Python Internals', 'Web APIs (FastAPI/Django)', 'Data & Persistence', 'Testing & Packaging'],
    practicalProjects: [
      'Async Web Scraper & Price Intelligence CLI',
      'FastAPI URL Shortener with Analytics & Redis Caching',
      'Automated Billing PDF Generator & Email Pipeline',
    ],
    interviewPrep: [
      'GIL, Generators, Decorators & Context Managers',
      'Asyncio Event Loop vs Multiprocessing',
      'Pytest Fixtures, Mocking & API Contract Testing',
    ],
    assessmentQuestions: [
      { question: 'Which keyword creates a generator function in Python?', options: ['async', 'yield', 'lambda', 'return'], correctIndex: 1 },
      { question: 'Which built-in structure preserves insertion order and maps unique keys?', options: ['tuple', 'set', 'dict', 'frozenset'], correctIndex: 2 },
      { question: 'Which Python tool isolates project dependencies cleanly?', options: ['venv', 'gcc', 'cron', 'make'], correctIndex: 0 },
    ],
    steps: [
      { category: 'Python Internals', title: 'Idiomatic Python, Typing & Data Structures', description: 'Master comprehensions, decorators, generators, and type hints.', hours: 24, task: 'Build a CLI log parser with pathlib and dataclasses.' },
      { category: 'Data & Persistence', title: 'PostgreSQL, SQLAlchemy & Migrations', description: 'Write parameterized queries and relational models cleanly.', hours: 22, task: 'Build a repository data layer backed by PostgreSQL.' },
      { category: 'Web APIs (FastAPI/Django)', title: 'High-Speed APIs with FastAPI & Pydantic', description: 'Design validated endpoints, background jobs, and OAuth/JWT auth.', hours: 30, task: 'Build a FastAPI microservice with OpenAPI docs.' },
      { category: 'Testing & Packaging', title: 'Pytest Automation & Docker Delivery', description: 'Achieve 85%+ test coverage and containerize Python apps.', hours: 18, task: 'Write pytest suites and a multi-stage Dockerfile.' },
    ],
  },
  {
    title: 'AI and Machine Learning Engineer',
    slug: 'ai-ml-engineer',
    roleSummary: 'Applied ML, deep learning with PyTorch, RAG LLM systems, and MLOps evaluation.',
    description: 'Engineer end-to-end machine learning pipelines, transformer fine-tuning, vector retrieval, and production LLM applications.',
    difficulty: 'Advanced',
    estimatedWeeks: 22,
    courseMatchKeywords: ['machine learning', 'generative ai', 'deep learning', 'ai'],
    skillCategories: ['Math & Classical ML', 'Deep Learning & PyTorch', 'LLMs & RAG Systems', 'MLOps & Evaluation'],
    practicalProjects: [
      'Customer Churn Predictor with XGBoost & SHAP Explainability',
      'Semantic Document Q&A System using Embeddings & Vector Search',
      'Real-Time Vision Defect Detector with PyTorch & FastAPI',
    ],
    interviewPrep: [
      'Bias-Variance Tradeoff, Regularization & Gradient Descent',
      'Self-Attention Mechanism, Tokenization & Hallucination Mitigation',
      'Designing Low-Latency Inference Pipelines & Evaluation Harnesses',
    ],
    assessmentQuestions: [
      { question: 'Which loss function is standard for binary classification?', options: ['Mean Squared Error', 'Binary Cross-Entropy', 'Huber Loss', 'Cosine Distance'], correctIndex: 1 },
      { question: 'What does RAG stand for in LLM engineering?', options: ['Random Activation Graph', 'Retrieval-Augmented Generation', 'Recursive Attention Gate', 'Ranked Array Gradient'], correctIndex: 1 },
      { question: 'Which metric handles severe class imbalance better than raw accuracy?', options: ['F1 / PR-AUC', 'R-Squared', 'Mean Absolute Error', 'Perplexity'], correctIndex: 0 },
    ],
    steps: [
      { category: 'Math & Classical ML', title: 'NumPy, Pandas, Feature Engineering & Scikit-Learn', description: 'Build supervised and unsupervised pipelines with rigorous cross-validation.', hours: 32, task: 'Train and benchmark 3 classifiers on imbalanced tabular data.' },
      { category: 'Deep Learning & PyTorch', title: 'Neural Networks, CNNs & Transformers', description: 'Implement training loops, backpropagation, and transfer learning in PyTorch.', hours: 34, task: 'Fine-tune a pretrained transformer on domain classification.' },
      { category: 'LLMs & RAG Systems', title: 'Prompt Engineering, Tool Calling & Grounded RAG', description: 'Architect Gemini-powered assistants with structured outputs and retrieval.', hours: 28, task: 'Build a grounded technical Q&A assistant with citations.' },
      { category: 'MLOps & Evaluation', title: 'Model Serving, Drift Monitoring & Benchmarks', description: 'Package models behind resilient APIs with latency and quality metrics.', hours: 22, task: 'Deploy an evaluated ML inference service with benchmark logs.' },
    ],
  },
  {
    title: 'Data Analyst',
    slug: 'data-analyst',
    roleSummary: 'SQL analytics, Python data wrangling, statistical A/B testing, and executive BI dashboards.',
    description: 'Turn raw operational datasets into clear strategic decisions using SQL window functions, Python visualization, and BI storytelling.',
    difficulty: 'Beginner',
    estimatedWeeks: 14,
    courseMatchKeywords: ['data science', 'analytics', 'power bi', 'sql'],
    skillCategories: ['Advanced SQL', 'Python & Pandas', 'Statistics & A/B Testing', 'BI Visualization'],
    practicalProjects: [
      'SaaS Cohort Retention & Funnel Drop-off SQL Audit',
      'E-Commerce Revenue & Inventory Forecasting Workbook',
      'Interactive Executive KPI Dashboard with Drill-Down Filters',
    ],
    interviewPrep: [
      'SQL Window Functions: RANK, DENSE_RANK, LAG, Running Totals',
      'Hypothesis Testing, p-values, Confidence Intervals & Sample Sizing',
      'Metric Trees & Diagnosing Sudden KPI Drops',
    ],
    assessmentQuestions: [
      { question: 'Which SQL clause filters groups after aggregation?', options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], correctIndex: 1 },
      { question: 'Which SQL function computes a running total across ordered rows?', options: ['SUM() OVER (...)', 'COUNT(DISTINCT)', 'COALESCE()', 'UNION ALL'], correctIndex: 0 },
      { question: 'What is a p-value in A/B testing?', options: ['Revenue lift %', 'Probability of observing results assuming null hypothesis', 'Conversion rate', 'Sample size'], correctIndex: 1 },
    ],
    steps: [
      { category: 'Advanced SQL', title: 'CTEs, Window Functions & Query Tuning', description: 'Answer complex business questions directly in PostgreSQL.', hours: 24, task: 'Write 15 cohort retention and revenue attribution SQL queries.' },
      { category: 'Python & Pandas', title: 'Data Cleaning, Exploratory Analysis & Automation', description: 'Automate messy CSV/JSON cleansing and anomaly checks.', hours: 24, task: 'Clean a 100k-row dataset and generate automated EDA charts.' },
      { category: 'Statistics & A/B Testing', title: 'Experiment Design & Causal Reasoning', description: 'Design valid experiments and avoid peeking/selection bias.', hours: 18, task: 'Evaluate a product experiment and write a decision memo.' },
      { category: 'BI Visualization', title: 'Interactive Executive Dashboards & Storytelling', description: 'Present metrics with clarity, zero clutter, and actionable takeaways.', hours: 20, task: 'Deliver a 4-view executive KPI dashboard.' },
    ],
  },
  {
    title: 'Cloud Engineer',
    slug: 'cloud-engineer',
    roleSummary: 'AWS/GCP multi-tier architecture, IAM security, networking, serverless, and IaC.',
    description: 'Architect fault-tolerant, cost-optimized cloud infrastructure with VPC networking, IAM least privilege, and Terraform automation.',
    difficulty: 'Intermediate',
    estimatedWeeks: 18,
    courseMatchKeywords: ['cloud', 'aws', 'azure'],
    skillCategories: ['Linux & Networking', 'Core Cloud Services', 'IAM & Cloud Security', 'Infrastructure as Code'],
    practicalProjects: [
      'High-Availability 3-Tier VPC Architecture in Terraform',
      'Serverless Image Processing Pipeline with Object Storage Triggers',
      'Zero-Trust Cloud Security Audit & Cost Optimization Report',
    ],
    interviewPrep: [
      'VPC Subnets, Route Tables, NAT Gateways & Load Balancers',
      'IAM Roles vs Policies & Principle of Least Privilege',
      'RPO/RTO Disaster Recovery Strategies across Regions',
    ],
    assessmentQuestions: [
      { question: 'Which protocol translates domain names to IP addresses?', options: ['DHCP', 'DNS', 'BGP', 'SSH'], correctIndex: 1 },
      { question: 'What does Infrastructure as Code (Terraform) prevent?', options: ['Configuration drift', 'DNS resolution', 'TLS encryption', 'HTTP caching'], correctIndex: 0 },
      { question: 'Which CIDR block represents a single specific IPv4 host?', options: ['/16', '/24', '/32', '/0'], correctIndex: 2 },
    ],
    steps: [
      { category: 'Linux & Networking', title: 'TCP/IP, DNS, TLS & Linux Administration', description: 'Master shell scripting, systemd, firewalls, and packet diagnostics.', hours: 22, task: 'Configure Nginx reverse proxy with TLS and systemd service.' },
      { category: 'Core Cloud Services', title: 'Compute, Managed PostgreSQL, Storage & CDN', description: 'Provision autoscaling workloads and managed relational databases.', hours: 30, task: 'Deploy a highly available web tier with managed Postgres.' },
      { category: 'IAM & Cloud Security', title: 'Least-Privilege IAM, Secrets & Compliance', description: 'Eliminate static credentials and lock down security groups.', hours: 20, task: 'Audit and harden IAM policies with KMS secrets.' },
      { category: 'Infrastructure as Code', title: 'Terraform Modules & State Management', description: 'Codify repeatable environments with remote state locking.', hours: 26, task: 'Provision staging & prod networks via reusable Terraform modules.' },
    ],
  },
  {
    title: 'DevOps Engineer',
    slug: 'devops-engineer',
    roleSummary: 'Docker containers, Kubernetes orchestration, GitHub Actions CI/CD, and observability.',
    description: 'Accelerate release velocity with immutable builds, automated CI/CD gates, Kubernetes deployments, and Prometheus/Grafana monitoring.',
    difficulty: 'Intermediate',
    estimatedWeeks: 18,
    courseMatchKeywords: ['devops', 'kubernetes', 'docker'],
    skillCategories: ['Containers & Docker', 'CI/CD Pipelines', 'Kubernetes Orchestration', 'Observability & SRE'],
    practicalProjects: [
      'Zero-Downtime Blue-Green CI/CD Pipeline with GitHub Actions',
      'Production Kubernetes Cluster with Helm, HPA & Ingress TLS',
      'Full Observability Stack: Metrics, Structured Logs & Alerts',
    ],
    interviewPrep: [
      'Container Namespaces, Cgroups & Multi-Stage Docker Builds',
      'Kubernetes Pod Lifecycle, Readiness Probes & Services',
      'SLIs, SLOs, Error Budgets & Incident Postmortems',
    ],
    assessmentQuestions: [
      { question: 'Which Kubernetes probe determines when a Pod can receive traffic?', options: ['Liveness Probe', 'Readiness Probe', 'Startup Script', 'CronJob'], correctIndex: 1 },
      { question: 'Why use multi-stage Dockerfiles?', options: ['Smaller secure images without build tools', 'Slower builds', 'Bypass caching', 'Run as root'], correctIndex: 0 },
      { question: 'What metric tracks % of requests completed within latency target?', options: ['SLI', 'DNS TTL', 'MTU', 'UID'], correctIndex: 0 },
    ],
    steps: [
      { category: 'Containers & Docker', title: 'Docker Internals, Compose & Multi-Stage Builds', description: 'Build minimal, non-root container images for full-stack apps.', hours: 22, task: 'Containerize frontend, API, and Postgres with healthchecks.' },
      { category: 'CI/CD Pipelines', title: 'Automated Testing, Security Scans & Releases', description: 'Enforce lint, unit tests, and vulnerability scans on every PR.', hours: 24, task: 'Create a GitHub Actions pipeline with automated test gates.' },
      { category: 'Kubernetes Orchestration', title: 'Deployments, Services, Ingress & Autoscaling', description: 'Operate resilient workloads across namespaces with ConfigMaps.', hours: 32, task: 'Deploy a 3-service app to Kubernetes with HPA.' },
      { category: 'Observability & SRE', title: 'Prometheus, Grafana & On-Call Runbooks', description: 'Instrument golden signals: latency, traffic, errors, saturation.', hours: 20, task: 'Build latency/error dashboards and alert rules.' },
    ],
  },
  {
    title: 'Frontend Developer',
    slug: 'frontend-developer',
    roleSummary: 'Modern JavaScript, React architecture, Tailwind design systems, performance & accessibility.',
    description: 'Craft responsive, accessible, high-speed web applications with React hooks, state management, REST integration, and Core Web Vitals optimization.',
    difficulty: 'Beginner',
    estimatedWeeks: 16,
    courseMatchKeywords: ['frontend', 'react', 'ui', 'javascript'],
    skillCategories: ['HTML5, CSS3 & Accessibility', 'Modern JavaScript (ES6+)', 'React & State Architecture', 'Performance & Testing'],
    practicalProjects: [
      'Accessible SaaS Design System & Component Library',
      'Interactive Analytics Dashboard with Real API Integration',
      'High-Lighthouse E-Commerce Storefront with Cart & Checkout',
    ],
    interviewPrep: [
      'Event Loop, Closures, Promises & Prototype Inheritance',
      'React Reconciliation, Memoization & Custom Hook Patterns',
      'Web Security (XSS/CSRF), ARIA Semantics & Bundle Splitting',
    ],
    assessmentQuestions: [
      { question: 'Which React hook runs side effects after render?', options: ['useMemo', 'useEffect', 'useRef', 'useId'], correctIndex: 1 },
      { question: 'Which CSS layout system handles 2-dimensional grids natively?', options: ['Float', 'CSS Grid', 'Inline-block', 'Position fixed'], correctIndex: 1 },
      { question: 'Which attribute improves screen-reader support on icon-only buttons?', options: ['tabindex="-1"', 'aria-label', 'placeholder', 'data-id'], correctIndex: 1 },
    ],
    steps: [
      { category: 'HTML5, CSS3 & Accessibility', title: 'Semantic HTML, Tailwind CSS & WCAG AA', description: 'Build responsive layouts, fluid typography, and keyboard-first UI.', hours: 24, task: 'Build a responsive landing page with zero horizontal overflow.' },
      { category: 'Modern JavaScript (ES6+)', title: 'Async JS, Fetch, Closures & DOM Architecture', description: 'Master asynchronous data flows and functional array transforms.', hours: 26, task: 'Build an interactive filterable catalog in vanilla ES6.' },
      { category: 'React & State Architecture', title: 'React Router, Context, Hooks & API Clients', description: 'Structure modular SPAs with clean loading and error boundaries.', hours: 32, task: 'Build a multi-role dashboard SPA connected to REST APIs.' },
      { category: 'Performance & Testing', title: 'Code Splitting, Lighthouse & Component Tests', description: 'Eliminate layout shifts and optimize asset delivery.', hours: 18, task: 'Achieve 95+ Lighthouse Performance and Accessibility scores.' },
    ],
  },
  {
    title: 'Backend Developer',
    slug: 'backend-developer',
    roleSummary: 'Node.js/Express architecture, PostgreSQL engineering, auth security, caching & reliability.',
    description: 'Design high-integrity backend APIs, relational data models, JWT/RBAC security, payment webhooks, and scalable background processing.',
    difficulty: 'Intermediate',
    estimatedWeeks: 18,
    courseMatchKeywords: ['backend', 'node', 'full stack', 'system'],
    skillCategories: ['Node.js & REST Architecture', 'PostgreSQL & Transactions', 'Security & Authentication', 'Scale, Caching & Queues'],
    practicalProjects: [
      'Production Auth Service with Refresh Token Rotation & RBAC',
      'Webhook-Safe Payment & Ledger Engine with Idempotency Keys',
      'Rate-Limited API Gateway with Structured Logging',
    ],
    interviewPrep: [
      'ACID Transactions, Deadlocks & Optimistic vs Pessimistic Locking',
      'JWT vs Session Cookies, CSRF & Timing-Safe HMAC Verification',
      'Horizontal Scaling, Connection Pooling & Caching Strategies',
    ],
    assessmentQuestions: [
      { question: 'Why use parameterized SQL queries ($1, $2)?', options: ['Faster CSS', 'Prevent SQL Injection', 'Skip indexing', 'Enable CORS'], correctIndex: 1 },
      { question: 'Which HTTP status indicates an authenticated user lacks permission?', options: ['401', '403', '404', '429'], correctIndex: 1 },
      { question: 'What prevents duplicate payment processing on webhook retries?', options: ['Idempotency check in DB transaction', 'Longer timeout', 'Disabling TLS', 'Using GET requests'], correctIndex: 0 },
    ],
    steps: [
      { category: 'Node.js & REST Architecture', title: 'Express Middleware, Zod Validation & Error Handling', description: 'Design predictable REST contracts with clean status codes.', hours: 24, task: 'Build a modular Express API with Zod schema validation.' },
      { category: 'PostgreSQL & Transactions', title: 'Relational Modeling, Joins & Atomic Transactions', description: 'Guarantee data integrity across concurrent updates.', hours: 28, task: 'Implement atomic order + inventory updates inside transactions.' },
      { category: 'Security & Authentication', title: 'bcrypt, JWT Rotation, CORS & Rate Limiting', description: 'Harden endpoints against brute force, IDOR, and XSS.', hours: 24, task: 'Implement RBAC middleware and ownership verification tests.' },
      { category: 'Scale, Caching & Queues', title: 'Connection Pooling, Logging & Production Ops', description: 'Prepare services for Render/cloud deployment with healthchecks.', hours: 20, task: 'Add automated API integration tests and health diagnostics.' },
    ],
  },
];

export async function runUpgradeSeed() {
  // 1. Seed Achievements
  for (const a of ACHIEVEMENTS_SEED) {
    const exists = await queryOne('SELECT id FROM achievements WHERE code = $1', [a.code]);
    if (!exists) {
      await query(
        `INSERT INTO achievements (code, title, description, icon_name, xp_reward, criteria_type, criteria_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [a.code, a.title, a.description, a.iconName, a.xpReward, a.criteriaType, a.criteriaValue]
      );
    }
  }

  // Load courses & users for cross-linking
  const coursesRes = await query('SELECT id, title, slug, instructor_id FROM courses ORDER BY id ASC');
  const courses = coursesRes.rows;
  const studentRow = await queryOne("SELECT id, full_name FROM users WHERE email = 'student@skillnova.edu'");
  const rahulRow = await queryOne("SELECT id, full_name FROM users WHERE email = 'rahul.verma@skillnova.edu'");
  const instructorRow = await queryOne("SELECT id, full_name FROM users WHERE email = 'instructor@skillnova.edu'");
  const arjunRow = await queryOne("SELECT id, full_name FROM users WHERE email = 'arjun.mehta@skillnova.edu'");

  const findCourseId = (keywords) => {
    const match = courses.find((c) => keywords.some((k) => c.title.toLowerCase().includes(k)));
    return match ? match.id : courses[0]?.id || null;
  };

  // 2. Seed 8 Career Roadmaps
  for (const r of ROADMAPS_SEED) {
    let roadmapRow = await queryOne('SELECT id FROM career_roadmaps WHERE slug = $1', [r.slug]);
    if (!roadmapRow) {
      roadmapRow = await queryOne(
        `INSERT INTO career_roadmaps (
          title, slug, role_summary, description, difficulty, estimated_weeks,
          skill_categories, practical_projects, interview_prep, assessment_questions, is_published
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          r.title,
          r.slug,
          r.roleSummary,
          r.description,
          r.difficulty,
          r.estimatedWeeks,
          JSON.stringify(r.skillCategories),
          JSON.stringify(r.practicalProjects),
          JSON.stringify(r.interviewPrep),
          JSON.stringify(r.assessmentQuestions),
          true,
        ]
      );

      const recCourseId = findCourseId(r.courseMatchKeywords);
      for (let i = 0; i < r.steps.length; i += 1) {
        const s = r.steps[i];
        await query(
          `INSERT INTO roadmap_steps (roadmap_id, step_order, skill_category, title, description, recommended_course_id, estimated_hours, project_task)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [roadmapRow.id, i + 1, s.category, s.title, s.description, recCourseId, s.hours, s.task]
        );
      }
    }
  }

  // 3. Seed Live Sessions (if empty)
  const existingSessions = await queryOne('SELECT COUNT(*) AS cnt FROM live_sessions');
  if (Number(existingSessions?.cnt || 0) === 0 && courses.length > 0) {
    const c0 = courses[0];
    const c3 = courses[3] || courses[0];
    const future1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const future2 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const past1 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const sess1 = await queryOne(
      `INSERT INTO live_sessions (course_id, instructor_id, title, description, meeting_url, meeting_platform, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'Google Meet', $6, 90, 'SCHEDULED') RETURNING id`,
      [
        c0.id,
        c0.instructor_id || instructorRow?.id,
        'Live Architecture Walkthrough: Production ML & LLM Retrieval',
        'Interactive architecture deep-dive, live code debugging, and Q&A for enrolled learners.',
        'https://meet.google.com/sn-live-ai-cohort',
        future1,
      ]
    );
    await query(
      `INSERT INTO live_sessions (course_id, instructor_id, title, description, meeting_url, meeting_platform, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'Zoom', $6, 75, 'SCHEDULED')`,
      [
        c3.id,
        c3.instructor_id || arjunRow?.id,
        'Capstone Code Review & PostgreSQL Indexing Clinic',
        'Bring your schema diagrams and API bottlenecks for live mentor optimization feedback.',
        'https://zoom.us/j/98450221100',
        future2,
      ]
    );
    const pastSess = await queryOne(
      `INSERT INTO live_sessions (course_id, instructor_id, title, description, meeting_url, meeting_platform, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'Google Meet', $6, 60, 'COMPLETED') RETURNING id`,
      [
        c0.id,
        c0.instructor_id || instructorRow?.id,
        'Cohort Orientation & Environment Setup Lab',
        'Initial setup of workspace, repository conventions, and grading rubric.',
        'https://meet.google.com/sn-orientation-2026',
        past1,
      ]
    );
    if (studentRow && pastSess) {
      await query(
        `INSERT INTO attendance (session_id, user_id, status, notes) VALUES ($1, $2, 'PRESENT', 'Attended full session') ON CONFLICT DO NOTHING`,
        [pastSess.id, studentRow.id]
      );
    }
    if (studentRow && sess1) {
      await query(
        `INSERT INTO user_notifications (user_id, title, message, category, action_url)
         VALUES ($1, 'Upcoming Live Class Scheduled', 'Live Architecture Walkthrough starts in 2 days. Join via your Live Classes tab.', 'LIVE_CLASS', '/student')`,
        [studentRow.id]
      );
    }
  }

  // 4. Seed Companies & Job/Internship Opportunities
  const existingCompanies = await queryOne('SELECT COUNT(*) AS cnt FROM companies');
  if (Number(existingCompanies?.cnt || 0) === 0) {
    const companiesData = [
      { name: 'NovaScale Systems', industry: 'Cloud & AI Infrastructure', location: 'Bengaluru, India', websiteUrl: 'https://novascale.example.com', description: 'Enterprise distributed systems and AI observability platform.' },
      { name: 'FinPulse Technologies', industry: 'FinTech Engineering', location: 'Mumbai / Remote', websiteUrl: 'https://finpulse.example.com', description: 'Real-time payment orchestration and credit risk analytics.' },
      { name: 'VoltDrive Mobility', industry: 'EV & Embedded Systems', location: 'Pune, India', websiteUrl: 'https://voltdrive.example.com', description: 'Connected electric powertrain and BMS telemetry engineering.' },
      { name: 'DataCraft Studio', industry: 'Data & Analytics Consulting', location: 'Hyderabad, India', websiteUrl: 'https://datacraft.example.com', description: 'Modern lakehouse and BI engineering partner for global enterprises.' },
    ];
    const companyIds = {};
    for (const c of companiesData) {
      const row = await queryOne(
        `INSERT INTO companies (name, industry, location, website_url, description) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [c.name, c.industry, c.location, c.websiteUrl, c.description]
      );
      companyIds[c.name] = row.id;
    }

    const jobsData = [
      {
        company: 'NovaScale Systems',
        title: 'Associate Full Stack Engineer',
        type: 'JOB',
        location: 'Bengaluru',
        workMode: 'Hybrid',
        ctc: 'INR 9.5 – 12.5 LPA',
        eligibility: 'Completed Full Stack / Backend program or 70%+ assessment average',
        skills: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
        desc: 'Build customer-facing analytics dashboards and high-throughput PostgreSQL APIs alongside staff engineers.',
        deadline: '2026-12-31',
      },
      {
        company: 'NovaScale Systems',
        title: 'Applied AI & LLM Engineering Intern',
        type: 'INTERNSHIP',
        location: 'Remote',
        workMode: 'Remote',
        ctc: 'INR 35,000 / month + PPO',
        eligibility: 'Enrolled in AI/ML or Python engineering track',
        skills: ['Python', 'PyTorch', 'LLMs', 'RAG'],
        desc: 'Prototype retrieval evaluation pipelines and prompt diagnostics with production telemetry.',
        deadline: '2026-12-25',
      },
      {
        company: 'FinPulse Technologies',
        title: 'Java Spring Boot Backend Developer',
        type: 'JOB',
        location: 'Mumbai',
        workMode: 'Hybrid',
        ctc: 'INR 10 – 14 LPA',
        eligibility: 'Strong Java + SQL fundamentals and capstone submission',
        skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Microservices'],
        desc: 'Develop idempotent ledger APIs and real-time settlement reconciliation services.',
        deadline: '2027-01-15',
      },
      {
        company: 'DataCraft Studio',
        title: 'Data Analyst Intern',
        type: 'INTERNSHIP',
        location: 'Hyderabad',
        workMode: 'Hybrid',
        ctc: 'INR 25,000 / month',
        eligibility: 'Open to final-year students and SkillNova Data Analytics learners',
        skills: ['SQL', 'Python', 'Pandas', 'Power BI'],
        desc: 'Build automated cohort retention dashboards and SQL warehouse transformations.',
        deadline: '2026-12-28',
      },
      {
        company: 'VoltDrive Mobility',
        title: 'EV Embedded & BMS Validation Intern',
        type: 'INTERNSHIP',
        location: 'Pune',
        workMode: 'On-site',
        ctc: 'INR 30,000 / month',
        eligibility: 'EEE / ECE / Mechanical learners with EV Powertrain or Embedded coursework',
        skills: ['Embedded C', 'CAN Bus', 'MATLAB', 'BMS'],
        desc: 'Assist battery state-of-charge modeling and HIL bench validation scripts.',
        deadline: '2027-01-10',
      },
    ];

    for (const j of jobsData) {
      await query(
        `INSERT INTO job_opportunities (
          company_id, title, opportunity_type, location, work_mode, stipend_or_ctc,
          eligibility, required_skills, description, application_deadline, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN')`,
        [
          companyIds[j.company],
          j.title,
          j.type,
          j.location,
          j.workMode,
          j.ctc,
          j.eligibility,
          JSON.stringify(j.skills),
          j.desc,
          j.deadline,
        ]
      );
    }
  }

  // 5. Seed Reusable Question Bank (if empty)
  const existingQB = await queryOne('SELECT COUNT(*) AS cnt FROM question_bank');
  if (Number(existingQB?.cnt || 0) === 0 && courses.length > 0) {
    const qbItems = [
      {
        courseId: courses[0].id,
        text: 'Which regularization technique randomly zeroes neuron activations during training to reduce overfitting?',
        type: 'MCQ',
        options: ['Batch Normalization', 'Dropout', 'Gradient Clipping', 'Tokenizer Padding'],
        correctIdx: 1,
        correctAnswers: [1],
        diff: 'Easy',
        skill: 'Deep Learning',
        marks: 1,
        exp: 'Dropout prevents co-adaptation of neurons by randomly masking activations during training.',
      },
      {
        courseId: courses[0].id,
        text: 'Select all strategies that help mitigate LLM hallucinations in production systems.',
        type: 'MULTI_SELECT',
        options: ['Retrieval-Augmented Generation (RAG)', 'Lowering temperature for factual tasks', 'Removing all system prompts', 'Citing verified database chunks'],
        correctIdx: 0,
        correctAnswers: [0, 1, 3],
        diff: 'Medium',
        skill: 'Generative AI',
        marks: 2,
        exp: 'Grounding with RAG, low temperature, and source citations measurably reduce ungrounded claims.',
      },
      {
        courseId: courses[0].id,
        text: 'True or False: Increasing model parameters always guarantees lower validation loss even on tiny datasets.',
        type: 'TRUE_FALSE',
        options: ['True', 'False'],
        correctIdx: 1,
        correctAnswers: [1],
        diff: 'Easy',
        skill: 'Machine Learning',
        marks: 1,
        exp: 'False — over-parameterized models on small datasets frequently overfit without strong regularization.',
      },
      {
        courseId: courses[3]?.id || courses[0].id,
        text: 'Which SQL keyword ensures a group of statements executes atomically with commit/rollback guarantees?',
        type: 'SHORT_ANSWER',
        options: [],
        correctIdx: 0,
        correctAnswers: ['TRANSACTION', 'BEGIN'],
        diff: 'Medium',
        skill: 'PostgreSQL',
        marks: 2,
        exp: 'Database transactions (BEGIN / COMMIT / ROLLBACK) enforce ACID atomicity.',
      },
      {
        courseId: courses[3]?.id || courses[0].id,
        text: 'Which HTTP status codes represent client-side authentication or authorization errors?',
        type: 'MULTI_SELECT',
        options: ['401 Unauthorized', '403 Forbidden', '201 Created', '503 Service Unavailable'],
        correctIdx: 0,
        correctAnswers: [0, 1],
        diff: 'Easy',
        skill: 'REST Security',
        marks: 2,
        exp: '401 indicates missing/invalid credentials; 403 indicates authenticated user lacks permission.',
      },
    ];

    for (const item of qbItems) {
      await query(
        `INSERT INTO question_bank (
          course_id, created_by, question_text, question_type, options,
          correct_option_index, correct_answers, difficulty, skill_tag, marks, explanation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          item.courseId,
          instructorRow?.id || null,
          item.text,
          item.type,
          JSON.stringify(item.options),
          item.correctIdx,
          JSON.stringify(item.correctAnswers),
          item.diff,
          item.skill,
          item.marks,
          item.exp,
        ]
      );
    }
  }

  // 6. Seed Community Discussions (if empty)
  const existingDisc = await queryOne('SELECT COUNT(*) AS cnt FROM discussions');
  if (Number(existingDisc?.cnt || 0) === 0 && courses.length > 0 && studentRow && instructorRow) {
    const c0 = courses[0];
    const c3 = courses[3] || courses[0];

    const d1 = await queryOne(
      `INSERT INTO discussions (course_id, user_id, title, content, tags, likes_count, replies_count)
       VALUES ($1, $2, $3, $4, $5, 4, 1) RETURNING id`,
      [
        c0.id,
        studentRow.id,
        'Best way to evaluate chunk size for RAG document retrieval?',
        'When indexing technical PDFs for our capstone project, how should we balance 300-token vs 800-token chunks with overlap?',
        JSON.stringify(['RAG', 'Embeddings', 'Capstone']),
      ]
    );
    const r1 = await queryOne(
      `INSERT INTO discussion_replies (discussion_id, user_id, content, is_accepted, likes_count)
       VALUES ($1, $2, $3, $4, 3) RETURNING id`,
      [
        d1.id,
        instructorRow.id,
        'Start with 400–512 tokens and 15% overlap, then measure Top-5 recall on 20 real evaluation questions before tuning.',
        true,
      ]
    );
    await query('UPDATE discussions SET accepted_reply_id = $1 WHERE id = $2', [r1.id, d1.id]);

    await query(
      `INSERT INTO discussions (course_id, user_id, title, content, tags, likes_count, replies_count)
       VALUES ($1, $2, $3, $4, $5, 2, 0)`,
      [
        c3.id,
        rahulRow?.id || studentRow.id,
        'PostgreSQL indexing strategy for multi-filter course search?',
        'Should we create separate B-Tree indexes on category_id and status or a composite index?',
        JSON.stringify(['PostgreSQL', 'Indexing', 'Performance']),
      ]
    );
  }

  // 7. Seed Demo Student Baseline Gamification (XP, Streak, Roadmap) only if empty
  if (studentRow) {
    const existingPts = await queryOne('SELECT COUNT(*) AS cnt FROM student_points WHERE user_id = $1', [studentRow.id]);
    if (Number(existingPts?.cnt || 0) === 0) {
      const pointsEntries = [
        ['COURSE_COMPLETE', 'SEED_COURSE_4', 200, 'Completed Full Stack Software Engineering program'],
        ['MODULE', 'SEED_MOD_1', 50, 'Completed Module 1: Core Foundations'],
        ['LESSON', 'SEED_LES_1', 10, 'Completed lesson: Industry Landscape & Engineering Setup'],
        ['LESSON', 'SEED_LES_2', 10, 'Completed lesson: Core Mechanics'],
        ['QUIZ_PASS', 'SEED_QUIZ_1', 30, 'Passed Core Readiness Assessment'],
      ];
      for (const [type, key, pts, desc] of pointsEntries) {
        await query(
          `INSERT INTO student_points (user_id, event_type, event_key, points, description)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [studentRow.id, type, key, pts, desc]
        );
      }

      const today = new Date().toISOString().slice(0, 10);
      await query(
        `INSERT INTO learning_streaks (user_id, current_streak, longest_streak, last_activity_date, weekly_goal_minutes, weekly_minutes_done, week_start_date)
         VALUES ($1, 5, 7, $2, 180, 145, $2) ON CONFLICT DO NOTHING`,
        [studentRow.id, today]
      );

      // Unlock 3 starter badges for Demo Student
      const starterCodes = ['FIRST_LESSON', 'MODULE_FINISHER', 'COURSE_GRADUATE'];
      for (const code of starterCodes) {
        const ach = await queryOne('SELECT id FROM achievements WHERE code = $1', [code]);
        if (ach) {
          await query(
            `INSERT INTO student_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [studentRow.id, ach.id]
          );
        }
      }

      // Enroll Demo Student in AI & ML Roadmap
      const rm = await queryOne("SELECT id FROM career_roadmaps WHERE slug = 'ai-ml-engineer'");
      if (rm) {
        const firstStep = await queryOne('SELECT id FROM roadmap_steps WHERE roadmap_id = $1 ORDER BY step_order ASC LIMIT 1', [rm.id]);
        await query(
          `INSERT INTO student_roadmaps (user_id, roadmap_id, completed_step_ids, progress_percent, is_primary)
           VALUES ($1, $2, $3, 25, $4) ON CONFLICT DO NOTHING`,
          [studentRow.id, rm.id, JSON.stringify(firstStep ? [firstStep.id] : []), true]
        );
      }
    }

    if (rahulRow) {
      const rahulPts = await queryOne('SELECT COUNT(*) AS cnt FROM student_points WHERE user_id = $1', [rahulRow.id]);
      if (Number(rahulPts?.cnt || 0) === 0) {
        await query(
          `INSERT INTO student_points (user_id, event_type, event_key, points, description)
           VALUES ($1, 'MODULE', 'SEED_RAHUL_M1', 50, 'Completed Module 1'), ($1, 'LESSON', 'SEED_RAHUL_L1', 10, 'Completed Lesson 1') ON CONFLICT DO NOTHING`,
          [rahulRow.id]
        );
        const today = new Date().toISOString().slice(0, 10);
        await query(
          `INSERT INTO learning_streaks (user_id, current_streak, longest_streak, last_activity_date, weekly_goal_minutes, weekly_minutes_done, week_start_date)
           VALUES ($1, 2, 4, $2, 150, 75, $2) ON CONFLICT DO NOTHING`,
          [rahulRow.id, today]
        );
      }
    }
  }

  // 8. Ensure 3 Free Introductory Courses exist (with starter modules, lessons, and quiz)
  for (const fc of FREE_INTRO_COURSES_SEED) {
    const existingCourse = await queryOne('SELECT id FROM courses WHERE slug = $1', [fc.slug]);
    if (!existingCourse) {
      const catRow = await queryOne('SELECT id FROM course_categories WHERE slug = $1', [fc.categorySlug]);
      const instRow = await queryOne('SELECT id FROM users WHERE email = $1', [fc.instructorEmail]);
      if (!catRow) continue;

      const created = await queryOne(
        `INSERT INTO courses (
          title, slug, short_summary, description, category_id, instructor_id, thumbnail_url,
          technologies, skill_level, duration, duration_weeks, course_fee, advance_amount, full_amount,
          learning_outcomes, internship_available, internship_details, faqs, status, featured, rating_avg, enrolled_count, live_session_info
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'PUBLISHED',$19,4.9,320,$20)
        RETURNING id`,
        [
          fc.title,
          fc.slug,
          fc.shortSummary,
          fc.description,
          catRow.id,
          instRow?.id || null,
          fc.thumbnailUrl,
          JSON.stringify(fc.technologies),
          fc.skillLevel,
          fc.duration,
          fc.durationWeeks,
          0,
          0,
          0,
          JSON.stringify(fc.outcomes),
          true,
          fc.internshipDetails,
          JSON.stringify([
            { q: 'Is this introductory course completely free?', a: 'Yes. Enroll free with your SkillNova learner account to unlock all modules, interactive labs, quizzes, and a starter certificate.' },
          ]),
          false,
          'Self-Paced + Weekly Open Office Hours',
        ]
      );

      if (created?.id) {
        const mod1 = await queryOne(
          `INSERT INTO course_modules (course_id, title, description, module_order)
           VALUES ($1, 'Module 1: Core Foundations & Environment', 'Zero-setup browser & local walkthrough of core concepts.', 1) RETURNING id`,
          [created.id]
        );
        const mod2 = await queryOne(
          `INSERT INTO course_modules (course_id, title, description, module_order)
           VALUES ($1, 'Module 2: Hands-On Mini Project Lab', 'Apply fundamentals to a practical industry micro-project.', 2) RETURNING id`,
          [created.id]
        );

        await query(
          `INSERT INTO lessons (course_id, module_id, title, lesson_type, content, duration_minutes, lesson_order, is_free_preview)
           VALUES
           ($1, $2, 'Getting Started & Core Mental Models', 'VIDEO', 'Structured orientation covering core syntax, tooling setup, and problem decomposition.', 18, 1, $4),
           ($1, $2, 'Interactive Lab: Core Exercises', 'LAB', 'Complete 3 guided exercises and validate output against sample test cases.', 28, 2, $4),
           ($1, $3, 'Guided Mini Capstone Build', 'LAB', 'Build and test your first mini engineering deliverable step by step.', 35, 3, $4)`,
          [created.id, mod1.id, mod2.id, true]
        );

        const qz = await queryOne(
          `INSERT INTO quizzes (course_id, title, description, passing_score, time_limit_minutes)
           VALUES ($1, 'Launchpad Readiness Check', 'Verify core concepts from this free track.', 60, 10) RETURNING id`,
          [created.id]
        );
        if (qz?.id) {
          await query(
            `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_option_index, correct_answers, difficulty, skill_tag, marks, explanation, question_order)
             VALUES ($1, 'What accelerates engineering mastery most effectively in SkillNova tracks?', 'MCQ', $2, 1, '[1]', 'Easy', 'Foundations', 1, 'Hands-on building paired with testing cements practical engineering skill.', 1)`,
            [qz.id, JSON.stringify(['Memorizing slides passively', 'Building hands-on projects with tests', 'Skipping fundamentals', 'Avoiding code reviews'])]
          );
        }
      }
    }
  }

  // 9. Upgrade legacy default hero copy if unchanged by admin
  await query(
    `UPDATE site_settings SET setting_value = 'Learn Skills. Build Careers. Shape Your Future.'
     WHERE setting_key = 'hero_headline' AND setting_value = 'Master Engineering Skills Built for Real Industry Careers'`
  );
  await query(
    `UPDATE site_settings SET setting_value = 'Explore practical courses, learn from anywhere, and build the skills that move your career forward.'
     WHERE setting_key = 'hero_subheadline' AND setting_value LIKE '45+ mentor-led programs across AI%'`
  );
}
