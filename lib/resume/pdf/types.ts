// What the PDF templates draw: fixed facts from the base resume plus the chosen lines.
export type RenderResume = {
  name: string;
  contact: string[];
  tagline: string;
  summary: string;
  roles: { title: string; company: string; location: string; dates: string; bullets: string[] }[];
  earlier: { title: string; company: string; dates: string }[];
  achievements: { title: string; text: string }[];
  education: { degree: string; school: string; years: string; location?: string }[];
  skills: { group: string; items: string }[];
  certifications?: string;
};
