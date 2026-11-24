import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Bitter and Roboto (SIL Open Font License), committed in lib/resume/fonts.
const dir = path.join(process.cwd(), "lib/resume/fonts");
let done = false;

export function registerFonts() {
  if (done) return;
  Font.register({ family: "Bitter", src: path.join(dir, "bitter-latin-400-normal.woff") });
  Font.register({
    family: "Roboto",
    fonts: [
      { src: path.join(dir, "roboto-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "roboto-latin-500-normal.woff"), fontWeight: 500 },
    ],
  });
  // No hyphenation; very long tokens (URLs) are split so they wrap instead of overflowing.
  Font.registerHyphenationCallback((word) => (word.length > 28 ? word.match(/.{1,14}/g) ?? [word] : [word]));
  done = true;
}
