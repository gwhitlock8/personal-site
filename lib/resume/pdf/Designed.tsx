import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RenderResume } from "./types";

// The two-column resume, rebuilt from the approved HTML design (Letter size;
// main column 5.36in, sidebar 3.14in). 1in = 72pt.

const ink = "#3b3b3b";
const muted = "#8a8f96";
const accent = "#1585e6";

const s = StyleSheet.create({
  page: { flexDirection: "row", fontFamily: "Roboto", fontSize: 8.6, lineHeight: 1.36, letterSpacing: 0.12, color: ink, paddingTop: 23, paddingBottom: 18 },
  main: { width: 386, paddingRight: 21.6, paddingLeft: 28.8 },
  name: { fontFamily: "Bitter", fontSize: 25, letterSpacing: 0.25, lineHeight: 1.05, color: "#3a3a3a" },
  tagline: { color: accent, fontSize: 12.5, marginTop: 3 },
  contact: { flexDirection: "row", flexWrap: "wrap", marginTop: 7, fontSize: 8.4, color: "#444" },
  contactItem: { marginRight: 11, marginBottom: 2 },
  h2: { fontFamily: "Bitter", fontSize: 12.5, letterSpacing: 0.4, color: "#3a3a3a", textTransform: "uppercase", borderBottomWidth: 0.9, borderBottomColor: "#b9bdc2", paddingBottom: 3, marginTop: 12, marginBottom: 6 },
  summary: { fontSize: 8.7 },
  job: { marginBottom: 7 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontFamily: "Bitter", fontSize: 10.6, color: "#3a3a3a" },
  date: { color: muted, fontSize: 8.3 },
  company: { fontFamily: "Bitter", color: accent, fontSize: 10 },
  loc: { fontSize: 8.3, color: "#444" },
  bullet: { flexDirection: "row", marginTop: 1.6 },
  dot: { width: 9, color: "#666", paddingLeft: 1 },
  bulletText: { flex: 1 },
  earlierTitle: { flex: 1, color: "#3a3a3a" },
  earlierDate: { color: muted, fontSize: 8.2, marginLeft: 10 },
  // The sidebar's background is drawn on every page (fixed), so a page that
  // spills over keeps its margins and the dark column runs full height.
  asideBg: { position: "absolute", top: 0, right: 0, bottom: 0, width: 226, backgroundColor: "#243f5c", borderTopWidth: 12.2, borderTopColor: "#1b2c41" },
  aside: { width: 226, color: "#ffffff", paddingRight: 23, paddingLeft: 21.6 },
  avatar: { width: 89, height: 89, borderRadius: 44.5, backgroundColor: "#3d5874", marginTop: 5, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Bitter", fontSize: 30, letterSpacing: 1.2, color: "#ffffff", marginBottom: 8 },
  avatarBar: { position: "absolute", bottom: 17, width: 30, height: 2, borderRadius: 1, backgroundColor: "#5da9f0" },
  asideH2: { fontFamily: "Bitter", fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase", color: "#ffffff", borderBottomWidth: 1.2, borderBottomColor: "#ffffff", paddingBottom: 3, marginTop: 14, marginBottom: 6 },
  achTitle: { fontFamily: "Bitter", fontSize: 10, lineHeight: 1.25 },
  achText: { fontSize: 8.3, color: "#e8edf2", marginTop: 2 },
  ach: { marginBottom: 8 },
  eduTitle: { fontFamily: "Bitter", fontSize: 10, lineHeight: 1.25 },
  eduSchool: { fontFamily: "Bitter", fontSize: 9, color: "#dfe6ee", marginTop: 2 },
  eduMeta: { flexDirection: "row", justifyContent: "space-between", fontSize: 8.2, color: "#a9b7c6", marginTop: 3 },
  edu: { marginBottom: 8 },
  skillGroup: { fontFamily: "Bitter", fontSize: 9, marginTop: 5 },
  skillItems: { fontSize: 8.3, color: "#e8edf2", marginTop: 1 },
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export function Designed({ r }: { r: RenderResume }) {
  return (
    <Document title={`${r.name} - Resume`} author={r.name}>
      <Page size="LETTER" style={s.page}>
        <View fixed style={s.asideBg} />
        <View style={s.main}>
          <Text style={s.name}>{r.name.toUpperCase()}</Text>
          <Text style={s.tagline}>{r.tagline}</Text>
          <View style={s.contact}>
            {r.contact.map((c) => (
              <Text key={c} style={s.contactItem}>
                {c}
              </Text>
            ))}
          </View>

          <Text style={[s.h2, { marginTop: 15 }]}>Summary</Text>
          <Text style={s.summary}>{r.summary}</Text>

          <Text style={s.h2}>Experience</Text>
          {r.roles.map((role) => (
            <View key={`${role.company}-${role.title}`} style={s.job} wrap={false}>
              <View style={s.row}>
                <Text style={s.title}>{role.title}</Text>
                <Text style={s.date}>{role.dates}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.company}>{role.company}</Text>
                <Text style={s.loc}>{role.location}</Text>
              </View>
              <View style={{ marginTop: 2 }}>
                {role.bullets.map((b, i) => (
                  <View key={i} style={s.bullet}>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Text style={s.h2}>Earlier Experience</Text>
          {r.earlier.map((e) => (
            <View key={e.company} style={[s.row, { marginBottom: 2 }]}>
              <Text style={s.earlierTitle}>
                <Text style={{ fontWeight: 500 }}>{e.title}</Text>, {e.company}
              </Text>
              <Text style={s.earlierDate}>{e.dates}</Text>
            </View>
          ))}
        </View>

        <View style={s.aside}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(r.name)}</Text>
            <View style={s.avatarBar} />
          </View>

          <Text style={[s.asideH2, { marginTop: 20 }]}>Key Achievements</Text>
          {r.achievements.map((a) => (
            <View key={a.title} style={s.ach} wrap={false}>
              <Text style={s.achTitle}>{a.title}</Text>
              <Text style={s.achText}>{a.text}</Text>
            </View>
          ))}

          <Text style={s.asideH2}>Education</Text>
          {r.education.map((e) => (
            <View key={e.degree} style={s.edu} wrap={false}>
              <Text style={s.eduTitle}>{e.degree}</Text>
              <Text style={s.eduSchool}>{e.school}</Text>
              <View style={s.eduMeta}>
                <Text>{e.years}</Text>
                {e.location ? <Text>{e.location}</Text> : null}
              </View>
            </View>
          ))}
          {r.certifications ? (
            <>
              <Text style={s.asideH2}>Certifications</Text>
              <Text style={s.skillItems}>{r.certifications}</Text>
            </>
          ) : null}

          <Text style={s.asideH2}>Skills</Text>
          {r.skills.map((g, i) => (
            <View key={g.group} wrap={false}>
              <Text style={[s.skillGroup, i === 0 ? { marginTop: 0 } : {}]}>{g.group}</Text>
              <Text style={s.skillItems}>{g.items}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
