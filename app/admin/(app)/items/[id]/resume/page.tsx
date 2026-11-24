import { notFound } from "next/navigation";
import { loadOwner } from "@/lib/resume/context";
import { Editor } from "../../../resume/Editor";

export const maxDuration = 60; // tailoring calls the model and renders PDFs

export default async function ApplicationResumePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await loadOwner({ kind: "app", id: (await params).id });
  if (!ctx) notFound();
  return <Editor ctx={ctx} sp={await searchParams} />;
}
