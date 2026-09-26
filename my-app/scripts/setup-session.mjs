import fs from "node:fs";
import { randomBytes } from "node:crypto";
const file = ".env.local";
const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (/^\s*SESSION_SECRET\s*=/m.test(previous)) {
  console.log("SESSION_SECRET ya existe en .env.local; no se modificó.");
} else {
  fs.appendFileSync(
    file,
    "\nSESSION_SECRET=" + randomBytes(48).toString("base64url") + "\n",
    { mode: 0o600 },
  );
  console.log("SESSION_SECRET creado en .env.local. Su valor no se imprime.");
}
