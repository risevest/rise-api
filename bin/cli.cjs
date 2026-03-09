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

function ensureTypeBoxSchemaImport(source) {
  return source.replace(
    /import\s*\{([^}]*)\}\s*from\s*"@sinclair\/typebox";/,
    (match, imports) => {
      if (/\bTSchema\b/.test(imports)) {
        return match;
      }

      const normalizedImports = imports
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      normalizedImports.push("TSchema");

      return `import { ${Array.from(new Set(normalizedImports)).join(", ")} } from "@sinclair/typebox";`;
    }
  );
}

function patchTypeBoxStaticConstraints(source) {
  if (!source.includes('from "@sinclair/typebox"')) {
    return source;
  }

  let patched = ensureTypeBoxSchemaImport(source);

  if (!patched.includes("type EndpointParametersOf<TEndpoint extends TSchema>")) {
    patched = patched.replace(
      /type MaybeOptionalArg<T> = RequiredKeys<T> extends never \? \[config\?: T\] : \[config: T\];/,
      (match) =>
        `${match}\n\ntype EndpointParametersOf<TEndpoint extends TSchema> = TEndpoint["static"] extends { parameters: infer TParameters } ? TParameters : never;\ntype EndpointResponseOf<TEndpoint extends TSchema> = TEndpoint["static"] extends { response: infer TResponse } ? TResponse : never;`
    );
  }

  patched = patched.replace(
    /TEndpoint extends\s+([A-Za-z]+Endpoints\[Path\])/g,
    "TEndpoint extends TSchema & $1"
  );

  patched = patched.replace(
    /TEndpoint extends\s+(EndpointByMethod\[TMethod\]\[TPath\])/g,
    "TEndpoint extends TSchema & $1"
  );

  patched = patched.replace(
    /Static<TEndpoint>\["parameters"\]/g,
    "EndpointParametersOf<TEndpoint>"
  );

  patched = patched.replace(
    /Static<TEndpoint>\["response"\]/g,
    "EndpointResponseOf<TEndpoint>"
  );

  return patched;
}

function rewriteBlock(source, startMarker, endMarker, transform) {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return source;
  }

  const blockEnd = source.indexOf("\n", endIndex);
  const replaceUntil = blockEnd === -1 ? source.length : blockEnd + 1;
  const block = source.slice(startIndex, replaceUntil);

  return (
    source.slice(0, startIndex) +
    transform(block) +
    source.slice(replaceUntil)
  );
}

function rewriteGeneratedTypeBoxApiClient(source) {
  const methodConfigs = [
    ["post", "PostEndpoints"],
    ["get", "GetEndpoints"],
    ["put", "PutEndpoints"],
    ["delete", "DeleteEndpoints"],
    ["patch", "PatchEndpoints"],
  ];

  let patched = source;

  for (const [method, alias] of methodConfigs) {
    patched = rewriteBlock(
      patched,
      `// <ApiClient.${method}>`,
      `// </ApiClient.${method}>`,
      (block) =>
        block
          .replace(
            new RegExp(
              `${method}<Path extends keyof ${alias}, TEndpoint extends TSchema & ${alias}\\[Path\\]>\\(`
            ),
            `${method}<Path extends keyof ${alias}>(`
          )
          .replace(
            /MaybeOptionalArg<EndpointParametersOf<TEndpoint>>/,
            `MaybeOptionalArg<${alias}[Path]["parameters"]>`
          )
          .replace(
            /Promise<EndpointResponseOf<TEndpoint>>/g,
            `Promise<${alias}[Path]["response"]>`
          )
    );
  }

  patched = rewriteBlock(
    patched,
    "// <ApiClient.request>",
    "// </ApiClient.request>",
    (block) =>
      block
        .replace(
          /request<\s*TMethod extends keyof EndpointByMethod,\s*TPath extends keyof EndpointByMethod\[TMethod\],\s*TEndpoint extends TSchema & EndpointByMethod\[TMethod\]\[TPath\],\s*>/m,
          `request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath] & {
      parameters?: unknown;
      response: unknown;
    },
  >`
        )
        .replace(
          /MaybeOptionalArg<EndpointParametersOf<TEndpoint>>/,
          `MaybeOptionalArg<TEndpoint["parameters"]>`
        )
        .replace(
          /json: \(\) => Promise<TEndpoint extends \{ response: infer Res \} \? Res : never>;/,
          `json: () => Promise<TEndpoint["response"]>;`
        )
  );

  return patched;
}

