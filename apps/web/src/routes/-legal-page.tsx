import { Link } from '@tanstack/react-router';
import { Mountain } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared shell for the public legal pages (/privacy, /terms). Content is
 * bundled English-only — legal wording is not translated without review.
 * These pages describe the SOFTWARE (self-hosted); the instance operator is
 * the data controller for whatever runs on their deployment.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  readonly title: string;
  readonly updated: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Mountain className="h-5 w-5" aria-hidden="true" />
            Debt Master
          </Link>
        </div>
      </header>
      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
          <div className="mt-8 space-y-8 text-sm leading-6 text-foreground/90">{children}</div>
        </div>
      </div>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground hover:underline">
          ← debtmaster
        </Link>
      </footer>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export const LEGAL_LAST_UPDATED = 'September 14, 2026';
