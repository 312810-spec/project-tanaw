import Link from "next/link";
import { ReadinessReview } from "@/app/components/readiness-review";

export const metadata = {
  title: "Evidence review",
  description: "Read-only SMEA evidence readiness foundation",
};

export default function EvidenceReviewPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 text-foreground">
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to TANAW
      </Link>
      <p className="mt-10 font-mono text-xs uppercase tracking-[0.18em] text-foreground/60">
        School MEA · Foundation preview
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Evidence readiness
      </h1>
      <p className="mt-3 mb-8 max-w-2xl text-sm leading-6 text-foreground/70">
        This is a read-only review surface. The indicator registry currently
        has no authorized school-scoped data access, so actual school packet
        readiness is not available. No school results are fabricated here.
      </p>
      <ReadinessReview result={null} scopeLabel="Not connected" />
      <p className="mt-6 text-xs text-foreground/60">
        This page does not submit, certify, finalize, endorse, approve, or lock packets.
      </p>
    </main>
  );
}
