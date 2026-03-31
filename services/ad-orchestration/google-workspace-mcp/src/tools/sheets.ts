import { google, sheets_v4 } from "googleapis";
import type { AuthClient } from "google-auth-library";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function getSheetsClient(auth: AuthClient): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: auth as any });
}

export function registerSheetsTools(server: McpServer, getAuth: () => Promise<AuthClient>) {
  // Read data from a range
  server.tool(
    "sheets_read",
    "Read data from a spreadsheet range",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID (from URL)"),
      range: z.string().describe("A1 notation range, e.g. 'Sheet1!A1:D10'"),
    },
    async ({ spreadsheetId, range }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return { content: [{ type: "text", text: JSON.stringify(res.data.values ?? [], null, 2) }] };
    }
  );

  // Write data to a range
  server.tool(
    "sheets_write",
    "Write data to a spreadsheet range (overwrites existing data)",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      range: z.string().describe("A1 notation range, e.g. 'Sheet1!A1'"),
      values: z.array(z.array(z.string())).describe("2D array of values to write"),
    },
    async ({ spreadsheetId, range, values }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return {
        content: [{ type: "text", text: `Updated ${res.data.updatedCells} cells in ${res.data.updatedRange}` }],
      };
    }
  );

  // Append rows
  server.tool(
    "sheets_append",
    "Append rows after the last row with data",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      range: z.string().describe("A1 notation range (sheet name), e.g. 'Sheet1'"),
      values: z.array(z.array(z.string())).describe("2D array of rows to append"),
    },
    async ({ spreadsheetId, range, values }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
      return {
        content: [{ type: "text", text: `Appended ${res.data.updates?.updatedRows ?? 0} rows` }],
      };
    }
  );

  // Clear a range
  server.tool(
    "sheets_clear",
    "Clear cell values from a range",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      range: z.string().describe("A1 notation range to clear"),
    },
    async ({ spreadsheetId, range }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} });
      return { content: [{ type: "text", text: `Cleared range: ${range}` }] };
    }
  );

  // Create a new spreadsheet
  server.tool(
    "sheets_create",
    "Create a new Google Spreadsheet",
    {
      title: z.string().describe("Title of the new spreadsheet"),
    },
    async ({ title }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.create({
        requestBody: { properties: { title } },
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            spreadsheetId: res.data.spreadsheetId,
            url: res.data.spreadsheetUrl,
            title: res.data.properties?.title,
          }, null, 2),
        }],
      };
    }
  );

  // Get spreadsheet metadata
  server.tool(
    "sheets_get_metadata",
    "Get spreadsheet metadata (title, sheets/tabs list)",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
    },
    async ({ spreadsheetId }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.get({ spreadsheetId });
      const data = {
        title: res.data.properties?.title,
        locale: res.data.properties?.locale,
        sheets: res.data.sheets?.map((s) => ({
          sheetId: s.properties?.sheetId,
          title: s.properties?.title,
          rowCount: s.properties?.gridProperties?.rowCount,
          columnCount: s.properties?.gridProperties?.columnCount,
        })),
      };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // List sheets (tabs)
  server.tool(
    "sheets_list_tabs",
    "List all sheet tabs in a spreadsheet",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
    },
    async ({ spreadsheetId }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
      const tabs = res.data.sheets?.map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        index: s.properties?.index,
      })) ?? [];
      return { content: [{ type: "text", text: JSON.stringify(tabs, null, 2) }] };
    }
  );

  // Add a new sheet tab
  server.tool(
    "sheets_add_tab",
    "Add a new sheet tab to a spreadsheet",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      title: z.string().describe("Name of the new tab"),
    },
    async ({ spreadsheetId, title }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      });
      const newSheet = res.data.replies?.[0]?.addSheet?.properties;
      return {
        content: [{ type: "text", text: `Created tab "${newSheet?.title}" (sheetId: ${newSheet?.sheetId})` }],
      };
    }
  );

  // Delete a sheet tab
  server.tool(
    "sheets_delete_tab",
    "Delete a sheet tab from a spreadsheet",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      sheetId: z.number().describe("Sheet ID (numeric) of the tab to delete"),
    },
    async ({ spreadsheetId, sheetId }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId } }],
        },
      });
      return { content: [{ type: "text", text: `Deleted sheet tab (sheetId: ${sheetId})` }] };
    }
  );

  // Batch read
  server.tool(
    "sheets_batch_read",
    "Read multiple ranges at once",
    {
      spreadsheetId: z.string().describe("Spreadsheet ID"),
      ranges: z.array(z.string()).describe("Array of A1 notation ranges"),
    },
    async ({ spreadsheetId, ranges }) => {
      const auth = await getAuth();
      const sheets = getSheetsClient(auth);
      const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
      const result = res.data.valueRanges?.map((vr) => ({
        range: vr.range,
        values: vr.values ?? [],
      })) ?? [];
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
