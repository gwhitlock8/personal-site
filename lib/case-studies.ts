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
    slug: "employee-self-service",
    context: "ServiceNow · AI Solution Architect",
    title: "AI employee self-service for a large US credit card issuer",
    summary:
      "A POC that let employees get answers, complete routine tasks and fix device issues in natural language from Microsoft Teams.",
    outcome: "Seven-figure deal; the account grew to eight figures",
    problem: [
      "One of the largest credit card issuers in the US wanted to combine Moveworks and ServiceNow into a single AI self-service experience for its employees.",
      "From one entry point in Microsoft Teams, employees should be able to ask questions, handle routine tasks and order from the service catalog in natural language, drawing on the company's data and ServiceNow's workflow orchestration.",
    ],
    built: [
      "Worked with the customer to map the requests employees actually make, then stack-ranked them by priority.",
      "Built a Now Assist POC that answered employee questions and completed tasks for them.",
      "Integrated the customer's digital employee experience (DEX) tool so the assistant could fix IT issues on an individual employee's own machine. That custom integration was later released on the ServiceNow Store.",
    ],
    result: [
      "The POC led to a seven-figure deal and took the customer to an eight-figure account with ServiceNow.",
    ],
    stack: ["ServiceNow Now Assist", "Moveworks", "Microsoft Teams", "DEX integration"],
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
    title: "A demo builder for DevRev's AI context layer",
    summary:
      "A tool that generates a demo narrative and realistic synthetic data shaped like Jira, Salesforce and ServiceNow.",
    outcome: "Built in about a week; reusable for any prospect",
    problem: [
      "DevRev needed a way to show the power of its AI context layer in demos, on data shaped like what companies keep in their systems of record.",
    ],
    built: [
      "Built a prospect-agnostic demo builder in about a week.",
      "It generates a demo narrative along with synthetic data in the same shape it has in third-party systems of record such as Jira, Salesforce and ServiceNow, plus some legacy platforms.",
    ],
    result: [
      "A reusable, prospect-agnostic way to demonstrate DevRev's AI context layer.",
    ],
    stack: ["Synthetic data", "Jira, Salesforce and ServiceNow data models"],
  },
  {
    slug: "this-site",
    context: "Personal project",
    title: "This site's AI assistant",
    summary:
      "A RAG assistant over my resume and notes, built with LangChain.js and Kimi K3, an open-weight model, with a structured job fit check.",
    outcome: "Live on this page; ask it anything",
    problem: [],
    built: [],
    result: [],
    stack: ["Next.js", "LangChain.js", "Kimi K3", "Vercel", "Upstash Redis"],
    href: "/how-i-built-this",
  },
];

export function getCaseStudy(slug: string) {
  return caseStudies.find((c) => c.slug === slug && !c.href);
}
