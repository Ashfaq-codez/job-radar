import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { MAX_RESUME_BYTES } from "./profile-options";

// Resume upload → plain text. The file itself is never stored, only the text we pull out of it.

export class ResumeProblem extends Error {} // message is safe to show the user

const MAX_TEXT = 30_000; // characters; a long resume is ~8k
const MAX_PAGES = 10;

// Trust the bytes, not the file name or the browser's type
function kind(bytes: Uint8Array): "pdf" | "docx" | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"; // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx"; // PK zip
  return null;
}

export async function resumeText(file: unknown): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new ResumeProblem("Choose a PDF or Word (.docx) file first.");
  if (file.size > MAX_RESUME_BYTES) throw new ResumeProblem("That file is over 5 MB. Export a smaller PDF and try again.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = kind(bytes);
  let text: string;
  try {
    if (type === "pdf") {
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > MAX_PAGES) throw new ResumeProblem(`That PDF has ${pdf.numPages} pages. Upload a resume of ${MAX_PAGES} pages or fewer.`);
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (type === "docx") {
      // mammoth's externalFileAccess defaults to off, so a .docx can't make the server read other files
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else {
      throw new ResumeProblem("Only PDF and Word (.docx) files work. Old .doc files need saving as .docx first.");
    }
  } catch (err) {
    if (err instanceof ResumeProblem) throw err;
    throw new ResumeProblem("Couldn't read that file. Try exporting it again as a PDF.");
  }

  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 200) {
    throw new ResumeProblem("Found almost no text in that file. If it's a scanned image, export a text PDF from Word or Google Docs instead.");
  }
  return clean.slice(0, MAX_TEXT);
}
