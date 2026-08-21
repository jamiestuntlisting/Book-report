// Regenerates lib/db/ddl.ts from db/schema.sql so the /api/admin/init-db
// route can apply the schema through the D1 binding (no wrangler auth needed).
const fs = require("fs");
const sql = fs.readFileSync("db/schema.sql", "utf8");
const stripped = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const statements = stripped
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const out =
  "// GENERATED from db/schema.sql — do not edit by hand.\n" +
  "// Regenerate with: node scripts/generate-ddl.js\n" +
  "export const SCHEMA_STATEMENTS: string[] = [\n" +
  statements.map((s) => "  " + JSON.stringify(s) + ",").join("\n") +
  "\n];\n";
fs.writeFileSync("lib/db/ddl.ts", out);
console.log("Wrote lib/db/ddl.ts with", statements.length, "statements");
