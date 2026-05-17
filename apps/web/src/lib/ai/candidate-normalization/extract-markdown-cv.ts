import { countWords } from "../shared/truncate";

const PDF_FAILURE_MESSAGE = "PDF to Markdown process failed, cannot read PDF file.";

export async function extractMarkdownCv(input: {
  fileName: string;
  bytes: Uint8Array;
}): Promise<{
  markdown: string;
  warnings: string[];
  wordCount: number;
}> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
  const markdown = text.trim();
  if (!markdown) {
    throw new Error("Uploaded Markdown/text CV is empty");
  }

  return {
    markdown,
    warnings: [],
    wordCount: countWords(markdown),
  };
}

export { PDF_FAILURE_MESSAGE };
