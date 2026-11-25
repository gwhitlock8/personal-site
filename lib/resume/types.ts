// The general resume as data. Titles, companies, locations, dates, earlier
// experience and education are fixed facts: tailoring never generates them.

export type Bullet = { id: string; text: string };

export type Role = {
  id: string;
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: Bullet[];
};

export type Achievement = { id: string; title: string; text: string };

export type SkillGroup = { group: string; items: string };

export type BaseResume = {
  name: string;
  contact: string[];
  tagline: string;
  summary: Bullet;
  roles: Role[];
  earlier: { title: string; company: string; dates: string }[];
  achievements: Achievement[];
  education: { degree: string; school: string; years: string; location?: string }[];
  skills: SkillGroup[];
};
