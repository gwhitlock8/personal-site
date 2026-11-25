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
    text: "Solutions Engineer with 10+ years in enterprise software, across presales and customer success. I run technical discovery, build demos and AI prototypes, and have carried quota as an SE and owned renewals as a CSM.",
  },
  roles: [
    {
      id: "devrev",
      title: "Solutions Engineer",
      company: "DevRev",
      location: "Austin, TX",
      dates: "May 2026 – Present",
      bullets: bullets("devrev", [
        "Run technical discovery, demos and POCs for large enterprise accounts across TX and LA",
        "Built an AI workflow for a fractional CFO firm that turns discovery-call notes into reviewed proposals, cutting a typical two-week turnaround to two hours. They bought DevRev",
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
        "Ran the POC for a large US credit card issuer, combining Moveworks and ServiceNow for employee self-service in Teams",
        "Built the Now Assist POC and a DEX integration that fixes device issues. ServiceNow later released it on the Store",
        "Ran AI discovery workshops with financial services and wealth management firms to find where automation would pay off",
      ]),
    },
    {
      id: "sn-asc",
      title: "Advisory Solution Consultant",
      company: "ServiceNow",
      location: "Austin, TX",
      dates: "Jul 2022 – Jan 2026",
      bullets: bullets("sn-asc", [
        "Ran technical sales cycles for financial services accounts, with demos and workshops across ITOM, ITSM, SPM and Enterprise Architecture",
        "Worked with a large bank's engineers to rewrite Terraform templates and API connections so they could deploy to GCP from ServiceNow",
        "Developed and ran a Knowledge conference lab on discovering and monitoring Kubernetes objects",
      ]),
    },
    {
      id: "lm-se",
      title: "Sales Engineer",
      company: "LogicMonitor",
      location: "Austin, TX",
      dates: "Oct 2021 – Jul 2022",
      bullets: bullets("lm-se", ["Closed $150K+ in new business while ramping into the role. Named Rookie Sales Engineer"]),
    },
    {
      id: "lm-csm",
      title: "Senior Enterprise Customer Success Manager",
      company: "LogicMonitor",
      location: "Austin, TX",
      dates: "Jun 2020 – Oct 2021",
      bullets: bullets("lm-csm", [
        "Managed 17 of the company's largest accounts, 11 of them renewals",
        "Wrote custom Groovy DataSources, run by the Collector in the customer's environment, to poll devices for metrics",
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
    { id: "B-ach-1", title: "Seven-figure AI deal", text: "Ran the POC that helped win a seven-figure deal with a large US credit card issuer and helped take the account to eight figures." },
    { id: "B-ach-2", title: "135% and 112% of quota", text: "Exceeded quota at ServiceNow in 2024 and 2025, covering the territory on my own for half of 2025." },
    { id: "B-ach-3", title: "Net revenue retention above 100%", text: "Zero churn across 17 of LogicMonitor's largest accounts. Grew spend at several of them and exceeded expansion and upsell quota." },
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
    { group: "Development", items: "JavaScript, TypeScript, Node.js, Ruby on Rails, React, Groovy, PostgreSQL, Git, AI coding tools" },
  ],
};
