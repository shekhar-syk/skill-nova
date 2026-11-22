import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import CampusMapHub from '../../components/CampusMapHub.jsx';
import { SectionHeading } from '../../components/DesignSystem.jsx';

export default function CampusMapPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <SectionHeading
          eyebrow="CAMPUSES & TECH ECOSYSTEM"
          title="SKILLNOVA Learning Campuses & Tech Hub Explorer"
          subtitle="Explore our hybrid engineering labs across Bengaluru, Hyderabad, Pune, and Delhi NCR, calculate live routes, and discover nearby transit and study hubs."
        />
        <Link
          to="/admission"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shrink-0 self-start"
        >
          <MapPin className="w-4 h-4" /> Apply for Hybrid Cohort <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <CampusMapHub />
    </div>
  );
}
