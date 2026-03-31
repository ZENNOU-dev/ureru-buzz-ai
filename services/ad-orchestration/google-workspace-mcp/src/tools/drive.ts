import { google, drive_v3 } from "googleapis";
import type { AuthClient } from "google-auth-library";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function getDriveClient(auth: AuthClient): drive_v3.Drive {
  return google.drive({ version: "v3", auth: auth as any });
}

export function registerDriveTools(server: McpServer, getAuth: () => Promise<AuthClient>) {
  // List files
  server.tool(
    "drive_list",
    "List files in Google Drive (supports folder filtering)",
    {
      query: z.string().optional().describe("Drive search query (e.g. \"name contains 'report'\")"),
      folderId: z.string().optional().describe("Folder ID to list contents of"),
      pageSize: z.number().optional().default(20).describe("Max results (default 20)"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    },
    async ({ query, folderId, pageSize, pageToken }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);

      let q = "trashed = false";
      if (folderId) q += ` and '${folderId}' in parents`;
      if (query) q += ` and (${query})`;

      const res = await drive.files.list({
        q,
        pageSize: pageSize ?? 20,
        pageToken: pageToken ?? undefined,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, parents, webViewLink)",
        orderBy: "modifiedTime desc",
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            files: res.data.files ?? [],
            nextPageToken: res.data.nextPageToken ?? null,
          }, null, 2),
        }],
      };
    }
  );

  // Search files
  server.tool(
    "drive_search",
    "Search files by name in Google Drive",
    {
      name: z.string().describe("File name to search for"),
      mimeType: z.string().optional().describe("Filter by MIME type (e.g. 'application/vnd.google-apps.spreadsheet')"),
      pageSize: z.number().optional().default(10).describe("Max results"),
    },
    async ({ name, mimeType, pageSize }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);

      let q = `trashed = false and name contains '${name.replace(/'/g, "\\'")}'`;
      if (mimeType) q += ` and mimeType = '${mimeType}'`;

      const res = await drive.files.list({
        q,
        pageSize: pageSize ?? 10,
        fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
        orderBy: "modifiedTime desc",
      });

      return { content: [{ type: "text", text: JSON.stringify(res.data.files ?? [], null, 2) }] };
    }
  );

  // Get file metadata
  server.tool(
    "drive_get_metadata",
    "Get detailed metadata for a file",
    {
      fileId: z.string().describe("File ID"),
    },
    async ({ fileId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);
      const res = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, modifiedTime, createdTime, size, parents, webViewLink, owners, shared, permissions",
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  // Create folder
  server.tool(
    "drive_create_folder",
    "Create a new folder in Google Drive",
    {
      name: z.string().describe("Folder name"),
      parentId: z.string().optional().describe("Parent folder ID (root if omitted)"),
    },
    async ({ name, parentId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parentId ? [parentId] : undefined,
        },
        fields: "id, name, webViewLink",
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  // Move file
  server.tool(
    "drive_move",
    "Move a file to a different folder",
    {
      fileId: z.string().describe("File ID to move"),
      newParentId: z.string().describe("Destination folder ID"),
    },
    async ({ fileId, newParentId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);

      const file = await drive.files.get({ fileId, fields: "parents" });
      const previousParents = file.data.parents?.join(",") ?? "";

      const res = await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: "id, name, parents",
      });
      return { content: [{ type: "text", text: `Moved: ${JSON.stringify(res.data, null, 2)}` }] };
    }
  );

  // Rename file
  server.tool(
    "drive_rename",
    "Rename a file or folder",
    {
      fileId: z.string().describe("File ID"),
      newName: z.string().describe("New name"),
    },
    async ({ fileId, newName }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);
      const res = await drive.files.update({
        fileId,
        requestBody: { name: newName },
        fields: "id, name",
      });
      return { content: [{ type: "text", text: `Renamed to: ${res.data.name}` }] };
    }
  );

  // Copy file
  server.tool(
    "drive_copy",
    "Copy a file",
    {
      fileId: z.string().describe("File ID to copy"),
      newName: z.string().optional().describe("Name for the copy"),
      parentId: z.string().optional().describe("Destination folder ID"),
    },
    async ({ fileId, newName, parentId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);
      const res = await drive.files.copy({
        fileId,
        requestBody: {
          name: newName ?? undefined,
          parents: parentId ? [parentId] : undefined,
        },
        fields: "id, name, webViewLink",
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  // Delete file (trash)
  server.tool(
    "drive_trash",
    "Move a file to trash",
    {
      fileId: z.string().describe("File ID to trash"),
    },
    async ({ fileId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
      });
      return { content: [{ type: "text", text: `File ${fileId} moved to trash` }] };
    }
  );

  // Share file
  server.tool(
    "drive_share",
    "Share a file with a user or make it public",
    {
      fileId: z.string().describe("File ID"),
      email: z.string().optional().describe("Email to share with (omit for public link)"),
      role: z.enum(["reader", "commenter", "writer"]).default("reader").describe("Permission role"),
    },
    async ({ fileId, email, role }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);

      const permission: drive_v3.Schema$Permission = email
        ? { type: "user", role, emailAddress: email }
        : { type: "anyone", role };

      const res = await drive.permissions.create({
        fileId,
        requestBody: permission,
        fields: "id, type, role, emailAddress",
      });
      return { content: [{ type: "text", text: `Shared: ${JSON.stringify(res.data, null, 2)}` }] };
    }
  );

  // Download/export file content as text
  server.tool(
    "drive_read_content",
    "Read text content of a file (Google Docs exported as plain text, others as-is)",
    {
      fileId: z.string().describe("File ID"),
    },
    async ({ fileId }) => {
      const auth = await getAuth();
      const drive = getDriveClient(auth);

      const meta = await drive.files.get({ fileId, fields: "mimeType, name" });
      const mimeType = meta.data.mimeType ?? "";

      let text: string;
      if (mimeType.startsWith("application/vnd.google-apps.")) {
        const exportMime = mimeType.includes("spreadsheet")
          ? "text/csv"
          : mimeType.includes("presentation")
            ? "text/plain"
            : "text/plain";
        const res = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: "text" });
        text = String(res.data);
      } else {
        const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
        text = String(res.data);
      }

      return { content: [{ type: "text", text }] };
    }
  );
}
