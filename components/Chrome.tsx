import Link from "next/link";
import { profile } from "@/lib/profile";

export function Header() {
  return (
    <header className="flex items-center justify-between py-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        {profile.name}
      </Link>
      <nav className="flex items-center gap-5 text-sm text-slate">
        <Link href="/#work" className="hidden hover:text-ink sm:inline">
          Work
        </Link>
        <Link href="/#experience" className="hidden hover:text-ink sm:inline">
          Experience
        </Link>
        <Link href="/how-i-built-this" className="hidden hover:text-ink sm:inline">
          How I built this
        </Link>
        <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
          LinkedIn
        </a>
        <a
          href={profile.links.resume}
          target="_blank"
          className="rounded-md border border-ink px-4 py-1.5 font-medium text-ink hover:bg-ink hover:text-paper"
        >
          Resume
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="flex flex-col gap-2 border-t border-line py-8 text-[13px] text-slate sm:flex-row sm:justify-between">
      <p>
        © {new Date().getFullYear()} {profile.name}, {profile.location}
      </p>
      <p>
        Built with Next.js, LangChain.js and Kimi K3.{" "}
        <a href={`${profile.links.github}/personal-site`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
          Code on GitHub
        </a>
      </p>
    </footer>
  );
}
