import type { BaseResume, Bullet } from "./types";

// Gavin's general resume (November 2026), transcribed from the approved
// one-page version. Bullet ids are stable: tailored drafts cite them.

const bullets = (role: string, texts: string[]): Bullet[] => texts.map((text, i) => ({ id: `B-${role}-${i + 1}`, text }));

export const BASE: BaseResume = {
  name: "Gavin Whitlock",
  contact: ["gavinswhitlock@gmail.com", "gavinwhitlock.com", "linkedin.com/in/gavin-whitlock", "Austin, TX"],
  tagline: "Solutions Engineer | AI Solutions",
  summary: {
    id: "B-summary",
    text: "Solutions engineer with 10+ years in enterprise SaaS across presales and customer success. I run discovery, build custom demos and working AI prototypes, and tie the technical details back to the business outcomes buyers care about.",
  },
  roles: [
    {
      id: "devrev",
      title: "Solutions Engineer",
      company: "DevRev",
      location: "Austin, TX",
      dates: "May 2026 – Present",
      bullets: bullets("devrev", [
        "Lead discovery, custom demos, POCs and technical workshops for enterprise accounts",
        "Built an AI proposal POC for a fractional CFO firm that turned discovery-call notes into researched, reviewed proposals; the customer bought DevRev",
        "Built Microsoft Teams and Slack integrations; positioned DevRev's AI memory and execution layer",
      ]),
    },
    {
      id: "sn-ai",
      title: "AI Solution Architect",
      company: "ServiceNow",
      location: "Austin, TX",
      dates: "Jan 2026 – May 2026",
      bullets: bullets("sn-ai", [
        "Led an AI employee self-service POC for a large US credit card issuer, combining Moveworks and ServiceNow in Microsoft Teams; it led to an eight-figure deal and a nine-figure account",
        "Stack-ranked employee requests, built the Now Assist POC, and built a DEX integration that fixed device issues, later released on the ServiceNow Store",
        "Led AI discovery workshops for financial services and wealth management firms",
      ]),
    },
    {
      id: "sn-asc",
      title: "Advisory Solution Consultant",
      company: "ServiceNow",
      location: "Austin, TX",
      dates: "Jul 2022 – Jan 2026",
      bullets: bullets("sn-asc", [
        "Quota attainment: 112% (2025, managing the territory on my own for half the year), 135% (2024), 101% (2023), 87% (2022 ramp year)",
        "Led technical sales cycles for enterprise financial services accounts, with demos and architecture workshops across ITOM, ITSM, SPM and Enterprise Architecture",
        "Rewrote Terraform templates and API connections so a large bank could deploy to GCP from ServiceNow",
        "Built and presented cloud-native operations labs on AWS EKS and EC2",
      ]),
    },
    {
      id: "lm-se",
      title: "Sales Engineer",
      company: "LogicMonitor",
      location: "Austin, TX",
      dates: "Oct 2021 – Jul 2022",
      bullets: bullets("lm-se", ["Closed $150K+ in new business while ramping; Rookie Sales Engineer recognition"]),
    },
    {
      id: "lm-csm",
      title: "Senior Enterprise Customer Success Manager",
      company: "LogicMonitor",
      location: "Austin, TX",
      dates: "Jun 2020 – Oct 2021",
      bullets: bullets("lm-csm", [
        "Managed 17 of the company's largest accounts: 11 renewals, 100% net revenue retention, zero churn, and exceeded expansion and upsell quota",
        "Wrote custom Groovy DataSources and scripts on the LogicMonitor Collector; ran executive business reviews",
      ]),
    },
  ],
  earlier: [
    { title: "Enterprise Customer Success Manager", company: "ClearDATA", dates: "Dec 2018 – Dec 2019" },
    { title: "Manager, Account Management", company: "MedeAnalytics", dates: "Jun 2018 – Dec 2018" },
    { title: "Lead Application Support Engineer", company: "Privia Health", dates: "Nov 2016 – Jun 2018" },
    { title: "Clinical Application Analyst", company: "Houston Methodist Hospital", dates: "Aug 2015 – Nov 2016" },
    { title: "Implementation Associate", company: "athenahealth", dates: "Oct 2013 – Aug 2015" },
  ],
  achievements: [
    { id: "B-ach-1", title: "Eight-figure AI deal", text: "Led the POC that won an eight-figure deal with a large US credit card issuer and took the account to nine figures." },
    { id: "B-ach-2", title: "135% and 112% of quota", text: "Exceeded quota at ServiceNow in 2024 and 2025, managing the territory on my own for half of 2025." },
    { id: "B-ach-3", title: "100% net revenue retention", text: "Zero churn across 17 of LogicMonitor's largest accounts as a Senior Enterprise CSM." },
    { id: "B-ach-4", title: "3× ServiceNow Belayer Award", text: "Recognized in Q4 2022, Q1 2023 and Q4 2023." },
  ],
  education: [
    { degree: "Full Stack Software Engineering Bootcamp", school: "Flatiron School", years: "2019 – 2020" },
    { degree: "B.S., Corporate Communication", school: "University of Texas at Austin", years: "2012", location: "Austin, TX" },
  ],
  skills: [
    { group: "AI", items: "AI agents, LLM integrations, AI prototyping, Now Assist, Moveworks" },
    { group: "Presales", items: "Technical discovery, custom demos, POCs, architecture workshops, MEDDPICC" },
    { group: "Platforms", items: "ServiceNow (ITOM, ITSM, SPM), DevRev, LogicMonitor, Salesforce, Jira" },
    { group: "Integrations", items: "Microsoft Teams, Slack, Microsoft Entra, APIs" },
    { group: "Cloud", items: "AWS, Azure, GCP, Terraform" },
    { group: "Development", items: "JavaScript, TypeScript, Node.js, Ruby on Rails, React, Groovy, PostgreSQL, Git, Claude Code, Codex" },
  ],
};
