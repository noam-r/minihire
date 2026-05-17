import type MarkdownIt from "markdown-it";
import PDFDocument from "pdfkit";

type MarkdownToken = ReturnType<MarkdownIt["parse"]>[number];

const PAGE_MARGIN = 54;
const BODY_SIZE = 10.5;
const BODY_LINE_GAP = 3;
const BODY_COLOR = "#1e293b";
const MUTED_COLOR = "#64748b";
const HEADING_COLOR = "#0f172a";
const H3_COLOR = "#334155";
const BORDER_COLOR = "#e2e8f0";
const ACCENT_COLOR = "#0f766e";
const QUOTE_BG = "#f0fdfa";
const QUOTE_BORDER = "#14b8a6";
const TABLE_HEADER_BG = "#f1f5f9";
const TABLE_ROW_ALT_BG = "#f8fafc";

const HEADING_STYLES: Record<
  string,
  { size: number; spaceBefore: number; spaceAfter: number; underline?: boolean }
> = {
  h1: { size: 22, spaceBefore: 0, spaceAfter: 14 },
  h2: { size: 15, spaceBefore: 20, spaceAfter: 10, underline: true },
  h3: { size: 12.5, spaceBefore: 14, spaceAfter: 8 },
};

type FontStyle = {
  bold: boolean;
  italic: boolean;
  code: boolean;
};

type InlineRenderOptions = {
  width: number;
  x?: number;
  color?: string;
  fontSize?: number;
  lineGap?: number;
};

function textX(doc: PDFKit.PDFDocument): number {
  return doc.page.margins.left;
}

function textWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function textRight(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.right;
}

function bottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height > bottomLimit(doc)) {
    doc.addPage();
  }
}

function fontName(style: FontStyle): string {
  if (style.code) {
    return "Courier";
  }
  if (style.bold && style.italic) {
    return "Helvetica-BoldOblique";
  }
  if (style.bold) {
    return "Helvetica-Bold";
  }
  if (style.italic) {
    return "Helvetica-Oblique";
  }
  return "Helvetica";
}

function resetBodyStyle(doc: PDFKit.PDFDocument): void {
  doc.font("Helvetica").fontSize(BODY_SIZE).fillColor(BODY_COLOR);
}

function inlinePlainText(token: MarkdownToken | undefined): string {
  if (!token?.children?.length) {
    return "";
  }
  return token.children
    .filter((child: MarkdownToken) => child.type === "text" || child.type === "code_inline")
    .map((child: MarkdownToken) => child.content)
    .join("");
}

function hasMoreInlineText(children: MarkdownToken[], fromIndex: number): boolean {
  for (let i = fromIndex + 1; i < children.length; i++) {
    const child = children[i];
    if (child.type === "text" || child.type === "code_inline") {
      return true;
    }
  }
  return false;
}

function renderInline(doc: PDFKit.PDFDocument, inlineToken: MarkdownToken | undefined, options: InlineRenderOptions): number {
  if (!inlineToken?.children?.length) {
    return doc.y;
  }

  const style: FontStyle = { bold: false, italic: false, code: false };
  const fontSize = options.fontSize ?? BODY_SIZE;
  const lineGap = options.lineGap ?? BODY_LINE_GAP;
  const color = options.color ?? BODY_COLOR;
  const x = options.x ?? textX(doc);
  doc.fillColor(color);

  let continued = false;
  const startY = doc.y;

  for (let i = 0; i < inlineToken.children.length; i++) {
    const child = inlineToken.children[i];
    switch (child.type) {
      case "text":
      case "code_inline": {
        if (child.type === "code_inline") {
          style.code = true;
        }
        const chunkSize = style.code ? fontSize - 1 : fontSize;
        doc.font(fontName(style)).fontSize(chunkSize);
        const text = child.content;
        const hasMore = hasMoreInlineText(inlineToken.children, i);
        doc.text(text, x, continued ? undefined : startY, {
          width: options.width,
          continued: hasMore,
          lineGap,
        });
        continued = true;
        if (child.type === "code_inline") {
          style.code = false;
        }
        break;
      }
      case "strong_open":
        style.bold = true;
        break;
      case "strong_close":
        style.bold = false;
        break;
      case "em_open":
        style.italic = true;
        break;
      case "em_close":
        style.italic = false;
        break;
      case "softbreak":
      case "hardbreak":
        doc.text(" ", x, undefined, { width: options.width, continued: true });
        break;
      default:
        break;
    }
  }

  resetBodyStyle(doc);
  return doc.y;
}

function hasInlineFormatting(token: MarkdownToken | undefined): boolean {
  return (
    token?.children?.some(
      (child) =>
        child.type === "strong_open" ||
        child.type === "em_open" ||
        child.type === "code_inline" ||
        child.type === "link_open",
    ) ?? false
  );
}

