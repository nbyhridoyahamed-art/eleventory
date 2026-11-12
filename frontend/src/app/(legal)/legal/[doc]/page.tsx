import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { COMPANY, getLegalDoc, LEGAL_DOCS, LEGAL_VERSION } from "@/lib/legal-docs";

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const doc = getLegalDoc((await params).doc);

  return doc ? { title: doc.title, description: doc.summary } : {};
}

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = getLegalDoc((await params).doc);
  if (!doc) notFound();

  return (
    <article className="space-y-6">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-text-primary">
        <strong>Draft for legal review.</strong> This text is a template that describes how the platform works. It has not been reviewed by a
        lawyer and contains [bracketed] placeholders such as {COMPANY.name}. Do not launch with it unreviewed.
      </div>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="text-sm text-text-secondary">
          {doc.summary} Version {LEGAL_VERSION}.
        </p>
      </header>
      {doc.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="leading-relaxed text-text-secondary">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
