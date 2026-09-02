#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function sameValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(join(repositoryRoot, relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return {};
  }
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${relative(repositoryRoot, absolutePath)} must not be a symlink`);
    } else if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

const manifest = await readJson(".cursor-plugin/plugin.json");
const mcp = await readJson("mcp.json");

const expectedManifest = {
  name: "craft",
  displayName: "Craft",
  version: "1.0.0",
  minClientVersions: { cursor: "3.13.0" },
  description: "Search, create, and update documents and daily notes.",
  author: { name: "Craft Docs", email: "feedback@craft.do" },
  publisher: "Craft Docs",
  homepage: "https://www.craft.do/imagine/guide/mcp",
  repository: "https://github.com/lukilabs/craft-cursor-plugin",
  license: "MIT",
  keywords: ["craft", "craft.do", "notes", "documents", "writing", "mcp"],
  category: "integrations",
  tags: ["craft", "notes", "mcp", "documents"],
  logo: "assets/logo.png",
  mcpServers: "./mcp.json",
};

check(
  sameValue(Object.keys(manifest).sort(), Object.keys(expectedManifest).sort()),
  "plugin.json contains missing or unexpected fields",
);

for (const [field, expected] of Object.entries(expectedManifest)) {
  check(sameValue(manifest[field], expected), `plugin.json field ${field} is not canonical`);
}

for (const [relativePath, value] of [
  [".cursor-plugin/plugin.json", manifest],
  ["mcp.json", mcp],
]) {
  const source = await readFile(join(repositoryRoot, relativePath), "utf8");
  check(source === `${JSON.stringify(value, null, 2)}\n`, `${relativePath} is not canonically formatted`);
}

check(
  sameValue(mcp, {
    mcpServers: {
      craft: {
        type: "http",
        url: "https://mcp.craft.do/my/mcp",
      },
    },
  }),
  "mcp.json must contain only the canonical Craft HTTP server",
);

const referencedPaths = [manifest.logo, manifest.mcpServers]
  .filter((value) => typeof value === "string")
  .map((value) => value.replace(/^\.\//, ""));

for (const referencedPath of referencedPaths) {
  try {
    await readFile(join(repositoryRoot, referencedPath));
  } catch {
    errors.push(`Referenced file does not exist: ${referencedPath}`);
  }
}

try {
  const logo = await readFile(join(repositoryRoot, "assets/logo.png"));
  check(logo.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", "logo must be a PNG");
  check(logo.readUInt32BE(16) === 192 && logo.readUInt32BE(20) === 192, "logo must be 192 × 192 pixels");
} catch (error) {
  errors.push(`Unable to inspect logo: ${error.message}`);
}

const allFiles = await collectFiles(repositoryRoot);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /sk-[A-Za-z0-9]{20,}/,
];

for (const absolutePath of allFiles) {
  const content = await readFile(absolutePath);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  for (const pattern of secretPatterns) {
    check(!pattern.test(text), `${relative(repositoryRoot, absolutePath)} resembles a committed secret`);
  }
}

const publicCopyPaths = [".cursor-plugin/plugin.json", "README.md", "CHANGELOG.md"];
const forbiddenCopy = [
  { pattern: new RegExp(`\\b${[["Gr", "ok"].join(""), "Bot"].join(" ")}\\b`, "i"), label: "client-specific branding" },
  { pattern: new RegExp(["lega", "cy"].join(""), "i"), label: "retired branding" },
  { pattern: new RegExp(`\\b${["A", "I"].join("")}\\b`, "i"), label: "generic host-product positioning" },
  { pattern: new RegExp(["mar", "ton@"].join(""), "i"), label: "personal contact details" },
];

for (const relativePath of publicCopyPaths) {
  const text = await readFile(join(repositoryRoot, relativePath), "utf8");
  for (const { pattern, label } of forbiddenCopy) {
    check(!pattern.test(text), `${relativePath} contains ${label}`);
  }
}

try {
  const commitEmails = execFileSync("git", ["log", "--format=%ae"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const email of commitEmails) {
    check(
      email.endsWith("@users.noreply.github.com") || email.endsWith("@craft.do"),
      `commit history exposes a non-Craft email address: ${email}`,
    );
  }

  const commitIds = execFileSync("git", ["rev-list", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const inspectedObjects = new Set();
  for (const commitId of commitIds) {
    const objects = execFileSync(
      "git",
      ["ls-tree", "-r", "--format=%(objectname)%x09%(path)", commitId],
      { cwd: repositoryRoot, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const object of objects) {
      const [objectId, objectPath] = object.split("\t");
      if (inspectedObjects.has(objectId)) continue;
      inspectedObjects.add(objectId);
      const content = execFileSync("git", ["cat-file", "blob", objectId], {
        cwd: repositoryRoot,
        encoding: "buffer",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (content.includes(0)) continue;
      const text = content.toString("utf8");
      for (const pattern of secretPatterns) {
        check(!pattern.test(text), `${objectPath} resembles a committed secret in reachable history`);
      }
    }
  }
} catch (error) {
  errors.push(`Unable to inspect commit history: ${error.message}`);
}

const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");
for (const requiredText of [
  "https://www.craft.do/",
  "https://www.craft.do/imagine",
  "https://www.craft.do/imagine/guide/mcp",
  "https://www.craft.do/imagine/guide/mcp/cursor",
  "https://support.craft.do/en/integrate/mcp",
  "https://www.craft.do/privacy",
  "https://www.craft.do/terms",
  "https://www.craft.do/security/responsible-disclosure",
  "https://mcp.craft.do/my/mcp",
  "not yet published in the Cursor Marketplace",
]) {
  check(readme.includes(requiredText), `README is missing: ${requiredText}`);
}

if (process.argv.includes("--network")) {
  const publicUrls = [
    "https://www.craft.do/",
    "https://www.craft.do/imagine",
    "https://www.craft.do/imagine/guide/mcp",
    "https://www.craft.do/imagine/guide/mcp/cursor",
    "https://support.craft.do/en/integrate/mcp",
    "https://www.craft.do/privacy",
    "https://www.craft.do/terms",
    "https://www.craft.do/security/responsible-disclosure",
    "https://modelcontextprotocol.io/",
  ];

  for (const url of publicUrls) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "Craft connector release validation" },
        signal: AbortSignal.timeout(15_000),
      });
      check(response.ok, `${url} returned HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${url} failed: ${error.message}`);
    }
  }

  const metadataUrl = "https://mcp.craft.do/.well-known/oauth-protected-resource/my/mcp";
  try {
    const endpointResponse = await fetch("https://mcp.craft.do/my/mcp", {
      signal: AbortSignal.timeout(15_000),
    });
    check(endpointResponse.status === 401, `MCP endpoint returned HTTP ${endpointResponse.status}, expected 401 without credentials`);
    check(
      endpointResponse.headers.get("www-authenticate")?.includes(metadataUrl),
      "MCP endpoint did not advertise its OAuth resource metadata",
    );

    const metadataResponse = await fetch(metadataUrl, { signal: AbortSignal.timeout(15_000) });
    const metadata = await metadataResponse.json();
    check(metadataResponse.ok, `OAuth resource metadata returned HTTP ${metadataResponse.status}`);
    check(metadata.resource === "https://mcp.craft.do/my/mcp", "OAuth resource metadata has the wrong resource URL");
    check(
      Array.isArray(metadata.authorization_servers) &&
        metadata.authorization_servers.length > 0 &&
        metadata.authorization_servers.every((url) => url.startsWith("https://")),
      "OAuth resource metadata has invalid authorization servers",
    );
  } catch (error) {
    errors.push(`MCP OAuth discovery failed: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validation passed${process.argv.includes("--network") ? " (including network and OAuth checks)" : ""}.`);
