import { notFound } from "next/navigation";
import { loadOwner } from "@/lib/resume/context";
import { Editor } from "../../../resume/Editor";

export const maxDuration = 60; // tailoring calls the model and renders PDFs

export default async function JobResumePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await loadOwner({ kind: "job", key: decodeURIComponent((await params).key) });
  if (!ctx) notFound();
  return <Editor ctx={ctx} sp={await searchParams} />;
}
