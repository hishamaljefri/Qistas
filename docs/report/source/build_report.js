// Builds CPCS499_GroupC03_R1.docx: QISTAS Project Report Part I.
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun,
  VerticalAlign, WidthType, TabStopType,
} = require("docx");

const DIR = __dirname;
const SIZES = JSON.parse(fs.readFileSync(path.join(DIR, "sizes.json"), "utf8"));
const FONT = "Times New Roman";
const CONTENT_DXA = 9026; // A4 width 11906 - 2 x 1440 margins
const MAX_W_PX = 600;
const MAX_H_PX = 760;
const GREEN = "1F5F4A";

// ---------- figure/table numbering (static, so it renders the same in Word, LibreOffice and PDF) ----------
let PREV = { Figure: {}, Table: {} }; // ids -> numbers from the previous build pass
let REG, CAPTIONS;
function resetRegistry() { REG = { Figure: {}, Table: {}, n: { Figure: 0, Table: 0 } }; CAPTIONS = []; }
resetRegistry();
const PAGES = fs.existsSync(path.join(DIR, "pages.json")) ? JSON.parse(fs.readFileSync(path.join(DIR, "pages.json"), "utf8")) : {};
const resolveRefs = (t) => String(t).replace(/\{(fig|tab):([a-z0-9_]+)\}/g, (_, k, id) => String(PREV[k === "fig" ? "Figure" : "Table"][id] ?? "?"));

// ---------- text helpers ----------
const ARABIC = /([؀-ۿ][؀-ۿ\s،؛؟\-–()0-9.]*[؀-ۿ)]|[؀-ۿ])/g;

/** "**bold**", "*italic*" and Arabic segments → TextRuns */
function runs(text, base = {}) {
  const out = [];
  const parts = resolveRefs(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((s) => s !== "");
  for (const part of parts) {
    let style = { ...base };
    let t = part;
    if (/^\*\*[^*]+\*\*$/.test(part)) { style.bold = true; t = part.slice(2, -2); }
    else if (/^\*[^*]+\*$/.test(part)) { style.italics = true; t = part.slice(1, -1); }
    for (const seg of t.split(ARABIC).filter((s) => s !== "")) {
      const arabic = /[؀-ۿ]/.test(seg) && ARABIC.test(seg);
      ARABIC.lastIndex = 0;
      out.push(new TextRun({ text: seg, ...style, ...(arabic ? { rightToLeft: true } : {}) }));
    }
  }
  return out;
}

const P = (text, opts = {}) =>
  new Paragraph({ children: runs(text, opts.run), alignment: opts.align ?? AlignmentType.JUSTIFIED, spacing: opts.spacing, keepNext: opts.keepNext, indent: opts.indent });
const H1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, pageBreakBefore: true });
const H1noBreak = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const H2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
const H3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3 });
const bullets = (items, level = 0) => items.map((t) => new Paragraph({ children: runs(t), numbering: { reference: "bullets", level }, alignment: AlignmentType.LEFT }));
const numbered = (items, ref = "steps") => items.map((t) => new Paragraph({ children: runs(t), numbering: { reference: ref, level: 0 }, alignment: AlignmentType.LEFT }));
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---------- captions ----------
function caption(label, text, id) {
  const n = ++REG.n[label];
  if (id) REG[label][id] = n;
  CAPTIONS.push({ label, n, text: resolveRefs(text).replace(/\*/g, "") });
  return new Paragraph({
    style: "Caption",
    alignment: AlignmentType.CENTER,
    keepNext: label === "Table",
    children: [new TextRun({ text: `${label} ${n}: `, bold: true }), ...runs(text)],
  });
}