function renderParagraph(doc: PDFKit.PDFDocument, inlineToken: MarkdownToken | undefined): void {
  const width = textWidth(doc);
  const text = inlinePlainText(inlineToken);
  if (!text.trim()) {
    doc.moveDown(0.4);
    return;
  }

  ensureSpace(doc, BODY_SIZE * 3);
  resetBodyStyle(doc);
  if (hasInlineFormatting(inlineToken)) {
    renderInline(doc, inlineToken, { width, lineGap: BODY_LINE_GAP });
  } else {
    doc.text(text, textX(doc), doc.y, { width, lineGap: BODY_LINE_GAP });
  }
  doc.moveDown(0.55);
}

function renderHeading(
  doc: PDFKit.PDFDocument,
  tag: string,
  inlineToken: MarkdownToken | undefined,
  context: { h1Index: number },
): void {
  const style = HEADING_STYLES[tag] ?? HEADING_STYLES.h3;
  const width = textWidth(doc);
  const text = inlinePlainText(inlineToken);
  if (!text.trim()) {
    return;
  }

  const isExportTitle = tag === "h1" && context.h1Index === 1;
  const fontSize = isExportTitle ? 24 : style.size;
  const spaceBefore = isExportTitle ? 0 : style.spaceBefore;

  ensureSpace(doc, fontSize * 2 + spaceBefore);
  doc.y += spaceBefore;

  const headingColor = tag === "h3" ? H3_COLOR : HEADING_COLOR;
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(headingColor);
  const startY = doc.y;
  doc.text(text, textX(doc), startY, { width, lineGap: 2 });

  if (style.underline) {
    const lineY = doc.y + 5;
    doc
      .strokeColor(BORDER_COLOR)
      .lineWidth(1)
      .moveTo(textX(doc), lineY)
      .lineTo(textRight(doc), lineY)
      .stroke();
    doc.y = lineY + style.spaceAfter;
  } else {
    doc.y = Math.max(doc.y, startY + fontSize) + style.spaceAfter - 4;
  }

  resetBodyStyle(doc);
}

function renderBlockquote(doc: PDFKit.PDFDocument, tokens: MarkdownToken[], startIndex: number): number {
  let i = startIndex + 1;
  const innerWidth = textWidth(doc) - 28;
  const textStartX = textX(doc) + 16;
  const boxX = textX(doc);
  const boxWidth = textWidth(doc);
  const paddingY = 10;

  const paragraphs: string[] = [];
  while (i < tokens.length && tokens[i].type !== "blockquote_close") {
    if (tokens[i].type === "paragraph_open") {
      paragraphs.push(inlinePlainText(tokens[i + 1]));
      i += 3;
      continue;
    }
    i += 1;
  }

  if (!paragraphs.length) {
    return i + 1;
  }

  doc.font("Helvetica-Oblique").fontSize(9.5);
  let blockHeight = paddingY * 2;
  for (const paragraph of paragraphs) {
    blockHeight += doc.heightOfString(paragraph, { width: innerWidth, lineGap: 2 }) + 4;
  }

  ensureSpace(doc, blockHeight + 8);
  const boxTop = doc.y;

  doc.save().fill(QUOTE_BG).rect(boxX, boxTop, boxWidth, blockHeight).fill().restore();
  doc
    .save()
    .fill(QUOTE_BORDER)
    .rect(boxX, boxTop, 4, blockHeight)
    .fill()
    .restore();

  let textY = boxTop + paddingY;
  for (const paragraph of paragraphs) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED_COLOR);
    doc.text(paragraph, textStartX, textY, { width: innerWidth, lineGap: 2 });
    textY = doc.y + 4;
  }

  doc.y = boxTop + blockHeight + 12;
  doc.x = textX(doc);
  resetBodyStyle(doc);
  return i + 1;
}

function collectTableRows(tokens: MarkdownToken[], startIndex: number): string[][] {
  const rows: string[][] = [];
  let i = startIndex + 1;

  while (i < tokens.length && tokens[i].type !== "table_close") {
    if (tokens[i].type === "tr_open") {
      const row: string[] = [];
      i += 1;
      while (i < tokens.length && tokens[i].type !== "tr_close") {
        if (tokens[i].type === "th_open" || tokens[i].type === "td_open") {
          row.push(inlinePlainText(tokens[i + 1]));
          i += 3;
          continue;
        }
        i += 1;
      }
      rows.push(row);
    }
    i += 1;
  }

  return rows;
}

