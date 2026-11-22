import React, { useState } from 'react';
import { CheckCircle2, Download, Search, XCircle } from 'lucide-react';
import { Button, Card, SectionHeading } from '../../components/DesignSystem.jsx';
import { api } from '../../services/api.js';
import { downloadCertificatePdf, formatDate } from '../../utils/formatters.js';

export default function VerifyCertificatePage() {
  const [code, setCode] = useState('SN-CERT-2026-8842');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get(`/certificates/verify/${encodeURIComponent(code.trim())}`);
      setResult(res.data.certificate);
    } catch {
      setError('No valid SKILLNOVA certificate matches that ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeading
        align="center"
        eyebrow="CREDENTIAL VERIFICATION"
        title="Verify a SKILLNOVA Certificate"
        subtitle="Enter a certificate ID (try sample ID SN-CERT-2026-8842) to confirm authenticity directly against our database."
      />

      <Card className="p-6 mt-8">
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SN-CERT-2026-8842"
              className="w-full pl-10 pr-3 py-2.5 font-mono text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          <Button type="submit" loading={loading}>
            Verify Certificate
          </Button>
        </form>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-6 p-6 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2.5 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verified Authentic Credential</span>
              </div>
              <Button size="sm" variant="navy" onClick={() => downloadCertificatePdf(result)}>
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>

            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-emerald-200/80 pt-4">
              <div>
                <dt className="text-xs text-slate-500">Certificate ID</dt>
                <dd className="font-mono font-bold text-slate-900 mt-0.5">{result.certificate_code}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Recipient</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{result.student_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Program Completed</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{result.course_title}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Standing & Issue Date</dt>
                <dd className="text-slate-900 mt-0.5">
                  {result.grade} · {formatDate(result.issued_at)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Card>
    </div>
  );
}
