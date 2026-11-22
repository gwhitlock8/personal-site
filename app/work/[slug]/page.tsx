import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/Chrome";
import { caseStudies, getCaseStudy } from "@/lib/case-studies";
import { profile } from "@/lib/profile";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return caseStudies.filter((c) => !c.href).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = getCaseStudy((await params).slug);
  if (!c) return {};
  return { title: `${c.title} | ${profile.name}`, description: c.summary };
}

function Part({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-t border-line py-8 sm:grid sm:grid-cols-[180px_1fr] sm:gap-8">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-cobalt-deep">{title}</h2>
      <div className="mt-3 max-w-[42rem] space-y-3 text-[1.0125rem] leading-relaxed text-ink/85 sm:mt-0">
        {items.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </section>
  );
}

export default async function CaseStudyPage({ params }: Params) {
  const c = getCaseStudy((await params).slug);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <Header />
      <main className="pb-12">
        <Link href="/#work" className="text-sm text-slate hover:text-ink">
          ← Selected work
        </Link>
        <div className="max-w-[46rem] pb-10 pt-5">
          <p className="text-[14px] text-slate">{c.context}</p>
          <h1 className="mt-2 text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">{c.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">{c.summary}</p>
          <p className="mt-6 inline-flex rounded-full border border-cobalt/25 bg-cobalt-soft px-3.5 py-1.5 text-[14px] font-medium text-cobalt-deep">
            {c.outcome}
          </p>
        </div>

        <Part title="The problem" items={c.problem} />
        <Part title="What I built" items={c.built} />
        <Part title="The outcome" items={c.result} />
        <section className="border-t border-line py-8 sm:grid sm:grid-cols-[180px_1fr] sm:gap-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-cobalt-deep">Stack</h2>
          <ul className="mt-3 flex flex-wrap gap-2 sm:mt-0">
            {c.stack.map((s) => (
              <li key={s} className="rounded-md border border-line bg-card px-2.5 py-1 text-[14px]">
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 flex flex-col gap-5 rounded-[14px] border border-ink/15 bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[34rem] text-[15px] text-ink/85">
            Want to hear how I'd approach a problem like this for your customers?
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={profile.links.booking}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt-deep"
            >
              Book 20 minutes
            </a>
            <Link href="/#chat" className="rounded-md border border-ink/25 px-5 py-2.5 text-sm font-medium hover:border-ink">
              Ask the assistant
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