function parseDeclaredEndpointSchemas(source) {
  const endpointPattern =
    /export type ([A-Za-z0-9_]+)\s*=\s*Static<\s*typeof \1\s*>;\s*export const \1\s*=\s*Type\.Object\(\{\s*method:\s*Type\.Literal\("([A-Z]+)"\),\s*path:\s*Type\.Literal\("([^"]+)"\),/g;
  const endpoints = [];
  let match;

  while ((match = endpointPattern.exec(source)) !== null) {
    endpoints.push({
      method: match[2].toLowerCase(),
      path: match[3],
      schema: match[1],
    });
  }

  return endpoints;
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
  if (!/export\s+const\s+EndpointByMethod\s*=/.test(block)) {
    return source;
  }

  const parsedMethods = new Map();
  let currentMethod = null;
  let inEndpointMap = false;

  for (const line of block.split("\n")) {
    if (!inEndpointMap) {
      if (/export\s+const\s+EndpointByMethod\s*=\s*\{/.test(line)) {
        inEndpointMap = true;
      }

      continue;
    }

    const methodMatch = line.match(/^\s*([a-z]+)\s*:\s*\{\s*$/i);

    if (methodMatch) {
      currentMethod = methodMatch[1].toLowerCase();
      parsedMethods.set(currentMethod, []);
      continue;
    }

    const entryMatch = line.match(/^\s*"(.+)"\s*:\s*([A-Za-z0-9_$.]+),?\s*$/);

    if (entryMatch && currentMethod) {
      parsedMethods.get(currentMethod).push({
        path: entryMatch[1],
        schema: entryMatch[2].replace(/^Endpoints\./, ""),
      });
      continue;
    }

    if (currentMethod && /^\s*},?\s*$/.test(line)) {
      currentMethod = null;
      continue;
    }

    if (!currentMethod && /^\s*}\s*;?\s*$/.test(line)) {
      break;
    }
  }

  for (const endpoint of parseDeclaredEndpointSchemas(source)) {
    const entries = parsedMethods.get(endpoint.method) ?? [];
    const hasEntry = entries.some((entry) => entry.path === endpoint.path);

    if (hasEntry) {
      continue;
    }

    entries.push({
      path: endpoint.path,
      schema: endpoint.schema,
    });
    parsedMethods.set(endpoint.method, entries);
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
      replacementLines.push(`  "${entry.path}": ${entry.schema};`);
    }

    replacementLines.push("};");
    replacementLines.push("");
  }

  replacementLines.push("export type EndpointByMethod = {");

  for (const method of orderedMethods) {
    replacementLines.push(
      `  ${method.name}: ${toEndpointTypeName(method.name)};`
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
  replacementLines.push("  switch (method) {");

  for (const method of orderedMethods) {
    replacementLines.push(`    case "${method.name}":`);
    replacementLines.push("      switch (path) {");

    for (const entry of method.entries) {
      replacementLines.push(`        case "${entry.path}":`);
      replacementLines.push(`          return ${entry.schema};`);
    }

    replacementLines.push("        default:");
    replacementLines.push("          return undefined;");
    replacementLines.push("      }");
  }

  replacementLines.push("    default:");
  replacementLines.push("      return undefined;");
  replacementLines.push("  }");
  replacementLines.push("}");
  replacementLines.push("// </EndpointSchemaLookup>");

  return rewriteGeneratedTypeBoxApiClient(
    patchTypeBoxStaticConstraints(
      source.slice(0, startIndex) +
        replacementLines.join("\n") +
        "\n" +
        source.slice(replaceUntil)
    )
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
