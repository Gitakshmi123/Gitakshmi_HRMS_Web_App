import React from 'react';
import { ShieldCheck } from 'lucide-react';
import logonew from '../../assets/logonew.png';

const DEFAULT_FULLPAGE_SUBTITLE = 'Preparing your secure workspace and syncing access for a smooth start.';
const DEFAULT_FULLPAGE_HINT = 'Validating session, loading permissions, and getting your dashboard ready.';

export default function Loader({
  fullPage = false,
  text = 'Loading',
  title,
  subtitle,
  hint,
  footer = null,
}) {
  const resolvedTitle = title || text;
  const resolvedSubtitle = subtitle || (fullPage ? DEFAULT_FULLPAGE_SUBTITLE : '');
  const resolvedHint = hint || (fullPage ? DEFAULT_FULLPAGE_HINT : '');

  const compactContent = (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-[22px] border border-slate-200 bg-white/50 backdrop-blur-sm" />
        <div className="absolute inset-0 rounded-[22px] border-[3px] border-transparent border-t-indigo-500 border-r-sky-400 animate-spin" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <img src="/favicon.png" alt="Gitakshmi HRMS" className="h-7 w-7 object-contain" />
        </div>
      </div>
    </div>
  );

  if (!fullPage) {
    return <div className="flex items-center justify-center p-8">{compactContent}</div>;
  }

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(59,130,246,0.12), transparent 28%), radial-gradient(circle at 100% 100%, rgba(99,102,241,0.14), transparent 30%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative z-10">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-200/40 blur-2xl animate-pulse" />
          <div className="absolute inset-0 rounded-full border border-indigo-100/50 bg-white/40 backdrop-blur-sm" />
          <div className="absolute inset-[10px] rounded-full border-2 border-sky-100/50" />
          <div className="absolute inset-[6px] rounded-full border-[3px] border-transparent border-t-indigo-500 border-r-sky-400 animate-spin" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-[0_14px_32px_-14px_rgba(79,70,229,0.55)] ring-1 ring-slate-100">
            <img src="/favicon.png" alt="Gitakshmi HRMS" className="h-12 w-12 object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
}
