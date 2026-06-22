import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get client secret file
async function getClientSecrets() {
  const files = await fs.readdir(process.cwd());
  const secretFile = files.find(f => f.startsWith("client_secret_") && f.endsWith(".json"));
  if (!secretFile) {
    throw new Error("No client_secret_*.json file found in the workspace root directory.");
  }
  console.log(`Using client secrets from: ${secretFile}`);
  const content = await fs.readFile(path.join(process.cwd(), secretFile), "utf8");
  const parsed = JSON.parse(content);
  return parsed.web || parsed.installed;
}

async function main() {
  let secrets;
  try {
    secrets = await getClientSecrets();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { client_id, client_secret, auth_uri, token_uri } = secrets;

  // Port configuration
  const port = parseInt(process.argv[2] || "3000", 10);
  const redirect_uri = `http://localhost:${port}/api/auth/google/callback`;

  console.log("\n=========================================");
  console.log("Google OAuth 2.0 Authorization CLI Helper");
  console.log("=========================================");
  console.log(`Client ID: ${client_id}`);
  console.log(`Redirect URI: ${redirect_uri}`);
  console.log("-----------------------------------------\n");

  // Construct authorization URL
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const authUrl = new URL(auth_uri || "https://accounts.google.com/o/oauth2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline"); // Crucial to get refresh_token
  authUrl.searchParams.set("prompt", "consent");      // Force consent to get refresh_token

  console.log("Please visit the following URL to authorize the app:");
  console.log("\x1b[36m%s\x1b[0m", authUrl.toString());
  console.log("\nWaiting for redirect callback on local port " + port + "...");

  // Start HTTP server to receive redirect callback
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    
    if (reqUrl.pathname === "/api/auth/google/callback") {
      const code = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authentication failed!</h1><p>Error: ${error}</p>`);
        console.error(`OAuth error received: ${error}`);
        server.close();
        process.exit(1);
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Authentication failed!</h1><p>No code parameter found in callback URL.</p>");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Authentication successful!</h1><p>You can close this tab and return to the terminal.</p>");
      
      console.log("\nAuthorization code received. Exchanging for tokens...");
      server.close();

      try {
        const tokenResponse = await fetch(token_uri || "https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id,
            client_secret,
            redirect_uri,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
        }

        const refresh_token = tokenData.refresh_token;
        if (!refresh_token) {
          console.warn("\x1b[33m%s\x1b[0m", "\nWARNING: No refresh token returned. Did you accept the consent screen? If the app was previously authorized, you may need to revoke access first at https://myaccount.google.com/permissions to get a refresh token.");
        }

        // Read existing .env.local if present
        let envContent = "";
        try {
          envContent = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
        } catch {
          // File does not exist, use .env.example as base if exists
          try {
            envContent = await fs.readFile(path.join(process.cwd(), ".env.example"), "utf8");
          } catch {
            envContent = "# Google Sheets Environment Variables\n";
          }
        }

        // Map updates
        const vars = {
          GOOGLE_CLIENT_ID: client_id,
          GOOGLE_CLIENT_SECRET: client_secret,
          GOOGLE_REFRESH_TOKEN: refresh_token || "",
          GOOGLE_SHEETS_SPREADSHEET_ID: "1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw"
        };

        // Update env content
        for (const [key, val] of Object.entries(vars)) {
          if (!val && key === "GOOGLE_REFRESH_TOKEN") continue; // keep previous if blank
          
          const regex = new RegExp(`^${key}=.*$`, "m");
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${val}`);
          } else {
            envContent += `\n${key}=${val}`;
          }
        }

        await fs.writeFile(path.join(process.cwd(), ".env.local"), envContent.trim() + "\n", "utf8");
        console.log("\n\x1b[32m%s\x1b[0m", "Success! Tokens successfully saved to .env.local.");
        console.log(`GOOGLE_CLIENT_ID=${client_id}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${refresh_token ? "✓ (Retrieved)" : "❌ (Check warning above)"}`);
        process.exit(0);

      } catch (err) {
        console.error("Error exchanging authorization code:", err.message);
        process.exit(1);
      }
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(port, () => {
    console.log(`Callback listener running on http://localhost:${port}/api/auth/google/callback`);
  });
}

main();
