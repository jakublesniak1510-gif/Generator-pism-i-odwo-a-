import {
  AlignmentType,
  Document,
  Footer,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { LetterDocument, Party } from "@/lib/templates/types";

const FONT = "Calibri";
const SIZE = 22; // half-points => 11 pt
const MARGIN = convertMillimetersToTwip(25);
const TEXT_WIDTH = convertMillimetersToTwip(210 - 50);
const RIGHT_BLOCK_INDENT = convertMillimetersToTwip(90);
const PARAGRAPH_SPACING = 160; // twips po akapicie

const BULLETS = "bullets";
const ATTACHMENTS = "attachments";

/** Tekst z pojedynczymi \n zamienia na runy z łamaniem wiersza. */
function runs(text: string, opts: { bold?: boolean; size?: number; italics?: boolean } = {}): TextRun[] {
  return text.split("\n").map(
    (line, i) => new TextRun({ text: line, bold: opts.bold, italics: opts.italics, size: opts.size, break: i > 0 ? 1 : undefined }),
  );
}

function partyParagraphs(party: Party, alignment: (typeof AlignmentType)[keyof typeof AlignmentType], indentLeft = 0): Paragraph[] {
  const lines = [party.name, ...party.addressLines, ...(party.extra ?? [])].filter(Boolean);
  return lines.map(
    (line, i) =>
      new Paragraph({
        alignment,
        indent: indentLeft ? { left: indentLeft } : undefined,
        spacing: { after: 0 },
        children: runs(line, { bold: i === 0 }),
      }),
  );
}

function headerTable(doc: LetterDocument): Table {
  const leftWidth = Math.round(TEXT_WIDTH * 0.55);
  const rightWidth = TEXT_WIDTH - leftWidth;
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftWidth, rightWidth],
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftWidth, type: WidthType.DXA },
            children: partyParagraphs(doc.sender, AlignmentType.LEFT),
          }),
          new TableCell({
            width: { size: rightWidth, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: runs(`${doc.place}, ${doc.date}`),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function renderDocx(doc: LetterDocument): Promise<Buffer> {
  const body: (Paragraph | Table)[] = [];

  body.push(headerTable(doc));
  body.push(new Paragraph({ spacing: { after: 360 }, children: [] }));

  // Adresat – po prawej stronie, z wcięciem
  body.push(...partyParagraphs(doc.recipient, AlignmentType.LEFT, RIGHT_BLOCK_INDENT));
  body.push(new Paragraph({ spacing: { after: 480 }, children: [] }));

  // Tytuł
  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: doc.subject ? 120 : 360 },
      children: runs(doc.title, { bold: true, size: 26 }),
    }),
  );
  if (doc.subject) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: runs(doc.subject, { italics: true }),
      }),
    );
  }

  if (doc.salutation) {
    body.push(new Paragraph({ spacing: { after: PARAGRAPH_SPACING }, children: runs(doc.salutation) }));
  }

  for (const para of doc.paragraphs) {
    if (para.type === "heading") {
      body.push(
        new Paragraph({
          keepNext: true,
          spacing: { before: 240, after: 120 },
          children: runs(para.text, { bold: true }),
        }),
      );
    } else if (para.type === "list") {
      para.items.forEach((item, i) => {
        body.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            numbering: { reference: BULLETS, level: 0 },
            spacing: { after: i === para.items.length - 1 ? PARAGRAPH_SPACING : 60 },
            children: runs(item),
          }),
        );
      });
    } else {
      body.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: PARAGRAPH_SPACING, line: 276 },
          children: runs(para.text),
        }),
      );
    }
  }

  // Zakończenie i podpis
  body.push(
    new Paragraph({
      indent: { left: RIGHT_BLOCK_INDENT },
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 720 },
      keepNext: true,
      children: runs(doc.closing),
    }),
  );
  body.push(
    new Paragraph({
      indent: { left: RIGHT_BLOCK_INDENT },
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      keepNext: true,
      children: runs("………………………………"),
    }),
  );
  body.push(
    new Paragraph({
      indent: { left: RIGHT_BLOCK_INDENT },
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: runs(doc.signatureName),
    }),
  );

  if (doc.attachments.length > 0) {
    body.push(
      new Paragraph({ keepNext: true, spacing: { after: 60 }, children: runs("Załączniki:", { bold: true }) }),
    );
    for (const att of doc.attachments) {
      body.push(
        new Paragraph({
          numbering: { reference: ATTACHMENTS, level: 0 },
          spacing: { after: 40 },
          children: runs(att),
        }),
      );
    }
  }

  const document = new Document({
    creator: "Generator pism i odwołań",
    title: doc.title,
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: { after: 0 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 567, hanging: 283 } } },
            },
          ],
        },
        {
          reference: ATTACHMENTS,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 567, hanging: 283 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Strona ", PageNumber.CURRENT, " z ", PageNumber.TOTAL_PAGES], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(document);
}
