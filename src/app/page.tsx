import Link from "next/link";
import { HardHat, MessageSquare, FileText, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <HardHat className="h-6 w-6" />
          <span className="text-lg font-bold">ConstructAI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <h1 className="max-w-3xl text-center text-4xl font-bold tracking-tight sm:text-5xl">
          Turn conversations into
          <br />
          professional documents
        </h1>
        <p className="mt-4 max-w-xl text-center text-lg text-muted-foreground">
          ConstructAI helps contractors create estimates, change orders, and
          invoices using natural language. Just describe the job — AI handles the
          paperwork.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-20 grid max-w-4xl gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <MessageSquare className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Talk, Don&apos;t Type</h3>
            <p className="text-sm text-muted-foreground">
              Describe your project in plain English. AI extracts line items,
              quantities, and pricing from your service catalog.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <FileText className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Estimates to Invoices</h3>
            <p className="text-sm text-muted-foreground">
              From first estimate to final invoice, every document stays
              connected. Change orders automatically track cost impact.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <HardHat className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 font-semibold">Built for Contractors</h3>
            <p className="text-sm text-muted-foreground">
              Your service catalog, your rates, your terms. AI learns how you
              price jobs and generates documents your way.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        ConstructAI — AI-powered business documents for contractors
      </footer>
    </div>
  );
}
