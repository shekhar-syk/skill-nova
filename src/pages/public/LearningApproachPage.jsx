import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SectionHeading } from '../../components/DesignSystem.jsx';

export default function LearningApproachPage() {
  const navigate = useNavigate();

  const stages = [
    {
      step: '01. Live Instructor Briefings (20% Theory)',
      detail:
        'Focused interactive sessions establish mental models, architectural trade-offs, and first-principles engineering concepts without bloated slide decks.',
    },
    {
      step: '02. Hands-On Coding & Engineering Labs (80% Practice)',
      detail:
        'Learners immediately build REST APIs, ML pipelines, cloud Terraform modules, Figma systems, or EV Simulink models inside guided weekly labs.',
    },
    {
      step: '03. Mentor-Led Code & Design Reviews',
      detail:
        'Senior engineers inspect your code modularity, edge-case validation, database indexing, and test coverage—teaching real industry engineering standards.',
    },
    {
      step: '04. Portfolio & Capstone Projects',
      detail:
        'Every track culminates in production-deployed portfolio projects complete with architecture documentation and demo walkthroughs.',
    },
    {
      step: '05. Mock Interviews & Career Preparation',
      detail:
        'Targeted technical mock rounds, system design whiteboarding, resume calibration, and direct placement readiness scoring.',
    },
    {
      step: '06. Personalized Learning Support',
      detail:
        'Midweek doubt-clearing office hours, progress tracking in your LMS dashboard, and counselor follow-ups keep every student on schedule.',
    },
  ];

  return (
    <div>
      <section className="bg-[#0A0F24] text-white py-16 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-xs text-violet-300 mb-3">LEARNING METHODOLOGY</p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl text-balance">
            80% Practical Implementation. 20% Focused Conceptual Theory.
          </h1>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl leading-relaxed">
            Built for engineers and designers who learn by shipping real systems, receiving honest mentor reviews, and practicing technical interviews.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <SectionHeading
            eyebrow="THE SKILLNOVA CADENCE"
            title="From First Lab to Verifiable Career Credential"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((s) => (
            <Card key={s.step} className="p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">{s.step}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{s.detail}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-xl font-bold">Experience the 80/20 Cohort Model</h3>
            <p className="mt-1 text-sm text-slate-300">Browse all 45 courses or speak with an academic advisor today.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="light" onClick={() => navigate('/courses')}>Explore Catalogue</Button>
            <Button onClick={() => navigate('/admission')}>Apply Now</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
