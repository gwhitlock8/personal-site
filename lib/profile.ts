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
  headline: "Solution engineer who builds the prototype during discovery, not after.",
  intro:
    "I'm Gavin, an Austin-based solution engineer with 10+ years in enterprise SaaS at DevRev, ServiceNow and LogicMonitor. I lead discovery and architecture workshops, then build POCs with AI agents and LLM integrations. I built the assistant on this page with LangChain.js and Kimi K3, an open-weight model.",
  status: "Open to Solutions Engineering roles",
  links: {
    linkedin: "https://www.linkedin.com/in/gavin-whitlock",
    github: "https://github.com/gwhitlock8",
    resume: "/Gavin-Whitlock-Resume.pdf",
  },
  facts: [
    { value: "135%", label: "Quota attainment at ServiceNow, 2024" },
    { value: "100%", label: "Net revenue retention as a LogicMonitor CSM, zero churn" },
    { value: "3", label: "ServiceNow Belayer Awards" },
    { value: "10+ yrs", label: "Enterprise SaaS, presales and customer success" },
  ],
};

export const experience: Role[] = [
  {
    company: "DevRev",
    title: "Solution Engineer",
    start: "May 2026",
    end: "Present",
    bullets: [
      "Support strategic and enterprise accounts, positioning DevRev's AI platform for enterprise buyers.",
      "Explain how the platform captures business context, provides an AI memory layer, prepares data for AI and runs an execution layer on top.",
      "Lead technical discovery, product demos, POCs and technical workshops.",
      "Help build out integrations for the DevRev platform.",
    ],
  },
  {
    company: "ServiceNow",
    title: "AI Solution Architect",
    location: "Austin, TX",
    start: "Jan 2026",
    end: "May 2026",
    bullets: [
      "Designed AI workflow solutions with ServiceNow Now Assist and LLM integrations.",
      "Built POC environments and prototypes demonstrating AI agents and workflow automation.",
      "Led AI discovery workshops to help enterprise customers find high-impact automation opportunities.",
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
      "Led technical sales cycles for enterprise financial services organizations from discovery through technical win.",
      "Delivered demos and architecture workshops across ITOM, ITSM, SPM and Enterprise Architecture.",
      "Built and presented cloud-native operations labs using AWS EKS and EC2.",
      "Quota attainment: 135% (2024), 101% (2023), 87% (2022 ramp year).",
    ],
  },
  {
    company: "LogicMonitor",
    title: "Sales Engineer",
    location: "Austin, TX",
    start: "Oct 2021",
    end: "Jul 2022",
    bullets: [
      "Closed $150K+ in new business while ramping into the role.",
      "Designed monitoring solutions spanning hybrid infrastructure and cloud environments.",
    ],
  },
  {
    company: "LogicMonitor",
    title: "Senior Enterprise Customer Success Manager",
    location: "Austin, TX",
    start: "Jun 2020",
    end: "Oct 2021",
    bullets: [
      "Managed 17 enterprise accounts and secured 11 contract renewals.",
      "Exceeded expansion and upsell quota; 100% net revenue retention with zero churn.",
      "Ran executive business reviews and built custom operational dashboards.",
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
