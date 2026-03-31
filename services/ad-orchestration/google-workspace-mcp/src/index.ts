#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthenticatedClient } from "./auth.js";
import { registerSheetsTools } from "./tools/sheets.js";
import { registerDriveTools } from "./tools/drive.js";
import type { AuthClient } from "google-auth-library";

let cachedAuth: AuthClient | null = null;

async function getAuth(): Promise<AuthClient> {
  if (!cachedAuth) {
    cachedAuth = await getAuthenticatedClient();
  }
  return cachedAuth;
}

const server = new McpServer({
  name: "google-workspace-mcp",
  version: "1.0.0",
});

registerSheetsTools(server, getAuth);
registerDriveTools(server, getAuth);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
