import { google } from "googleapis";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function normalizePrivateKey(key: string) {
  // .env に入れると \n になるケースが多い
  return key.replace(/\\n/g, "\n");
}

async function retry<T>(fn: () => Promise<T>, options?: { retries?: number; baseDelayMs?: number }) {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 400;

  let lastError: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type GoogleSheetsExportInput = {
  spreadsheetTitle: string;
  sheetName: string;
  rows: string[][];
};

export async function exportRowsToGoogleSheets(input: GoogleSheetsExportInput) {
  const clientEmail = requiredEnv("GOOGLE_SHEETS_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(requiredEnv("GOOGLE_SHEETS_PRIVATE_KEY"));

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await retry(async () => {
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: input.spreadsheetTitle },
        sheets: [{ properties: { title: input.sheetName } }]
      }
    });
    if (!res.data.spreadsheetId) throw new Error("Failed to create spreadsheet (missing spreadsheetId)");
    return res.data;
  });

  const spreadsheetId = spreadsheet.spreadsheetId as string;

  await retry(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${input.sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: input.rows }
    });
  });

  const sheetUrl = spreadsheet.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  return {
    spreadsheetId,
    sheetUrl,
    rowCount: Math.max(0, input.rows.length - 1)
  };
}
