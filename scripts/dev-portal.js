/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const envLocalBak = path.join(root, ".env.local.tmp_bak");
const envPortal = path.join(root, ".env.local.portal");

if (!fs.existsSync(envPortal)) {
  console.error("Error: .env.local.portal file not found at " + envPortal);
  process.exit(1);
}

let backedUp = false;
if (fs.existsSync(envLocal)) {
  try {
    fs.renameSync(envLocal, envLocalBak);
    backedUp = true;
  } catch (e) {
    console.error("Failed to backup .env.local:", e);
  }
}

try {
  fs.copyFileSync(envPortal, envLocal);
} catch (e) {
  console.error("Failed to copy .env.local.portal to .env.local:", e);
  if (backedUp && fs.existsSync(envLocalBak)) {
    fs.renameSync(envLocalBak, envLocal);
  }
  process.exit(1);
}

let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    if (fs.existsSync(envLocal)) {
      fs.unlinkSync(envLocal);
    }
    if (backedUp && fs.existsSync(envLocalBak)) {
      fs.renameSync(envLocalBak, envLocal);
    }
  } catch (e) {
    console.error("Error during env cleanup:", e);
  }
};

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});

const extraArgs = process.argv.slice(2);
const portArgs = !extraArgs.includes("-p") && !extraArgs.includes("--port") && process.env.PORT
  ? ["-p", process.env.PORT]
  : [];
const child = spawn("npx", ["next", "dev", ...portArgs, ...extraArgs], { stdio: "inherit", cwd: root, shell: true });
child.on("exit", (code) => {
  cleanup();
  process.exit(code || 0);
});
