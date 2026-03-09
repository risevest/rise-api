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
        `npx typed-openapi@1.5.0 "${swaggerFile}" -o "${OUTPUT_FILE}" -r typebox`,
        { stdio: "inherit" }
      );

      // Avoid TS7056 by preventing a huge inferred literal type here.
      const contractSource = fs.readFileSync(OUTPUT_FILE, "utf8");
      const endpointByMethodPattern = /export const EndpointByMethod\s*=\s*{/;
      if (endpointByMethodPattern.test(contractSource)) {
        const patchedSource = contractSource.replace(
          endpointByMethodPattern,
          "export const EndpointByMethod: Record<string, Record<string, Endpoint>> = {"
        );
        fs.writeFileSync(OUTPUT_FILE, patchedSource, "utf8");
      }

      console.log("Compiling TypeScript to JavaScript...");
      execSync(
        `npx tsc --noCheck --project "${path.join(
          SRC_DIR,
          "..",
          "tsconfig.build.json"
        )}"`,
        {
          stdio: "inherit",
        }
      );

      fs.rmSync(SRC_DIR, { recursive: true, force: true });

      console.log("File generated and compiled successfully.");
    } catch (error) {
      console.error("Error during file generation:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
