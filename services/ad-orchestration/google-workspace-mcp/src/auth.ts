import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

export async function getAuthenticatedClient() {
  const auth = new GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  return client as InstanceType<typeof google.auth.OAuth2>;
}
