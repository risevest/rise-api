#!/usr/bin/env node
const { version } = require("../package.json");

const { program } = require("commander");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

program
  .name("rise-api")
  .description("API client generation CLI tool")
  .version(version);

program
  .command("generate <swaggerFile>")
  .description("Generate TypeScript contract and compile to JavaScript")
  .action((swaggerFile) => {
    const SRC_DIR = path.join("node_modules", "@risemaxi", "api-client", "src");
    const OUTPUT_FILE = path.join(SRC_DIR, "contract.ts");

    try {
      fs.mkdirSync(SRC_DIR, { recursive: true });

      execSync(
        `npx typed-openapi@0.8.0 "${swaggerFile}" -o "${OUTPUT_FILE}" -r typebox`,
        { stdio: "inherit" }
      );

      console.log("Compiling TypeScript to JavaScript...");
      execSync(
        `npx tsc --project "${path.join(
          SRC_DIR,
          "..",
          "tsconfig.build.json"
        )}"`,
        { stdio: "inherit" }
      );

      fs.rmSync(SRC_DIR, { recursive: true, force: true });

      console.log("File generated and compiled successfully.");
    } catch (error) {
      console.error("Error during file generation:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
