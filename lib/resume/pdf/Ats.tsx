import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RenderResume } from "./types";

// Plain one-column version for applicant tracking systems: no sidebar, no
// color blocks, standard section names, same content as the designed resume.

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 9.5, lineHeight: 1.28, color: "#222", paddingVertical: 32, paddingHorizontal: 40 },
  name: { fontSize: 18, fontWeight: 500 },
  line: { marginTop: 2 },
  h2: { fontSize: 10.5, fontWeight: 500, textTransform: "uppercase", marginTop: 9, marginBottom: 4, borderBottomWidth: 0.6, borderBottomColor: "#999", paddingBottom: 2 },
  role: { marginBottom: 5 },
  roleHead: { fontWeight: 500 },
  bullet: { flexDirection: "row", marginTop: 1 },
  dot: { width: 10 },
  text: { flex: 1 },
});

export function Ats({ r }: { r: RenderResume }) {
  return (
    <Document title={`${r.name} - Resume`} author={r.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{r.name}</Text>
        <Text style={s.line}>{r.tagline}</Text>
        <Text style={s.line}>{r.contact.join(" | ")}</Text>

        <Text style={s.h2}>Summary</Text>
        <Text>{r.summary}</Text>

        <Text style={s.h2}>Experience</Text>
        {r.roles.map((role) => (
          <View key={`${role.company}-${role.title}`} style={s.role}>
            <Text style={s.roleHead}>
              {role.title}, {role.company}, {role.location} | {role.dates}
            </Text>
            {role.bullets.map((b, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.dot}>-</Text>
                <Text style={s.text}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
        {r.earlier.map((e) => (
          <Text key={e.company}>
            {e.title}, {e.company} | {e.dates}
          </Text>
        ))}

        <Text style={s.h2}>Key Achievements</Text>
        {r.achievements.map((a) => (
          <View key={a.title} style={s.bullet}>
            <Text style={s.dot}>-</Text>
            <Text style={s.text}>
              {a.title}: {a.text}
            </Text>
          </View>
        ))}

        <Text style={s.h2}>Skills</Text>
        {r.skills.map((g) => (
          <Text key={g.group}>
            {g.group}: {g.items}
          </Text>
        ))}

        <Text style={s.h2}>Education</Text>
        {r.education.map((e) => (
          <Text key={e.degree}>
            {e.degree}, {e.school}, {e.years}
          </Text>
        ))}
        {r.certifications ? (
          <>
            <Text style={s.h2}>Certifications</Text>
            <Text>{r.certifications}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}
