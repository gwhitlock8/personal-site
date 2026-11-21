# Career notes

<!--
Each "##" section is one story the assistant can tell. Plain notes are fine.
Sections left empty (only a comment) are skipped, so the assistant won't mention them.
A good story covers: the situation, what you built or did, what changed.
-->

## An AI prototype that won a customer deal
At DevRev, Gavin built an AI prototype (a POC) for a fractional CFO firm that wanted to speed up proposals for small and mid-size clients. When notes from a discovery call came in, a workflow parsed them to work out what the prospect needed, researched the company (location, size, headcount), looked through past proposals for similar ones, and used AI to draft a new proposal. The firm's CPAs and fractional CFOs reviewed the draft. Once they approved it, the workflow pulled the prospect's contact details from the CRM and sent the proposal. The customer bought DevRev.

## Getting ServiceNow to deploy into GCP for a bank
ServiceNow's cloud management in ITOM deployed through Terraform to AWS and Azure, but not GCP. A large bank Gavin supported ran its entire cloud footprint on GCP. Working with the bank's engineers, he rewrote the Terraform templates and connected the right API endpoints so the bank could run GCP deployments from ServiceNow's cloud management platform.

## A prototype tool that builds customer demos from discovery notes
Gavin built an internal prototype tool that sets up a tailored demo from a prospect's company, industry and discovery-call notes. Building the tool took about a week. Before it, each custom demo took a couple of hours to put together by hand.

## Integrations with Microsoft Teams and Slack
Gavin has built integrations with both Microsoft Teams and Slack, at ServiceNow and at DevRev. At ServiceNow, Microsoft Teams was the single entry point for the AI employee self-service POC he led for a large US credit card issuer.

## SSO provisioning through Microsoft Entra
Gavin has built integrations for POCs with Microsoft Entra, RingCentral and Ignition. For Entra, he wrote the OAuth authentication that let a user request access to a third-party application and have SSO access provisioned automatically. He did not write custom APIs or webhooks for these.

## Moving from customer success into sales engineering
In 2021 Gavin moved from Senior Enterprise CSM to Sales Engineer at LogicMonitor. As a CSM he managed 17 enterprise accounts with 100% net revenue retention and no churn, which gave him a practical view of what customers need after the deal closes. He closed more than $150K in new business while ramping as an SE.

## His biggest deal: AI employee self-service for a large US credit card issuer
As an AI Solution Architect at ServiceNow, Gavin led a POC for one of the largest credit card issuers in the US. The company wanted to combine Moveworks and ServiceNow into one AI self-service experience for its employees. From a single entry point in Microsoft Teams, employees would use natural language to get answers, handle routine tasks and order from the service catalog, drawing on the company's data and ServiceNow's workflow orchestration.

Gavin worked with the customer to map the requests employees actually make, stack-ranked them by priority, and built a Now Assist POC that answered employee questions and completed tasks for them. He also integrated the customer's digital employee experience (DEX) tool, so the assistant could fix IT issues affecting an individual employee's own machine. That custom integration was later released on the ServiceNow Store.

The POC led to an eight-figure deal and took the customer to a nine-figure account with ServiceNow.

## Why he went to a coding bootcamp (Flatiron School)
As a customer success manager at ClearDATA, Gavin worked in the AWS and Azure consoles every day and leaned far more technical than other CSMs, but his title didn't show it. He enrolled in Flatiron School's full-stack software engineering bootcamp in 2019 to make those technical skills official on his resume, planning to move into a solution consultant role afterward. At Flatiron he learned full-stack web development, mainly Ruby on Rails, plus React and JavaScript. His bootcamp projects are on his GitHub (github.com/gwhitlock8).

He graduated in March 2020, just as the pandemic shutdowns began. With hiring uncertain, he went back to customer success, as a Senior Enterprise CSM at LogicMonitor managing the company's largest customers. He learned the platform end to end and put his coding skills to work, writing custom LogicMonitor DataSources and scripts in Groovy that ran on the LogicMonitor Collector, the lightweight app that monitors infrastructure in a customer's environment. In 2021 he made the move into sales engineering at LogicMonitor.

## How he uses his coding skills now
Gavin no longer writes code professionally; he builds prototypes with AI coding tools like Claude Code and Codex. His development background still matters for deep troubleshooting: he inspects the API calls a system makes, reads the code when he needs to, and works through issues in the console and the browser's DevTools.

## How he runs discovery and builds the demo
Before a discovery call, Gavin researches the business: for public companies, the 10-K and 10-Qs, plus blog posts and what employees share on LinkedIn. He uses AI tools to distill that research into a few hypotheses about the problems the company is likely facing. He doesn't lead with those assumptions on the call unless the conversation goes there; the goal of discovery is to hear the pain points in the customer's own words, and why they took the call, so the solution can be tied to outcomes that address them.

He usually opens with "What brought you to the call today?" From there he works through what solutions they use now, the process they follow to deal with the problem, and the exact step in their workflow where the pain shows up. In his experience, almost every pain point comes back to lost efficiency or money, so he asks how it's hurting the bottom line. For the economic buyer, the solution has to fix the problem in a way that makes or saves them money and keeps paying off.

He qualifies deals with MEDDPICC (Metrics, Economic buyer, Decision criteria, Decision process, Paper process, Identify pain, Champion, Competition).

Discovery shapes the demo. Gavin builds custom demos rather than canned ones, which he thinks only help when a prospect just needs to see the interface. The demo plays back the discovery call: here's what we talked about, here's how each pain point and technical requirement maps to the product, and here's how it gets solved. He structures demos with Peter Cohan's Great Demo! method: do the last thing first by showing the end result the customer cares about, then walk through how to get there, peeling back more detail only where the audience is interested.
