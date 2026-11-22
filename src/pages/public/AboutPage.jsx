import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SectionHeading } from '../../components/DesignSystem.jsx';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div>
      <section className="bg-[#0A0F24] text-white py-16 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-xs text-violet-300 mb-3">ABOUT SKILLNOVA</p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl text-balance">
            Engineering Education Built Around Real Production Craft
          </h1>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl leading-relaxed">
            Learn Skills. Build Careers. Shape Your Future. SKILLNOVA bridges the gap between academic theory and modern software, cloud, AI, and EV engineering teams.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8">
          <p className="font-mono text-xs text-violet-700 mb-2">OUR MISSION</p>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Make Practical Engineering Mentorship Accessible Globally
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            We exist to eliminate passive slide-driven training. Every learner at SKILLNOVA writes real code, designs real architectures, defends engineering trade-offs with mentors, and graduates with verifiable project evidence.
          </p>
        </Card>

        <Card className="p-8">
          <p className="font-mono text-xs text-violet-700 mb-2">OUR VISION</p>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            The Benchmark Credential for Career-Ready Builders
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            When an employer verifies a SKILLNOVA credential, they know the candidate shipped production capstones, passed timed assessments, and completed live technical mock interviews.
          </p>
        </Card>
      </section>

      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="PHILOSOPHY & METHODOLOGY"
            title="Four Pillars Behind Every SKILLNOVA Cohort"
          />
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'Practical Learning Approach',
                text: '80% of cohort hours go directly into guided coding labs, system simulations, and pull requests.',
              },
              {
                num: '02',
                title: 'Mentor-Led Education',
                text: 'Live sessions led by principal engineers and R&D architects—never pre-recorded slides alone.',
              },
              {
                num: '03',
                title: 'Training & Internships',
                text: 'Structured 4-to-8 week capstone sprints simulating agile product and engineering teams.',
              },
              {
                num: '04',
                title: 'Career Development',
                text: 'Portfolio storytelling, GitHub curation, ATS resume reviews, and 1-on-1 mock technical panels.',
              },
            ].map((p) => (
              <Card key={p.num} className="p-6">
                <p className="font-mono text-xs font-bold text-violet-700">{p.num}</p>
                <h3 className="font-display text-base font-bold text-slate-900 mt-2">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Admissions & Campus Contact</h2>
          <p className="mt-2 text-sm text-slate-600">
            Level 7, Prestige Tech Park, Outer Ring Road, Bengaluru 560103 · admissions@skillnova.edu · +91 80 4192 8800
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/courses')}>Explore 45+ Courses</Button>
          <Button onClick={() => navigate('/contact')}>Contact Admissions</Button>
        </div>
      </section>
    </div>
  );
}
