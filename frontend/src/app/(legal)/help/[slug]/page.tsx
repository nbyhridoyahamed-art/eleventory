import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getHelpArticle, HELP_ARTICLES } from "@/lib/help-articles";

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getHelpArticle((await params).slug);

  return article ? { title: article.title, description: article.summary } : {};
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getHelpArticle((await params).slug);
  if (!article) notFound();

  return (
    <article className="space-y-6">
      <Link href="/help" className="text-sm text-primary hover:underline">
        ← All guides
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
        <p className="text-text-secondary">{article.summary}</p>
      </header>
      <ol className="list-decimal space-y-3 pl-6 leading-relaxed text-text-secondary">
        {article.steps.map((step) => (
          <li key={step.slice(0, 40)}>{step}</li>
        ))}
      </ol>
      {article.link ? (
        <Link href={article.link.href} className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          {article.link.label}
        </Link>
      ) : null}
    </article>
  );
}
