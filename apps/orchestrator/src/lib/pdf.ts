// Wrapper around pdf-parse. Returns plain text; whitespace not normalized
// because the verifier's substring-match logic needs character-faithful text.

import pdfParse from "pdf-parse";

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const result = await pdfParse(Buffer.from(bytes));
  return result.text;
}
