import ExcelJS from "exceljs";

export type ParsedRow = { rowNumber: number; cells: string[] };

function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const c of candidates) {
    const count = headerLine.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

function parseCSV(text: string, delimiter: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  let lineNumber = 1;
  let rowStartLine = 1;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (char === "\n") lineNumber++;
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push({ rowNumber: rowStartLine, cells: row });
      row = [];
      field = "";
      i++;
      lineNumber++;
      rowStartLine = lineNumber;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push({ rowNumber: rowStartLine, cells: row });
  }
  return rows.filter((r) => r.cells.some((cell) => cell.trim() !== ""));
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
      value.getUTCDate(),
    ).padStart(2, "0")}`;
  }
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("text" in value) {
      return String(value.text);
    }
    if ("result" in value) {
      return cellToString(value.result ?? "");
    }
  }
  return String(value);
}

async function parseXLSX(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled Node types lag @types/node's Buffer shape; Buffer.from()
  // is a real Buffer at runtime, this cast only works around the type skew.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: ParsedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    for (let c = 1; c <= worksheet.columnCount; c++) {
      values.push(cellToString(row.getCell(c).value));
    }
    rows.push({ rowNumber, cells: values });
  });
  return rows.filter((r) => r.cells.some((cell) => cell.trim() !== ""));
}

export async function parseTabularFile(file: File): Promise<ParsedRow[]> {
  const isExcel =
    /\.xlsx?$/i.test(file.name) ||
    file.type.includes("spreadsheetml") ||
    file.type === "application/vnd.ms-excel";

  if (isExcel) return parseXLSX(file);

  const rawText = await file.text();
  const text = rawText.replace(/^﻿/, ""); // strip UTF-8 BOM from Excel CSV exports
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  return parseCSV(text, delimiter);
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmy = value.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (dmy) {
    const [, day, mon, year] = dmy;
    const month = MONTHS[mon.toLowerCase()];
    if (!month) return null;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month}-${day.padStart(2, "0")}`;
  }

  const dmyNumeric = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyNumeric) {
    const [, day, month, year] = dmyNumeric;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
