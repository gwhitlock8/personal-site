// Single source of truth for structured resume data.
// The homepage renders this, and lib/knowledge.ts turns it into
// markdown so the assistant answers from the same facts.

export type Role = {
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
};

export type Reference = { name: string; title: string; quote: string };

export const profile = {
  name: "Gavin Whitlock",
  initials: "GW",
  location: "Austin, TX",
  headline: "Storyteller who ties the technology back to business outcomes",
  intro:
    "I'm Gavin, an Austin-based solutions engineer with 10+ years in enterprise SaaS. I lead discovery and architecture workshops, then build POCs with AI agents and LLM integrations. I built the assistant on this page with LangChain.js and Kimi K3.",
  status: "Open to Solutions Engineering roles",
  links: {
    linkedin: "https://www.linkedin.com/in/gavin-whitlock",
    github: "https://github.com/gwhitlock8",
    resume: "/Gavin-Whitlock-Resume.pdf",
    booking: "https://calendar.app.google/s6Fff722GhMxcrA8A",
    email: "gavinswhitlock@gmail.com",
  },
  facts: [
    { value: "135%", label: "Quota attainment at ServiceNow, 2024" },
    { value: ">100%", label: "Net revenue retention as a LogicMonitor CSM, zero churn" },
    { value: "3", label: "ServiceNow Belayer Awards" },
    { value: "10+ yrs", label: "Enterprise SaaS, presales and customer success" },
  ],
};

export const experience: Role[] = [
  {
    company: "DevRev",
    title: "Solutions Engineer",
    start: "May 2026",
    end: "Present",
    bullets: [
      "Run technical discovery, demos and POCs for large enterprise accounts across TX and LA.",
      "Built POC integrations with Microsoft Entra (wrote the OAuth flow for automatic SSO provisioning), Teams and Slack.",
      "Built an AI workflow for a fractional CFO firm that turns discovery-call notes into reviewed proposals, cutting a typical two-week turnaround to two hours. They bought DevRev.",
      "Built Dia, a command-line tool that stands up a demo-ready DevRev org from a plain-English brief.",
      "Built an AI skill that creates dashboards using DevRev's internal API, working out the API with DevTools and Postman. Built and used MCPs, often from an OpenAPI spec.",
      "Ran partner enablement cycles on the platform and how to sell it.",
      "Explain how the platform captures business context, provides an AI memory layer, prepares data for AI and runs an execution layer on top.",
    ],
  },
  {
    company: "ServiceNow",
    title: "AI Solution Architect",
    location: "Austin, TX",
    start: "Jan 2026",
    end: "May 2026",
    bullets: [
      "Built Now Assist POCs and prototypes demonstrating AI agents and workflow automation.",
      "Built a DEX integration that fixes device issues. ServiceNow later released it on the Store.",
      "Ran AI discovery workshops with financial services and wealth management firms to find where automation would pay off.",
      "Supported strategic pursuits across wealth management and financial services.",
    ],
  },
  {
    company: "ServiceNow",
    title: "Advisory Solution Consultant",
    location: "Austin, TX",
    start: "Jul 2022",
    end: "Jan 2026",
    bullets: [
      "Ran technical sales cycles for financial services accounts, from discovery to technical win, with demos and workshops across ITOM, ITSM, SPM and Enterprise Architecture.",
      "Built a POC for a large US bank that stood up GCP workflows from ServiceNow using Terraform and a custom catalog where users pick the components and services for their GCP project. It kept a tagged inventory of what it deployed and flagged cost savings. ServiceNow later released it as an offering; the product had only supported AWS and Azure.",
      "Developed and ran a lab at ServiceNow's Knowledge conference demonstrating discovery and monitoring of Kubernetes objects.",
      "Quota attainment: 135% (2024), 112% (2025, covering the territory alone for half the year), 101% (2023), 87% (2022 ramp year).",
    ],
  },
  {
    company: "LogicMonitor",
    title: "Sales Engineer",
    location: "Austin, TX",
    start: "Oct 2021",
    end: "Jul 2022",
    bullets: [
      "Closed $150K+ in new business while ramping into the role. Named Rookie Sales Engineer.",
      "Built DataSources that use scripts and protocols (SNMP, NetFlow, Syslog, OTel) to pull infrastructure metrics into a time-series database to trend and act on.",
    ],
  },
  {
    company: "LogicMonitor",
    title: "Senior Enterprise Customer Success Manager",
    location: "Austin, TX",
    start: "Jun 2020",
    end: "Oct 2021",
    bullets: [
      "Managed 17 of the company's largest accounts and secured 11 renewals.",
      "Net revenue retention above 100% with zero churn. Grew spend at several accounts and exceeded expansion and upsell quota.",
      "Wrote custom Groovy DataSources, run by the Collector installed in the customer's environment, to poll network devices for metrics.",
      "Ran executive business reviews and built custom dashboards.",
    ],
  },
  {
    company: "ClearDATA",
    title: "Enterprise Customer Success Manager",
    location: "Austin, TX",
    start: "Dec 2018",
    end: "Dec 2019",
    bullets: [
      "Managed enterprise healthcare customers running secure cloud workloads.",
      "Coordinated product, engineering and customer teams for deployments.",
    ],
  },
  {
    company: "MedeAnalytics",
    title: "Manager, Account Management",
    location: "Remote",
    start: "Jun 2018",
    end: "Dec 2018",
    bullets: ["Managed Tier 1 healthcare clients generating $100M+ in revenue."],
  },
  {
    company: "Privia Health",
    title: "Lead Application Support Engineer",
    location: "Remote",
    start: "Nov 2016",
    end: "Jun 2018",
    bullets: ["Supported the athenahealth platform and built internal audit tooling."],
  },
  {
    company: "Houston Methodist Hospital",
    title: "Clinical Application Analyst",
    location: "Houston, TX",
    start: "Aug 2015",
    end: "Nov 2016",
    bullets: ["Managed onboarding and training for physician offices."],
  },
  {
    company: "athenahealth",
    title: "Implementation Associate",
    location: "Atlanta, GA",
    start: "Oct 2013",
    end: "Aug 2015",
    bullets: ["Led implementations supporting more than 150 healthcare providers."],
  },
];

// TODO(Gavin): add references once you have permission to quote them.
// The homepage section hides itself while this list is empty.
export const references: Reference[] = [];

export const suggestedQuestions = [
  "What AI prototypes has Gavin built for customers?",
  "What did he do at ServiceNow?",
  "Why would Gavin be a strong SE hire?",
  "How did Gavin build this assistant?",
];

export function experienceAsMarkdown(): string {
  const roles = experience
    .map(
      (r) =>
        `## ${r.title} at ${r.company} (${r.start} to ${r.end})\n` +
        (r.location ? `Location: ${r.location}\n` : "") +
        r.bullets.map((b) => `- ${b}`).join("\n"),
    )
    .join("\n\n");
  return `# Experience\n\n${roles}`;
}
