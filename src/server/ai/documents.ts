// Generates REAL Office documents (Word .docx / Excel .xlsx) as in-memory
// buffers, ready to upload to S3. Pure module: no DB, no S3, no network.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
} from "pdf-lib";

// Julow brand accent (used for headings + Excel header fill).
const BRAND = "2563EB";
const BRAND_SOFT = "EFF3FF";

function todayLabel(): string {
  return new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export type DocSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type GeneratedFile = {
  buffer: Buffer;
  filename: string;
  mime: string;
  ext: "docx" | "xlsx" | "pdf";
};

export type SheetSpec = {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, string | number | null>[];
};

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileName(title: string, ext: "docx" | "xlsx" | "pdf"): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "document";
  return `${slug}-${Date.now().toString(36)}.${ext}`;
}

export async function buildWordDocument(input: {
  title: string;
  subtitle?: string;
  sections: DocSection[];
}): Promise<GeneratedFile> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: input.title, bold: true, color: BRAND, size: 44 }),
      ],
    }),
    // Brand + date line, then a thin divider rule.
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `Julow · ${input.subtitle ? `${input.subtitle} · ` : ""}${todayLabel()}`,
          italics: true,
          color: "6B7280",
          size: 18,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { color: "D1D5DB", style: BorderStyle.SINGLE, size: 6, space: 1 },
      },
      children: [],
    }),
  ];

  for (const section of input.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          children: [
            new TextRun({ text: section.heading, bold: true, color: BRAND, size: 26 }),
          ],
        }),
      );
    }
    for (const p of section.paragraphs ?? []) {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 276 },
          children: [new TextRun({ text: p, size: 22 })],
        }),
      );
    }
    for (const b of section.bullets ?? []) {
      children.push(
        new Paragraph({
          text: b,
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
    }
  }

  // Footer note.
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "Сгенерировано Julow",
          italics: true,
          color: "9CA3AF",
          size: 16,
        }),
      ],
    }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    filename: fileName(input.title, "docx"),
    mime: DOCX_MIME,
    ext: "docx",
  };
}

const PDF_MIME = "application/pdf";

export async function buildPdfDocument(input: {
  title: string;
  subtitle?: string;
  sections: DocSection[];
}): Promise<GeneratedFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  const BRAND_RGB = rgb(0x25 / 255, 0x63 / 255, 0xeb / 255);
  const MUTED_RGB = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
  const TEXT_RGB = rgb(0x11 / 255, 0x18 / 255, 0x27 / 255);

  const PAGE_W = 595.28; // A4 width in points
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE_H = 16;
  const HEADING_H = 24;
  const BULLET_INDENT = 20;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawText(text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>, indent = 0) {
    const maxWidth = CONTENT_W - indent;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        ensureSpace(LINE_H);
        page.drawText(line, { x: MARGIN + indent, y, size, font, color });
        y -= LINE_H;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ensureSpace(LINE_H);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color });
      y -= LINE_H;
    }
  }

  // Title
  ensureSpace(40);
  page.drawText(input.title, { x: MARGIN, y, size: 24, font: boldFont, color: BRAND_RGB });
  y -= 30;

  // Subtitle / date
  const subtitleLine = `Julow · ${input.subtitle ? `${input.subtitle} · ` : ""}${todayLabel()}`;
  ensureSpace(LINE_H);
  page.drawText(subtitleLine, { x: MARGIN, y, size: 10, font: italicFont, color: MUTED_RGB });
  y -= LINE_H;

  // Divider
  ensureSpace(10);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0xd1 / 255, 0xd5 / 255, 0xdb / 255),
  });
  y -= 20;

  for (const section of input.sections) {
    if (section.heading) {
      ensureSpace(HEADING_H);
      page.drawText(section.heading, { x: MARGIN, y, size: 14, font: boldFont, color: BRAND_RGB });
      y -= HEADING_H;
    }
    for (const p of section.paragraphs ?? []) {
      drawText(p, font, 11, TEXT_RGB);
      y -= 4;
    }
    for (const b of section.bullets ?? []) {
      ensureSpace(LINE_H);
      page.drawText("•", { x: MARGIN, y, size: 11, font, color: TEXT_RGB });
      drawText(b, font, 11, TEXT_RGB, BULLET_INDENT);
      y -= 2;
    }
    y -= 8;
  }

  // Footer
  ensureSpace(LINE_H);
  y = MARGIN;
  page.drawText("Generated by Julow", {
    x: PAGE_W - MARGIN - italicFont.widthOfTextAtSize("Generated by Julow", 9),
    y,
    size: 9,
    font: italicFont,
    color: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  });

  const buffer = Buffer.from(await doc.save());
  return {
    buffer,
    filename: fileName(input.title, "pdf"),
    mime: PDF_MIME,
    ext: "pdf",
  };
}

export async function buildExcelWorkbook(input: {
  title: string;
  sheets: SheetSpec[];
}): Promise<GeneratedFile> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Julow";
  wb.created = new Date();
  const sheets = input.sheets.length
    ? input.sheets
    : [{ name: "Sheet1", columns: [{ header: "Item", key: "item" }], rows: [] }];
  for (const spec of sheets) {
    const ws = wb.addWorksheet((spec.name || "Sheet1").slice(0, 28), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = spec.columns.map((c) => ({
      header: c.header,
      key: c.key,
      // Reasonable width: header length with sensible min/max.
      width: c.width ?? Math.min(48, Math.max(14, c.header.length + 6)),
    }));

    // Styled header row.
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${BRAND}` },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF1E40AF" } },
      };
    });

    spec.rows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        };
        if (i % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: `FF${BRAND_SOFT}` },
          };
        }
      });
    });

    // Filter + freeze for a polished, usable sheet.
    if (spec.columns.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: spec.columns.length },
      };
    }
  }
  const arr = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arr as ArrayBuffer),
    filename: fileName(input.title, "xlsx"),
    mime: XLSX_MIME,
    ext: "xlsx",
  };
}
