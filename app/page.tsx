import Image from "next/image";
import Link from "next/link";
import Chat from "@/components/Chat";
import { experience, profile, references, type Role } from "@/lib/profile";
import { caseStudies } from "@/lib/case-studies";
import { Header, Footer } from "@/components/Chrome";

// Roles before this index are shown in full; the rest are condensed.
const FULL_ROLES = 5;

export default function Home() {
  const recent = experience.slice(0, FULL_ROLES);
  const earlier = experience.slice(FULL_ROLES);

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <Header />

      <main>
        <section className="relative grid items-start gap-10 pb-20 pt-4 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pt-10">
          <div className="blueprint pointer-events-none absolute -inset-x-8 -top-6 bottom-6 -z-10 [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_70%)]" />
          <div className="lg:pt-8">
            <div className="mb-6 flex items-center gap-3 sm:gap-4">
              <Image
                src="/headshot.jpg"
                alt={`Photo of ${profile.name}`}
                width={72}
                height={72}
                priority
                className="h-14 w-14 shrink-0 rounded-full sm:h-[72px] sm:w-[72px] border border-ink/10 object-cover shadow-[0_8px_20px_-12px_rgba(23,32,43,0.5)]"
              />
              <p className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-cobalt/25 bg-card px-3 py-1 text-[12px] text-cobalt-deep sm:text-[13px]">
                <span className="h-1.5 w-1.5 rounded-full bg-cobalt" aria-hidden />
                {profile.status}
              </p>
            </div>
            <h1 className="max-w-[34rem] text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.022em] sm:text-[2.6rem] lg:text-[2.75rem]">
              {profile.headline}
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.075rem] leading-relaxed text-slate">{profile.intro}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={profile.links.booking}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt-deep"
              >
                Book 20 minutes
              </a>
              <a
                href={`mailto:${profile.links.email}`}
                className="rounded-md border border-ink/25 bg-card px-5 py-2.5 text-sm font-medium hover:border-ink"
              >
                Email me
              </a>
              <a
                href="#chat"
                className="rounded-md border border-ink/25 bg-card px-5 py-2.5 text-sm font-medium hover:border-ink lg:hidden"
              >
                Ask the assistant
              </a>
            </div>

            <dl className="mt-10 grid max-w-[34rem] grid-cols-2 gap-x-8 border-t border-ink/15">
              {profile.facts.map((f) => (
                <div key={f.label} className="flex flex-col-reverse justify-end border-b border-line py-4">
                  <dt className="mt-0.5 text-[13px] leading-snug text-slate">{f.label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div id="chat" className="scroll-mt-6">
            <Chat />
          </div>
        </section>

        <section id="work" className="scroll-mt-6 border-t border-ink/15 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">Selected work</h2>
            <p className="max-w-[30rem] text-[15px] text-slate">Prototypes and POCs I built for customers. Customer names are withheld.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {caseStudies.map((c) => (
              <Link
                key={c.slug}
                href={c.href ?? `/work/${c.slug}`}
                className="group flex flex-col rounded-[14px] border border-ink/15 bg-card p-6 transition-colors hover:border-cobalt"
              >
                <p className="text-[13px] text-slate">{c.context}</p>
                <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight group-hover:text-cobalt-deep">{c.title}</h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink/80">{c.summary}</p>
                <p className="mt-5 border-t border-line pt-4 text-[14px] font-medium text-cobalt-deep">{c.outcome}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="experience" className="scroll-mt-6 border-t border-ink/15 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">Experience</h2>
          <ol className="relative mt-10 space-y-10 border-l border-line pl-6 sm:ml-[180px] sm:pl-8">
            {recent.map((r) => (
              <RoleItem key={`${r.company}-${r.title}`} role={r} />
            ))}
          </ol>
          <div className="mt-12 sm:ml-[180px]">
            <h3 className="font-semibold">Before SaaS presales: healthcare IT</h3>
            <ul className="mt-3 grid gap-x-8 gap-y-2 text-[15px] text-slate sm:grid-cols-2">
              {earlier.map((r) => (
                <li key={r.company}>
                  <span className="text-ink">{r.title}</span>, {r.company}{" "}
                  <span className="whitespace-nowrap text-[13px]">
                    ({r.start.split(" ")[1]}–{r.end.split(" ")[1]})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {references.length > 0 && (
          <section id="references" className="scroll-mt-6 border-t border-ink/15 py-16">
            <h2 className="text-3xl font-semibold tracking-tight">What colleagues say</h2>
            <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2">
              {references.map((r) => (
                <figure key={r.name} className="border-l-2 border-cobalt pl-5">
                  <blockquote className="text-lg leading-snug">“{r.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-slate">{r.title}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-8 border-t border-ink/15 py-16 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">How I built the assistant</h2>
            <p className="mt-3 max-w-[38rem] text-slate">
              A Next.js app on Vercel. LangChain.js retrieves sections of my resume and notes, and Kimi K3, from Moonshot AI,
              writes the answer. The walkthrough covers each step and the tradeoffs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/how-i-built-this"
              className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Read the walkthrough
            </Link>
            <a
              href={profile.links.booking}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
            >
              Book 20 minutes
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function RoleItem({ role }: { role: Role }) {
  return (
    <li className="relative">
      <span className="absolute -left-[29px] top-[0.45em] h-2.5 w-2.5 rounded-full border-2 border-cobalt bg-paper sm:-left-[37px]" aria-hidden />
      <p className="text-[13px] text-slate sm:absolute sm:-left-[220px] sm:w-[160px] sm:text-right">
        {role.start} – {role.end}
      </p>
      <h3 className="text-lg font-semibold leading-snug">
        {role.title} <span className="font-normal text-slate">at {role.company}</span>
      </h3>
      <ul className="mt-2 max-w-[44rem] space-y-1.5 text-[15px] text-ink/80">
        {role.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </li>
  );
}
