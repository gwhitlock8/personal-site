// Case Studies: short public write-ups of Gavin's work.
// Keep customers anonymous. Only state outcomes Gavin has confirmed.

export type CaseStudy = {
  slug: string;
  /** Where and when, shown above the title. */
  context: string;
  title: string;
  /** One sentence for the homepage card. */
  summary: string;
  /** The headline result, shown on the card. */
  outcome: string;
  problem: string[];
  built: string[];
  result: string[];
  stack: string[];
  /** Set when the case study lives on its own existing page. */
  href?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "gcp-deployments",
    context: "ServiceNow · Advisory Solution Consultant",
    title: "GCP deployments from ServiceNow for a large US bank",
    summary:
      "A POC that let users pick components and services from a custom catalog and deploy them into their GCP project, later released as a product offering.",
    outcome: "Released as a product offering; it had only supported AWS and Azure",
    problem: [
      "ServiceNow's cloud management in ITOM deployed through Terraform to AWS and Azure, but not GCP.",
      "A large US bank ran its entire cloud footprint on GCP, so it couldn't use the product to deploy.",
    ],
    built: [
      "Worked with the bank's engineers on a POC that orchestrated and stood up workflows in GCP, using infrastructure-as-code tools (Terraform) and API connections.",
      "Built a custom catalog that let the end user choose which components and services were deployed into their GCP project.",
      "The POC kept an accurate inventory of everything it deployed, tagged the resources appropriately and surfaced opportunities for cost optimization.",
    ],
    result: [
      "It was eventually released as an offering within the product, which had previously supported only AWS and Azure.",
    ],
    stack: ["ServiceNow ITOM", "Terraform", "GCP", "Custom service catalog"],
  },
  {
    slug: "proposal-workflow",
    context: "DevRev · Solutions Engineer",
    title: "An AI proposal workflow for a fractional CFO firm",
    summary:
      "A Grow POC that turned discovery-call notes into researched, reviewed proposals and kept the CRM up to date on its own.",
    outcome: "Won the deal; shorter time from discovery call to proposal",
    problem: [
      "A fractional CFO firm wanted to speed up proposals for its small and mid-size clients and cut the CRM admin work that slowed its team down.",
    ],
    built: [
      "Built the POC on DevRev Grow, DevRev's AI CRM.",
      "When notes from a discovery call came in, a workflow parsed them to work out what the prospect needed, researched the company (location, size, headcount) and looked through past proposals for similar ones.",
      "AI drafted a new proposal for the firm's CPAs and fractional CFOs to review. Once they approved it, the workflow pulled the prospect's contact details from the CRM and sent the proposal.",
      "Grow also automated CRM hygiene, so records stayed current without manual entry.",
    ],
    result: [
      "The workflow shortened the time from discovery call to proposal, and the firm bought DevRev.",
    ],
    stack: ["DevRev Grow", "AI workflows", "CRM automation"],
  },
  {
    slug: "demo-builder",
    context: "DevRev · Solutions Engineer",
    title: "Dia, a command-line demo builder for DevRev",
    summary:
      "A tool that turns a plain-English brief into a demo-ready DevRev org, with a click-by-click demo narrative, and cleans up afterward.",
    outcome: "Built in about a week; reusable for any prospect",
    problem: [
      "Showing DevRev's AI context layer works best on data shaped like what a prospect keeps in its systems of record, and setting that up by hand for every demo is slow.",
    ],
    built: [
      "Built Dia, a command-line tool (TypeScript) on GitHub as devrev-implementation-agent. You describe the demo in plain English and Claude writes a blueprint of what to create.",
      "A deterministic planner validates the blueprint and turns it into an ordered list of steps. An executor runs them against the DevRev API, creating products, capabilities, tickets, articles, accounts, contacts and more, with retries, a resume option and an audit log.",
      "Dia also writes a click-by-click demo narrative, can generate synthetic data, and ships with blueprints for migrations from Jira, ServiceNow, Zendesk, Freshdesk and HubSpot.",
      "When the demo is over, one command deletes everything Dia created, in dependency order.",
    ],
    result: [
      "A reusable, prospect-agnostic way to stand up and tear down demos of DevRev's AI context layer.",
    ],
    stack: ["TypeScript", "Claude API", "DevRev REST API and MCP", "Jira, ServiceNow and Zendesk blueprints"],
  },
  {
    slug: "this-site",
    context: "Personal project",
    title: "This site and its AI assistant",
    summary:
      "A RAG assistant over my resume and notes, built with LangChain.js and Kimi K3, plus a private job-search tracker that reads my email and drafts tailored resumes.",
    outcome: "Live on this page; ask it anything",
    problem: [],
    built: [],
    result: [],
    stack: ["Next.js", "LangChain.js", "Kimi K3", "Vercel", "Upstash Redis", "Vercel Blob"],
    href: "/how-i-built-this",
  },
];

export function getCaseStudy(slug: string) {
  return caseStudies.find((c) => c.slug === slug && !c.href);
}
