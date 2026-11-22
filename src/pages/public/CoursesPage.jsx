import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { Button, Card, CourseThumbnail, Loader, SectionHeading } from '../../components/DesignSystem.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export default function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [duration, setDuration] = useState(searchParams.get('duration') || '');
  const [freeOnly, setFreeOnly] = useState(searchParams.get('free') === 'true');
  const [sort, setSort] = useState(searchParams.get('sort') || 'featured');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  useEffect(() => {
    setFreeOnly(searchParams.get('free') === 'true');
    setCategory(searchParams.get('category') || '');
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (category) params.set('category', category);
        if (level) params.set('level', level);
        if (duration) params.set('duration', duration);
        if (freeOnly) params.set('free', 'true');
        if (sort) params.set('sort', sort);
        params.set('page', String(page));
        params.set('limit', '9');

        const res = await api.get(`/courses?${params.toString()}`);
        if (!active) return;
        setCourses(res.data.courses || []);
        setPagination(res.data.pagination || { total: 0, page: 1, totalPages: 1 });
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, category, level, duration, freeOnly, sort, page]);

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setLevel('');
    setDuration('');
    setFreeOnly(false);
    setSort('featured');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200">
        <SectionHeading
          eyebrow="DYNAMIC COURSE CATALOGUE"
          title="Explore 45+ Industry-Aligned Engineering Courses"
          subtitle="Search by course title or technology stack, filter across 15 engineering tracks, and enroll with flexible advance payments."
        />
        <p className="font-mono text-sm text-slate-600 tabular-nums shrink-0">
          {pagination.total} programs found
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 sm:p-5 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title or technology (e.g. PyTorch, React, BMS)..."
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="">All 15 Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by skill level"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by duration"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="">Any Duration</option>
              <option value="short">8–10 Weeks</option>
              <option value="medium">12–14 Weeks</option>
              <option value="long">16–24 Weeks</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Sort courses"
              className="w-full px-2.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="featured">Featured</option>
              <option value="popular">Popular</option>
              <option value="price_asc">Price: Low</option>
              <option value="price_desc">Price: High</option>
            </select>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !freeOnly;
                setFreeOnly(next);
                setPage(1);
                const nextParams = new URLSearchParams(searchParams);
                if (next) nextParams.set('free', 'true');
                else nextParams.delete('free');
                setSearchParams(nextParams);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                freeOnly
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {freeOnly ? 'Showing Free Courses Only' : 'Free Intro Courses Only'}
            </button>
            {(search || category || level || duration || freeOnly || sort !== 'featured') && (
              <span className="text-slate-500 hidden sm:flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Active filters
              </span>
            )}
          </div>
          {(search || category || level || duration || freeOnly || sort !== 'featured') && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-violet-700 font-semibold hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </Card>

      {/* Course Grid */}
      <div className="mt-8">
        {loading ? (
          <Loader label="Fetching courses from PostgreSQL..." />
        ) : courses.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-lg font-bold text-slate-900">No matching courses found</h3>
            <p className="mt-2 text-sm text-slate-600">
              Try clearing one of your active technology or category filters.
            </p>
            <Button className="mt-5" onClick={resetFilters}>
              Show All Courses
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} hover className="overflow-hidden flex flex-col">
                <Link to={`/courses/${course.slug}`} className="block">
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full h-44" />
                </Link>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-xs text-slate-500 font-medium">
                    {course.categoryName} · {course.skillLevel} · {course.duration}
                  </p>
                  <Link
                    to={`/courses/${course.slug}`}
                    className="mt-2 font-display text-lg font-bold text-slate-900 hover:text-violet-700 line-clamp-2"
                  >
                    {course.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2 flex-1">{course.shortSummary}</p>
                  <p className="mt-3 font-mono text-xs text-slate-500 truncate">
                    {course.technologies.join(' · ')}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {course.courseFee === 0 ? (
                        <>
                          <p className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                            Free · ₹0
                          </p>
                          <p className="text-xs text-slate-500">Full self-paced access</p>
                        </>
                      ) : (
                        <>
                          <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                            {formatINR(course.courseFee)}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            Advance: {formatINR(course.advanceAmount)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/contact?course=${encodeURIComponent(course.title)}&courseId=${course.id}`)}
                      >
                        Enquire
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          course.courseFee === 0
                            ? navigate(`/courses/${course.slug}`)
                            : navigate(`/admission?courseId=${course.id}`)
                        }
                      >
                        {course.courseFee === 0 ? 'Start Free' : 'Enroll'}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          {Array.from({ length: pagination.totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => setPage(pNum)}
                className={`w-9 h-9 rounded-lg font-mono text-xs font-semibold cursor-pointer ${
                  page === pNum
                    ? 'bg-[#0A0F24] text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pNum}
              </button>
            );
          })}
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
