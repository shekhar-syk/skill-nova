import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  GraduationCap,
  Layers,
  Terminal,
  UserCheck,
} from 'lucide-react';
import { Button, Card, CourseThumbnail, Loader, SectionHeading } from '../../components/DesignSystem.jsx';
import HeroMotionVideo from '../../components/HeroMotionVideo.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [popularCourses, setPopularCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cms, setCms] = useState({ testimonials: [], faqs: [], settings: {}, stats: {} });
  const [openFaq, setOpenFaq] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [featRes, popRes, catRes, cmsRes] = await Promise.all([
          api.get('/courses?featured=true&limit=6'),
          api.get('/courses?sort=popular&limit=6'),
          api.get('/categories'),
          api.get('/public/cms'),
        ]);
        if (!active) return;
        setFeaturedCourses(featRes.data.courses || []);
        setPopularCourses(popRes.data.courses || []);
        setCategories(catRes.data.categories || []);
        setCms({
          testimonials: cmsRes.data.testimonials || [],
          faqs: cmsRes.data.faqs || [],
          settings: cmsRes.data.settings || {},
          stats: cmsRes.data.stats || {},
        });
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const prefersReducedMotion = useReducedMotion();

  const heroHeadline =
    cms.settings.hero_headline || 'Learn Skills. Build Careers. Shape Your Future.';
  const heroSub =
    cms.settings.hero_subheadline ||
    'Explore practical courses, learn from anywhere, and build the skills that move your career forward.';

  return (
    <div>
      {/* Full-Bleed Responsive Hero with Looping Background Video */}
      <section className="relative overflow-hidden bg-[#0A0F24] text-white border-b border-slate-800">
        {/* Background Video & Fallback Image Layer (z-0, pointer-events-none) */}
        <HeroMotionVideo variant="background" />

        {/* Subtle ambient violet radial accents (compositor-safe, non-blocking) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -left-24 z-[1] w-96 h-96 rounded-full bg-violet-700/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-0 z-[1] w-[26rem] h-[26rem] rounded-full bg-indigo-600/15 blur-3xl"
        />

        {/* Foreground Content & Primary Conversion Layer (z-10) */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl"
          >
            {cms.settings.announcement_banner && (
              <p className="text-xs sm:text-sm font-medium text-violet-300 mb-4 tracking-wide">
                {cms.settings.announcement_banner}
              </p>
            )}

            <h1 className="font-display text-[clamp(2.25rem,4.4vw,3.75rem)] font-extrabold tracking-tight text-white leading-[1.08] text-balance">
              {heroHeadline}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
              {heroSub}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <Button
                size="lg"
                variant="primary"
                className="min-h-[46px]"
                onClick={() => navigate('/courses?free=true')}
              >
                Explore Free Courses
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="light"
                className="min-h-[46px]"
                onClick={() => navigate('/courses')}
              >
                Explore All Courses
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <Link
                to="/courses"
                className="font-medium text-white hover:text-violet-200 underline underline-offset-4 transition-colors"
              >
                Browse {cms.stats.totalCourses || 45}+ professional courses
              </Link>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <Link
                to="/roadmaps"
                className="font-medium text-violet-300 hover:text-violet-200 underline underline-offset-4 transition-colors"
              >
                Explore Career Roadmaps
              </Link>
            </div>
          </motion.div>

          {/* 4-Column Statistics Strip */}
          <div className="mt-12 lg:mt-16 pt-8 border-t border-white/15 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {cms.stats.totalCourses || 45}+
              </p>
              <p className="text-sm text-slate-300 mt-1">Professional Engineering Courses</p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {cms.stats.totalCategories || 15}
              </p>
              <p className="text-sm text-slate-300 mt-1">Specialized Tech Domains</p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">80 / 20</p>
              <p className="text-sm text-slate-300 mt-1">Hands-On Lab to Theory Ratio</p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {Number(cms.stats.totalCohortSeats || 5400).toLocaleString('en-IN')}+
              </p>
              <p className="text-sm text-slate-300 mt-1">Cohort Learners Trained</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Learning Programmes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <SectionHeading
            eyebrow="Featured Learning Programmes"
            title="Flagship Cohorts Designed with Industry Architects"
            subtitle="Structured multi-month tracks combining live mentor instruction, capstone builds, and internship readiness."
          />
          <Link to="/courses" className="text-sm font-semibold text-violet-700 hover:text-violet-800 whitespace-nowrap">
            View all {cms.stats.totalCourses || 45} courses →
          </Link>
        </div>

        {loading ? (
          <Loader label="Loading featured courses..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCourses.map((course) => (
              <Card key={course.id} hover className="overflow-hidden flex flex-col">
                <Link to={`/courses/${course.slug}`} className="block">
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full h-48" />
                </Link>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-xs text-slate-500 font-medium">
                    {course.categoryName} · {course.skillLevel} · {course.duration}
                  </p>
                  <Link
                    to={`/courses/${course.slug}`}
                    className="mt-2 font-display text-lg font-bold text-slate-900 hover:text-violet-700 transition-colors line-clamp-2"
                  >
                    {course.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2 flex-1">{course.shortSummary}</p>
                  <p className="mt-3 font-mono text-xs text-slate-500 truncate">
                    {course.technologies.slice(0, 4).join(' · ')}
                  </p>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatINR(course.courseFee)}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Advance from {formatINR(course.advanceAmount)}
                      </p>
                    </div>
                    <Button size="sm" variant="navy" onClick={() => navigate(`/courses/${course.slug}`)}>
                      View Syllabus
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 15 Technology Categories */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Technology Categories"
            title="15 Specialized Engineering & Design Disciplines"
            subtitle="Every category houses curated beginner, intermediate, and advanced cohorts backed by structured industry curriculum."
          />

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, idx) => (
              <Link
                key={cat.id}
                to={`/courses?category=${cat.slug}`}
                className="group p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-violet-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
                    <span>{String(idx + 1).padStart(2, '0')}</span>
                    <span>{cat.courseCount} courses</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{cat.description}</p>
                </div>
                <span className="mt-4 text-xs font-semibold text-violet-700 group-hover:underline">
                  Explore track →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose SkillNova & 80/20 Learning Methodology */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow="Why Choose SkillNova"
              title="80% Practical Engineering. 20% Focused Theory."
              subtitle="Passive video playlists rarely survive real technical interviews. Every SkillNova track pairs concise theory briefings with production labs, code reviews, and capstone delivery."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => navigate('/learning-approach')}>
                Explore Learning Approach
              </Button>
              <Button variant="secondary" onClick={() => navigate('/contact')}>
                Speak with a Counsellor
              </Button>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: Terminal,
                title: '01. Hands-On Coding & Hardware Labs',
                desc: 'Weekly build sprints covering real REST APIs, cloud clusters, ML pipelines, or Simulink EV models.',
              },
              {
                icon: Code2,
                title: '02. Mentor-Led Code & Design Reviews',
                desc: 'Senior practitioners from product and R&D teams review your architecture, naming, and edge-case tests.',
              },
              {
                icon: Briefcase,
                title: '03. Integrated Internship Tracks',
                desc: 'Apply your cohort knowledge in 4-to-8 week structured capstone internships with verifiable credentials.',
              },
              {
                icon: UserCheck,
                title: '04. Mock Interviews & Career Calibration',
                desc: 'Structured DSA, system design, portfolio storytelling, and behavioral interview preparation.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-6">
                  <Icon className="w-5 h-5 text-violet-700 mb-3" />
                  <h3 className="font-display text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Courses Strip */}
      <section className="bg-slate-100/80 border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <SectionHeading
              eyebrow="Popular This Cohort"
              title="Highest-Enrolled Programs Across Learners"
            />
            <Link to="/courses?sort=popular" className="text-sm font-semibold text-violet-700 hover:text-violet-800">
              Browse popular tracks →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularCourses.slice(0, 3).map((c) => (
              <Card key={c.id} hover className="p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {c.categoryName} · {c.duration}
                  </p>
                  <Link
                    to={`/courses/${c.slug}`}
                    className="mt-2 block font-display text-base font-bold text-slate-900 hover:text-violet-700"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">{c.shortSummary}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(c.courseFee)}</span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{c.enrolledCount} learners</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mentors & Career Preparation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading
          eyebrow="Faculty & Mentorship"
          title="Learn Directly from Builders & Engineering Leads"
          subtitle="Our instructors bring real production architecture, cloud security, product design, and EV R&D experience into every session."
        />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              name: 'Dr. Vikram Aditya',
              role: 'Principal AI & ML Architect',
              bg: 'Ex-DeepMind & Microsoft Research · 11 yrs',
              focus: 'Applied ML, LLMs, Python Systems',
            },
            {
              name: 'Priya Nair',
              role: 'Staff Cloud Security & DevOps Lead',
              bg: 'Ex-AWS & Cloudflare · 9 yrs',
              focus: 'Kubernetes, Terraform, AppSec',
            },
            {
              name: 'Arjun Mehta',
              role: 'Director of Systems & EV Mobility',
              bg: 'Ex-Bosch Mobility & Atlassian · 12 yrs',
              focus: 'Full Stack, Java, EV Powertrains',
            },
            {
              name: 'Elena Rostova',
              role: 'Principal Design Systems Architect',
              bg: 'Ex-Figma Partner Studio & Stripe · 10 yrs',
              focus: 'UI/UX Systems, React, WebGL',
            },
          ].map((m) => (
            <Card key={m.name} className="p-6">
              <div className="w-11 h-11 rounded-full bg-[#0A0F24] text-white font-display font-bold flex items-center justify-center text-sm mb-4">
                {m.name
                  .split(' ')
                  .filter((p) => !p.includes('.'))
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')}
              </div>
              <h3 className="font-display text-base font-bold text-slate-900">{m.name}</h3>
              <p className="text-sm font-medium text-violet-700 mt-0.5">{m.role}</p>
              <p className="text-xs text-slate-500 mt-2">{m.bg}</p>
              <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">{m.focus}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Student Success Stories */}
      <section className="bg-[#0A0F24] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-violet-400 mb-2">Student Success Stories</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Verified Career Outcomes Across Software & Core Engineering
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {cms.testimonials.map((t) => (
              <div key={t.id} className="p-6 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="font-mono text-xs text-violet-300 mb-3">{t.outcomeMetric}</p>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">“{t.quote}”</p>
                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-sm font-bold text-white">{t.studentName}</p>
                    <p className="text-xs text-slate-400">
                      {t.roleTitle} · {t.companyName}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 text-right max-w-[200px] truncate">{t.courseTitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading
          align="center"
          eyebrow="Frequently Asked Questions"
          title="Everything You Need to Know Before Enrolling"
        />

        <div className="mt-10 space-y-3">
          {cms.faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-slate-50"
                >
                  <span className="font-display text-sm sm:text-base font-semibold text-slate-900">
                    {faq.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact & Enquiry CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="rounded-2xl bg-violet-700 text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to Build Your Engineering Career with SKILLNOVA?
            </h2>
            <p className="mt-3 text-violet-100 text-base">
              Apply directly for an upcoming cohort with flexible advance reservation, or request a 1-on-1 syllabus walkthrough.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Button variant="light" size="lg" onClick={() => navigate('/admission')}>
              Apply for Admission
            </Button>
            <Button
              variant="navy"
              size="lg"
              onClick={() => navigate('/contact')}
            >
              Submit Enquiry
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
