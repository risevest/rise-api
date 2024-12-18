#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isWindows = process.platform === "win32";
const scriptDir = __dirname;

function runScript(script, args) {
  const child = spawn(script, args, {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code);
  });
}

if (isWindows) {
  // Check if PowerShell is available
  const powershellCheck = spawn("powershell", ["-Command", "$PSVersionTable.PSVersion"], {
    stdio: "ignore",
    shell: true,
  });

  powershellCheck.on("error", () => {
    // PowerShell not found, fallback to .cmd
    console.log("PowerShell not detected. Falling back to CMD script...");
    runScript(path.join(scriptDir, "cli.cmd"), process.argv.slice(2));
  });

  powershellCheck.on("exit", (code) => {
    if (code === 0) {
      // PowerShell detected, run .ps1 script
      console.log("PowerShell detected. Running PowerShell script...");
      runScript(`powershell`, ["-File", path.join(scriptDir, "cli.ps1"), ...process.argv.slice(2)]);
    } else {
      // PowerShell not found, fallback to .cmd
      console.log("PowerShell not detected. Falling back to CMD script...");
      runScript(path.join(scriptDir, "cli.cmd"), process.argv.slice(2));
    }
  });
} else {
  // Non-Windows platforms run the .sh script
  runScript(path.join(scriptDir, "cli.sh"), process.argv.slice(2));
}
