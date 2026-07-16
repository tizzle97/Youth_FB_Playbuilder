import React from 'react';

/**
 * Shared shell for legal/document pages (/privacy, /terms). Keeps the
 * long-form typography consistent: readable measure, clear section
 * hierarchy, chalk-on-navy like the rest of the app.
 */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-board">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-chalk mb-2">{title}</h1>
        <p className="text-sm text-chalk/50 mb-10">Effective date: {effectiveDate}</p>
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-chalk mb-3">{heading}</h2>
      <div className="space-y-3 text-chalk/80 leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