// ---------- figures ----------
function imageSize(file, maxW = MAX_W_PX, maxH = MAX_H_PX) {
  const [w, h] = SIZES[file];
  const scale = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
function figure(file, text, { maxW = MAX_W_PX, maxH = MAX_H_PX, border = true, id } = {}) {
  const type = file.endsWith(".png") ? "png" : "jpg";
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type, data: fs.readFileSync(path.join(DIR, file)), transformation: imageSize(file, maxW, maxH),
        ...(border ? { outline: { type: "solidFill", solidFillType: "rgb", value: "BFBFBF" } } : {}) })],
    }),
    caption("Figure", text, id),
  ];
}
/** two screenshots side by side, (a) and (b) */
function figurePair(fileA, labelA, fileB, labelB, text, id) {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const cell = (file, label) =>
    new TableCell({
      width: { size: CONTENT_DXA / 2, type: WidthType.DXA },
      borders,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "jpg", data: fs.readFileSync(path.join(DIR, file)), transformation: imageSize(file, 290, 500), outline: { type: "solidFill", solidFillType: "rgb", value: "BFBFBF" } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: label, size: 20 })] }),
      ],
    });
  return [
    new Table({ width: { size: CONTENT_DXA, type: WidthType.DXA }, columnWidths: [CONTENT_DXA / 2, CONTENT_DXA / 2], borders, rows: [new TableRow({ cantSplit: true, children: [cell(fileA, labelA), cell(fileB, labelB)] })] }),
    caption("Figure", text, id),
  ];
}

// ---------- tables ----------
const border = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widthsPct, { title, fontSize = 20, id } = {}) {
  const widths = widthsPct.map((p) => Math.round((CONTENT_DXA * p) / 100));
  widths[widths.length - 1] += CONTENT_DXA - widths.reduce((a, b) => a + b, 0);
  const mkCell = (text, i, header) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "E2EFE9" } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: String(text).split("\n").map((line) => new Paragraph({ spacing: { before: 0, after: 0, line: 252 }, alignment: AlignmentType.LEFT, children: runs(line, { size: fontSize, bold: header || undefined }) })),
    });
  const out = [];
  if (title) out.push(caption("Table", title, id));
  out.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => mkCell(h, i, true)) }),
        ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => mkCell(c, i, false)) })),
      ],
    }),
  );
  out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
  return out;
}

// ---------- content ----------
const buildContent = () => require("./report_content.js")({ P, H1, H1noBreak, H2, H3, bullets, numbered, figure, figurePair, table, pageBreak, runs, caption });
buildContent(); // pass 1: assign numbers
PREV = { Figure: { ...REG.Figure }, Table: { ...REG.Table } };
const coverCaptionCount = 0;

// ---------- cover ----------
const center = (text, size, opts = {}) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 80, before: opts.before ?? 0 }, children: runs(text, { size, bold: opts.bold, color: opts.color }) });
const logo = SIZES["img/kau_logo.png"];
const cover = [
  new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: [3600, 1826, 3600],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 3600, type: WidthType.DXA }, children: ["Kingdom of Saudi Arabia", "Ministry of Education", "King Abdulaziz University", "Faculty of Computing and", "Information Technology"].map((t) => new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: t, size: 20 })] })) }),
          new TableCell({ width: { size: 1826, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(DIR, "img/kau_logo.png")), transformation: { width: 92, height: Math.round((92 * logo[1]) / logo[0]) } })] })] }),
          new TableCell({ width: { size: 3600, type: WidthType.DXA }, children: ["المملكة العربية السعودية", "وزارة التعليم", "جامعة الملك عبدالعزيز", "كلية الحاسبات وتقنية المعلومات"].map((t) => new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { after: 0 }, children: [new TextRun({ text: t, size: 20, rightToLeft: true })] })) }),
        ],
      }),
    ],
  }),
  center("", 24, { before: 1400 }),
  center("CPCS499 – Project II", 32, { bold: true, after: 120 }),
  center("Project Report Part I", 32, { bold: true, after: 700 }),
  center("QISTAS", 52, { bold: true, color: GREEN, after: 120 }),
  center("Intelligent Legal Assistant for Saudi Labor Law Cases", 32, { bold: true, after: 900 }),
  center("Group_C03", 26, { bold: true, after: 200 }),
  ...table(
    ["Student Name", "Student ID"],
    [["Adnan Abdulgader Baothman", "2339973"], ["Salim Ahmed Hamdan", "2343152"], ["Hisham Abdullah Aljefri", "2343199"]],
    [65, 35],
    { fontSize: 24 },
  ),
  center("Supervisors: Prof. Ameen Yousef Noaman, Prof. Asaad Ahmad", 24, { before: 500, after: 120 }),
  center("Department of Computer Science", 24, { after: 120 }),
  center("Date of Submission: 11/10/2026", 24, { after: 0 }),
];

