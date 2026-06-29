import { google } from 'googleapis';

interface LogEntry {
  mode: string;
  pathwaySlug?: string;
  messages: { role: string; content: string }[];
  response: string;
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function logConversation(entry: LogEntry): Promise<void> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID is not set');

    const timestamp = new Date().toISOString();
    const userMessages = entry.messages.filter((m) => m.role === 'user');
    const lastUserMessage = userMessages.at(-1)?.content ?? '';
    const fullHistory = JSON.stringify(entry.messages);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'logs!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          timestamp,
          entry.mode,
          entry.pathwaySlug ?? '',
          lastUserMessage,
          entry.response,
          fullHistory,
        ]],
      },
    });
  } catch (err) {
    // Log to console but never crash the main request
    console.error('[logger] Failed to write to Google Sheets:', err);
  }
}
