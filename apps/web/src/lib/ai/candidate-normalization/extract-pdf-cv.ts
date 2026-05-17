import { extractText, getDocumentProxy } from "unpdf";

import type { CvExtractionStatus } from "../shared/types";
import { countWords } from "../shared/truncate";
import { PDF_FAILURE_MESSAGE } from "./extract-markdown-cv";

const EXTRACTION_METHOD = "unpdf-v1";

export async function extractPdfCv(input: {
  fileName: string;
  bytes: Uint8Array;
}): Promise<{
  markdown: string;
  status: CvExtractionStatus;
  warnings: string[];
  wordCount: number;
}> {
  try {
    // pdf.js VerbosityLevel.ERRORS — suppress benign TrueType font warnings on some CVs
    const pdf = await getDocumentProxy(input.bytes, { verbosity: 0 });
    const { text } = await extractText(pdf, { mergePages: true });
    const markdown = String(text ?? "").trim();

    if (!markdown) {
      return {
        markdown: "",
        status: "failed",
        warnings: [PDF_FAILURE_MESSAGE],
        wordCount: 0,
      };
    }

    const formatted = `# Extracted CV\n\n${markdown}`;
    return {
      markdown: formatted,
      status: "success",
      warnings: [`extraction_method:${EXTRACTION_METHOD}`],
      wordCount: countWords(formatted),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      markdown: "",
      status: "failed",
      warnings: [PDF_FAILURE_MESSAGE, `technical:${detail.slice(0, 200)}`],
      wordCount: 0,
    };
  }
}
