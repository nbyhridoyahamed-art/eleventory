import Link from "next/link";

import { HELP_ARTICLES } from "@/lib/help-articles";

export const metadata = { title: "Help centre", description: "Step-by-step guides for running your store." };

export default function HelpIndexPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help centre</h1>
        <p className="text-text-secondary">Short guides for the things shop owners do most.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {HELP_ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link href={`/help/${article.slug}`} className="block h-full rounded-lg border border-border bg-surface p-5 hover:border-primary">
              <div className="font-semibold">{article.title}</div>
              <div className="mt-1 text-sm text-text-secondary">{article.summary}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
