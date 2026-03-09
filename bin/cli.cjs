#!/usr/bin/env node
const { version } = require("../package.json");

const { program } = require("commander");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const METHOD_ORDER = ["post", "get", "patch", "delete", "put"];

function toEndpointTypeName(method) {
  return `${method.charAt(0).toUpperCase()}${method.slice(1)}Endpoints`;
}

function optimizeContractSource(source) {
  const startMarker = "// <EndpointByMethod>";
  const endMarker = "// </EndpointByMethod.Shorthands>";
  const startIndex = source.indexOf(startMarker);
  const endMarkerIndex = source.indexOf(endMarker);

  if (startIndex === -1 || endMarkerIndex === -1) {
    return source;
  }

  const endIndex = source.indexOf("\n", endMarkerIndex);
  const replaceUntil = endIndex === -1 ? source.length : endIndex + 1;
  const block = source.slice(startIndex, replaceUntil);
  const endpointMapMatch = block.match(
    /export const EndpointByMethod = \{([\s\S]*?)\n\};\nexport type EndpointByMethod = typeof EndpointByMethod;/
  );

  if (!endpointMapMatch) {
    return source;
  }

  const parsedMethods = new Map();
  let currentMethod = null;

  for (const line of endpointMapMatch[1].split("\n")) {
    const methodMatch = line.match(/^\t([a-z]+): \{$/);

    if (methodMatch) {
      currentMethod = methodMatch[1];
      parsedMethods.set(currentMethod, []);
      continue;
    }

    const entryMatch = line.match(/^\t\t"(.+)": ([A-Za-z0-9_]+),$/);

    if (entryMatch && currentMethod) {
      parsedMethods.get(currentMethod).push({
        path: entryMatch[1],
        schema: entryMatch[2],
      });
      continue;
    }

    if (/^\t\},?$/.test(line)) {
      currentMethod = null;
    }
  }

  if (parsedMethods.size === 0) {
    return source;
  }

  const orderedMethods = [
    ...METHOD_ORDER.filter((method) => parsedMethods.has(method)),
    ...Array.from(parsedMethods.keys()).filter(
      (method) => !METHOD_ORDER.includes(method)
    ),
  ].map((method) => ({
    name: method,
    entries: parsedMethods.get(method) ?? [],
  }));

  const replacementLines = [];

  replacementLines.push("// <EndpointByMethod>");

  for (const method of orderedMethods) {
    replacementLines.push(`export type ${toEndpointTypeName(method.name)} = {`);

    for (const entry of method.entries) {
      replacementLines.push(`\t"${entry.path}": typeof ${entry.schema};`);
    }

    replacementLines.push("};");
    replacementLines.push("");
  }

  replacementLines.push("export type EndpointByMethod = {");

  for (const method of orderedMethods) {
    replacementLines.push(
      `\t${method.name}: ${toEndpointTypeName(method.name)};`
    );
  }

  replacementLines.push("};");
  replacementLines.push("// </EndpointByMethod>");
  replacementLines.push("");
  replacementLines.push("// <EndpointByMethod.Shorthands>");
  replacementLines.push("export type AllEndpoints = EndpointByMethod[keyof EndpointByMethod];");
  replacementLines.push("// </EndpointByMethod.Shorthands>");
  replacementLines.push("");
  replacementLines.push("// <EndpointSchemaLookup>");
  replacementLines.push(
    "export function getEndpointSchema(method: string, path: string): unknown {"
  );
  replacementLines.push("\tswitch (method) {");

  for (const method of orderedMethods) {
    replacementLines.push(`\t\tcase "${method.name}":`);
    replacementLines.push("\t\t\tswitch (path) {");

    for (const entry of method.entries) {
      replacementLines.push(`\t\t\t\tcase "${entry.path}":`);
      replacementLines.push(`\t\t\t\t\treturn ${entry.schema};`);
    }

    replacementLines.push("\t\t\t\tdefault:");
    replacementLines.push("\t\t\t\t\treturn undefined;");
    replacementLines.push("\t\t\t}");
  }

  replacementLines.push("\t\tdefault:");
  replacementLines.push("\t\t\treturn undefined;");
  replacementLines.push("\t}");
  replacementLines.push("}");
  replacementLines.push("// </EndpointSchemaLookup>");

  return (
    source.slice(0, startIndex) +
    replacementLines.join("\n") +
    "\n" +
    source.slice(replaceUntil)
  );
}

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

      const generatedSource = fs.readFileSync(OUTPUT_FILE, "utf8");
      fs.writeFileSync(OUTPUT_FILE, optimizeContractSource(generatedSource));

      console.log("Compiling TypeScript to JavaScript...");
      execSync(
        `npx tsc --project "${path.join(
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