function renderTable(doc: PDFKit.PDFDocument, tokens: MarkdownToken[], startIndex: number): number {
  const rows = collectTableRows(tokens, startIndex);
  if (!rows.length) {
    return startIndex + 1;
  }

  doc.moveDown(0.3);

  const colCount = Math.max(...rows.map((row) => row.length));
  const width = textWidth(doc);
  const colWidth = width / colCount;
  const cellPaddingX = 8;
  const cellPaddingY = 7;
  const fontSize = 9.5;

  let i = startIndex;
  while (i < tokens.length && tokens[i].type !== "table_close") {
    i += 1;
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const isHeader = rowIndex === 0;
    let rowHeight = fontSize * 1.5 + cellPaddingY * 2;

    for (let col = 0; col < colCount; col++) {
      const cellText = row[col] ?? "";
      doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
      const cellHeight = doc.heightOfString(cellText, {
        width: colWidth - cellPaddingX * 2,
      });
      rowHeight = Math.max(rowHeight, cellHeight + cellPaddingY * 2);
    }

    ensureSpace(doc, rowHeight + 6);

    const y = doc.y;
    for (let col = 0; col < colCount; col++) {
      const x = textX(doc) + col * colWidth;
      const bg = isHeader ? TABLE_HEADER_BG : rowIndex % 2 === 0 ? "#ffffff" : TABLE_ROW_ALT_BG;
      doc.save().fill(bg).rect(x, y, colWidth, rowHeight).fill().restore();
      doc.strokeColor(BORDER_COLOR).lineWidth(0.75).rect(x, y, colWidth, rowHeight).stroke();

      const cellText = row[col] ?? "";
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(fontSize)
        .fillColor(isHeader ? MUTED_COLOR : BODY_COLOR)
        .text(cellText, x + cellPaddingX, y + cellPaddingY, {
          width: colWidth - cellPaddingX * 2,
          lineGap: 1,
        });
    }

    doc.y = y + rowHeight;
    doc.x = textX(doc);
  }

  doc.moveDown(0.8);
  resetBodyStyle(doc);
  return i + 1;
}

function renderList(
  doc: PDFKit.PDFDocument,
  tokens: MarkdownToken[],
  startIndex: number,
  ordered: boolean,
): number {
  let i = startIndex + 1;
  let itemNumber = 1;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
      doc.moveDown(0.35);
      return i + 1;
    }

    if (token.type === "list_item_open") {
      const inline = tokens[i + 2];
      const prefix = ordered ? `${itemNumber}. ` : "• ";
      itemNumber += 1;
      const x = textX(doc);
      const width = textWidth(doc);
      ensureSpace(doc, BODY_SIZE * 2.5);
      resetBodyStyle(doc);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(BODY_SIZE).fillColor(ACCENT_COLOR);
      doc.text(prefix, x, y, { lineBreak: false });
      const prefixWidth = doc.widthOfString(prefix);
      renderInline(doc, inline, {
        width: width - prefixWidth,
        x: x + prefixWidth,
        lineGap: BODY_LINE_GAP,
      });
      doc.moveDown(0.35);
      i += 4;
      continue;
    }

    i += 1;
  }

  return i;
}

function renderHorizontalRule(doc: PDFKit.PDFDocument): void {
  doc.moveDown(0.6);
  ensureSpace(doc, 20);
  const y = doc.y;
  doc
    .strokeColor(BORDER_COLOR)
    .lineWidth(1)
    .moveTo(textX(doc), y)
    .lineTo(textRight(doc), y)
    .stroke();
  doc.y = y + 18;
}

export function renderMarkdownTokensToPdfBuffer(tokens: MarkdownToken[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      resetBodyStyle(doc);
      let h1Index = 0;
      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i];
        switch (token.type) {
          case "heading_open":
            if (token.tag === "h1") {
              h1Index += 1;
            }
            renderHeading(doc, token.tag, tokens[i + 1], { h1Index });
            i += 3;
            break;
          case "paragraph_open":
            renderParagraph(doc, tokens[i + 1]);
            i += 3;
            break;
          case "blockquote_open":
            i = renderBlockquote(doc, tokens, i);
            break;
          case "bullet_list_open":
            i = renderList(doc, tokens, i, false);
            break;
          case "ordered_list_open":
            i = renderList(doc, tokens, i, true);
            break;
          case "table_open":
            i = renderTable(doc, tokens, i);
            break;
          case "hr":
            renderHorizontalRule(doc);
            i += 1;
            break;
          case "fence":
          case "code_block":
            ensureSpace(doc, BODY_SIZE * 2);
            doc.font("Courier").fontSize(9).fillColor(BODY_COLOR);
            doc.text(token.content.trimEnd(), textX(doc), doc.y, {
              width: textWidth(doc),
              lineGap: 1,
            });
            doc.moveDown(0.6);
            resetBodyStyle(doc);
            i += 1;
            break;
          default:
            i += 1;
            break;
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