// pass 2: real content with resolved references (cover tables have no captions, so numbering is unaffected)
resetRegistry();
const content = buildContent();

// ---------- static List of Figures / Tables (page numbers measured from the rendered PDF) ----------
const listEntries = (label) =>
  CAPTIONS.filter((c) => c.label === label).map(
    (c) =>
      new Paragraph({
        spacing: { after: 60, line: 276 },
        indent: { left: 1080, hanging: 1080 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_DXA, leader: "dot" }],
        children: [new TextRun({ text: `${label} ${c.n}: ` }), ...runs(c.text), new TextRun({ text: `\t${PAGES[`${label} ${c.n}`] ?? "0"}` })],
      }),
  );

// ---------- front matter ----------
const frontTitle = (t) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 240 }, children: [new TextRun({ text: t, bold: true, size: 32, color: GREEN })] });
const front = [
  frontTitle("Table of Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  pageBreak(),
  frontTitle("List of Figures"),
  ...listEntries("Figure"),
  pageBreak(),
  frontTitle("List of Tables"),
  ...listEntries("Table"),
  new Paragraph({ spacing: { before: 480 }, children: [] }),
  frontTitle("List of Abbreviations"),
  ...table(
    ["Abbreviation", "Meaning"],
    [
      ["API", "Application Programming Interface"],
      ["FR / NFR / SR", "Functional / Non-Functional / Security Requirement (as numbered in the CS498 report)"],
      ["GUI", "Graphical User Interface"],
      ["HRSD", "Ministry of Human Resources and Social Development"],
      ["JWT", "JSON Web Token"],
      ["KB", "Knowledge Base"],
      ["LLM", "Large Language Model"],
      ["MRR", "Mean Reciprocal Rank"],
      ["OCR", "Optical Character Recognition"],
      ["PII", "Personally Identifiable Information"],
      ["RAG", "Retrieval-Augmented Generation"],
      ["REST", "Representational State Transfer"],
      ["RTL", "Right-to-Left"],
    ],
    [25, 75],
  ),
];

// ---------- document ----------
const doc = new Document({
  creator: "Group C03",
  title: "QISTAS – CPCS499 Project Report Part I",
  description: "CPCS499 Project Report Part I, Group C03",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { after: 120, line: 336 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true, color: GREEN }, paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true, color: GREEN }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
      { id: "Caption", name: "Caption", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 21, color: "404040" }, paragraph: { spacing: { before: 60, after: 240 } } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      ...["steps", "steps2", "steps3", "steps4", "steps5", "steps6", "steps7", "steps8", "steps9", "steps10"].map((reference) => ({
        reference,
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      })),
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }, titlePage: true },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6", space: 4 } }, children: [new TextRun({ text: "CPCS499 – Project Report Part I  ·  QISTAS  ·  Group_C03", size: 18, color: "595959" })] })] }),
        first: new Header({ children: [new Paragraph({ children: [] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children: [...cover, pageBreak(), ...front, ...content],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(DIR, "CPCS499_GroupC03_R1.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes;", CAPTIONS.filter((c) => c.label === "Figure").length, "figures,", CAPTIONS.filter((c) => c.label === "Table").length, "tables");
  fs.writeFileSync(path.join(DIR, "captions.json"), JSON.stringify(CAPTIONS.map((c) => `${c.label} ${c.n}`)));
});
