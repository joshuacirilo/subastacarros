import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      value,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(value: string): Promise<string> {
  const salt = randomBytes(16),
    key = await derive(value, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(
  value: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hash ?? "")
  )
    return false;
  return timingSafeEqual(
    await derive(value, Buffer.from(salt, "hex")),
    Buffer.from(hash, "hex"),
  );
}
