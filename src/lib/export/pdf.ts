import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LetterDocument, Party } from "@/lib/templates/types";

const MM = 72 / 25.4;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const MARGIN = 25 * MM;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const RIGHT_BLOCK_X = MARGIN + 90 * MM;
const RIGHT_BLOCK_WIDTH = PAGE_WIDTH - MARGIN - RIGHT_BLOCK_X;

const FONT_SIZE = 11;
const TITLE_SIZE = 13;
const LINE_HEIGHT = FONT_SIZE * 1.35;
const PARAGRAPH_GAP = 8;
const TEXT_COLOR = rgb(0, 0, 0);

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

function loadFonts(): { regular: Uint8Array; bold: Uint8Array } {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "src/assets/fonts");
    fontCache = {
      regular: fs.readFileSync(path.join(dir, "DejaVuSans.ttf")),
      bold: fs.readFileSync(path.join(dir, "DejaVuSans-Bold.ttf")),
    };
  }
  return fontCache;
}

/** Usuwa znaki sterujące (poza \n), tabulatory zamienia na spacje. */
function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
}

interface Line {
  words: string[];
  /** ostatni wiersz akapitu (lub przed twardym \n) – bez justowania */
  last: boolean;
}

class PdfLayout {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.newPage();
  }

  newPage(): void {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  get cursor(): number {
    return this.y;
  }

  set cursor(v: number) {
    this.y = v;
  }

  /** Przechodzi na nową stronę, jeśli brakuje miejsca na `height` punktów. */
  ensureSpace(height: number): void {
    if (this.y - height < MARGIN) this.newPage();
  }

  gap(h: number): void {
    this.y -= h;
  }

  width(text: string, font: PDFFont, size: number): number {
    return font.widthOfTextAtSize(text, size);
  }

  /** Łamanie wierszy po szerokości; zbyt długie słowa dzielone są po znakach. */
  wrap(text: string, font: PDFFont, size: number, maxWidth: number): Line[] {
    const result: Line[] = [];
    const spaceW = this.width(" ", font, size);
    for (const hardLine of clean(text).split("\n")) {
      const words = hardLine.split(/ +/).filter(Boolean);
      if (words.length === 0) {
        result.push({ words: [], last: true });
        continue;
      }
      let current: string[] = [];
      let currentW = 0;
      const pushWord = (w: string) => {
        const ww = this.width(w, font, size);
        const needed = current.length ? currentW + spaceW + ww : ww;
        if (needed <= maxWidth) {
          current.push(w);
          currentW = needed;
          return;
        }
        if (current.length) {
          result.push({ words: current, last: false });
          current = [];
          currentW = 0;
        }
        if (ww <= maxWidth) {
          current = [w];
          currentW = ww;
          return;
        }
        // słowo dłuższe niż wiersz – tniemy po znakach
        let chunk = "";
        for (const ch of Array.from(w)) {
          if (this.width(chunk + ch, font, size) > maxWidth && chunk) {
            result.push({ words: [chunk], last: false });
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = [chunk];
        currentW = this.width(chunk, font, size);
      };
      words.forEach(pushWord);
      result.push({ words: current, last: true });
    }
    return result;
  }

  /**
   * Rysuje tekst z zawijaniem. align: left | right | center | justify.
   * Zwraca liczbę wierszy.
   */
  text(
    text: string,
    opts: { x?: number; width?: number; font?: PDFFont; size?: number; align?: "left" | "right" | "center" | "justify"; lineHeight?: number } = {},
  ): number {
    const font = opts.font ?? this.regular;
    const size = opts.size ?? FONT_SIZE;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.width ?? CONTENT_WIDTH;
    const lh = opts.lineHeight ?? size * 1.35;
    const align = opts.align ?? "left";
    const lines = this.wrap(text, font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lh);
      this.y -= lh;
      const baseline = this.y + (lh - size) / 2 + size * 0.22;
      if (line.words.length === 0) continue;
      const joined = line.words.join(" ");
      const w = this.width(joined, font, size);
      if (align === "justify" && !line.last && line.words.length > 1) {
        const wordsW = line.words.reduce((s, word) => s + this.width(word, font, size), 0);
        const gapW = (maxWidth - wordsW) / (line.words.length - 1);
        let cx = x;
        for (const word of line.words) {
          this.page.drawText(word, { x: cx, y: baseline, size, font, color: TEXT_COLOR });
          cx += this.width(word, font, size) + gapW;
        }
        continue;
      }
      let dx = x;
      if (align === "right") dx = x + maxWidth - w;
      else if (align === "center") dx = x + (maxWidth - w) / 2;
      this.page.drawText(joined, { x: dx, y: baseline, size, font, color: TEXT_COLOR });
    }
    return lines.length;
  }

  /** Wysokość, jaką zajmie tekst (do decyzji o przeniesieniu bloku na nową stronę). */
  measure(text: string, font: PDFFont, size: number, width: number, lh = size * 1.35): number {
    return this.wrap(text, font, size, width).length * lh;
  }
}

/** Element listy: znacznik (punktor / numer) + tekst z wcięciem. */
function prefixed(L: PdfLayout, marker: string, text: string, align: "left" | "justify"): void {
  const indent = 20;
  L.ensureSpace(LINE_HEIGHT); // pierwszy wiersz elementu zawsze na tej samej stronie co znacznik
  const start = L.cursor;
  L.text(marker, { x: MARGIN + 4, width: indent - 4 });
  L.cursor = start;
  L.text(text, { x: MARGIN + indent, width: CONTENT_WIDTH - indent, align });
}

function partyLines(party: Party): string[] {
  return [party.name, ...party.addressLines, ...(party.extra ?? [])].filter(Boolean);
}

export async function renderPdf(doc: LetterDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(doc.title);
  pdf.setCreator("Generator pism i odwołań");
  pdf.setProducer("Generator pism i odwołań");
  pdf.setLanguage("pl-PL");

  const fonts = loadFonts();
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const L = new PdfLayout(pdf, regular, bold);

  // Nagłówek: nadawca (lewo) + miejscowość i data (prawo) na tej samej wysokości
  const top = L.cursor;
  const leftWidth = CONTENT_WIDTH * 0.55;
  partyLines(doc.sender).forEach((line, i) => {
    L.text(line, { width: leftWidth, font: i === 0 ? bold : regular });
  });
  const afterSender = L.cursor;
  L.cursor = top;
  L.text(`${doc.place}, ${doc.date}`, { x: MARGIN + leftWidth, width: CONTENT_WIDTH - leftWidth, align: "right" });
  L.cursor = Math.min(afterSender, L.cursor);

  // Adresat
  L.gap(24);
  partyLines(doc.recipient).forEach((line, i) => {
    L.text(line, { x: RIGHT_BLOCK_X, width: RIGHT_BLOCK_WIDTH, font: i === 0 ? bold : regular });
  });

  // Tytuł
  L.gap(32);
  L.text(doc.title, { font: bold, size: TITLE_SIZE, align: "center" });
  if (doc.subject) {
    L.gap(4);
    L.text(doc.subject, { align: "center" });
  }
  L.gap(20);

  if (doc.salutation) {
    L.text(doc.salutation);
    L.gap(PARAGRAPH_GAP);
  }

  for (const para of doc.paragraphs) {
    if (para.type === "heading") {
      // nagłówek nie może zostać sam na dole strony
      L.ensureSpace(L.measure(para.text, bold, FONT_SIZE, CONTENT_WIDTH) + 2 * LINE_HEIGHT + 8);
      L.gap(8);
      L.text(para.text, { font: bold });
      L.gap(4);
    } else if (para.type === "list") {
      for (const item of para.items) {
        prefixed(L, "•", item, "justify");
        L.gap(2);
      }
      L.gap(PARAGRAPH_GAP);
    } else {
      L.text(para.text, { align: "justify" });
      L.gap(PARAGRAPH_GAP);
    }
  }

  // Zakończenie i podpis (blok trzymany razem)
  L.gap(16);
  L.ensureSpace(LINE_HEIGHT * 4 + 36);
  L.text(doc.closing, { x: RIGHT_BLOCK_X, width: RIGHT_BLOCK_WIDTH, align: "center" });
  L.gap(36);
  L.text("………………………………", { x: RIGHT_BLOCK_X, width: RIGHT_BLOCK_WIDTH, align: "center" });
  L.text(doc.signatureName, { x: RIGHT_BLOCK_X, width: RIGHT_BLOCK_WIDTH, align: "center" });

  if (doc.attachments.length > 0) {
    L.gap(28);
    L.ensureSpace(LINE_HEIGHT * 2);
    L.text("Załączniki:", { font: bold });
    doc.attachments.forEach((att, i) => prefixed(L, `${i + 1}.`, att, "left"));
  }

  // Stopka z numeracją stron
  const pages = pdf.getPages();
  const footerSize = 9;
  pages.forEach((page, i) => {
    const label = `Strona ${i + 1} z ${pages.length}`;
    const w = regular.widthOfTextAtSize(label, footerSize);
    page.drawText(label, {
      x: (PAGE_WIDTH - w) / 2,
      y: MARGIN / 2,
      size: footerSize,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
  });

  return pdf.save();
}
