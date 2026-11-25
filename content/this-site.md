# How this site and assistant were built

## Overview
Gavin built this site as a working example of the kind of AI prototype he builds for customers. It's a Next.js app deployed on Vercel. The assistant runs on Kimi K3 from Moonshot AI, called through Moonshot's OpenAI-compatible API and orchestrated with LangChain.js. The code is on GitHub at github.com/gwhitlock8. Behind a private login, the same app also runs Gavin's job-search tracker: it reads job-search email from his Gmail, checks new postings against his experience, and drafts tailored one-page resumes in which every line cites the true material it came from.

## Why Kimi K3
Gavin wanted to learn how a model from a different provider behaves in a real build: its reasoning settings, its API quirks and its cost. Kimi K3 is a 2.8-trillion-parameter model that can't run on Vercel, so the app calls Moonshot's hosted API. Because that API is OpenAI-compatible, moving to another host later is a change of environment variables, not code.

## How a question gets answered
When you send a message, the browser posts it to a Next.js API route. The route checks a per-visitor rate limit, then runs a LangChain retrieval chain. First a retriever searches Gavin's knowledge files (resume, skills, career notes, references, and this page) and picks the most relevant sections. Then a prompt template combines those sections, a short always-included profile, your recent messages and the persona you picked (recruiter, hiring manager or browsing). Kimi K3 generates the answer, which streams back to the browser token by token. The sections the answer drew on appear as source chips under each reply.

## Retrieval without embeddings
Most RAG tutorials use an embeddings model and a vector database. Moonshot doesn't offer an embeddings endpoint, and the knowledge base is only a few thousand words, so Gavin wrote a small BM25 keyword retriever as a LangChain BaseRetriever. It ranks sections by term overlap and runs in memory with no extra service. Because it uses LangChain's retriever interface, swapping in a vector store later is a one-line change.

## The job description fit check
If you paste a job description, the site uses a second chain. It retrieves sections that match the job's requirements and asks Kimi K3 for structured JSON output (strong matches with evidence, plus honest gaps) using LangChain's withStructuredOutput and a Zod schema. The site renders that as a card instead of free text.

## Why there's no agent loop yet
Gavin kept tool calling out of the first version on purpose. Kimi K3 always runs in thinking mode, and on tool-calling turns Moonshot requires the full assistant message, including its reasoning content, to be sent back unchanged. A plain chain is faster and has fewer ways to fail. The next version will move to a LangGraph agent with tools for lead capture and calendar booking.

## Logging and privacy
Conversations and contact details are stored in Upstash Redis through the Vercel Marketplace, so Gavin can review what people ask and improve the answers. Visitors are told this under the chat box. No API keys reach the browser; every model call happens on the server.

## Guardrails
The system prompt tells the model to answer only from the knowledge files, to say when it doesn't know rather than guess, to never invent numbers, employers or references, and to stay on the topic of Gavin's work. Inputs are length-limited and only the last several messages are sent to the model.
