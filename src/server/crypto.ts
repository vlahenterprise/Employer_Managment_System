/**
 * Enkripcija osetljivih polja u bazi podataka.
 *
 * Koristi AES-256-GCM (Node.js crypto) bez eksternih zavisnosti.
 * Ključ mora biti 32-bajt hex string (64 hex karaktera), postavljen
 * kao FIELD_ENCRYPTION_KEY env varijabla.
 *
 * Format enkriptovanog stringa: "v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>"
 *
 * VAŽNO: Nikad ne čuvaj FIELD_ENCRYPTION_KEY u kodu ili git-u.
 * Za rotaciju ključa: decrypt sa starim ključem, encrypt sa novim.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV za GCM
const TAG_BYTES = 16; // 128-bit auth tag
const VERSION_PREFIX = "v1:";

function getEncryptionKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // Prihvati 64-char hex ili 32-char raw string
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Fallback: derive 32-byte ključ hash-om (za kratke stringove)
  return createHash("sha256").update(raw).digest();
}

/**
 * Enkriptuje plaintext string.
 * Vraća null ako FIELD_ENCRYPTION_KEY nije postavljen.
 * Vraća enkriptovani string u formatu "v1:<iv>:<tag>:<ciphertext>".
 */
export function encryptField(plaintext: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Dekriptuje string koji je enkriptovan sa encryptField().
 * Vraća null ako nije moguće dekriptovati (pogrešan ključ, oštećeni podaci, itd.).
 */
export function decryptField(ciphertext: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  if (!ciphertext.startsWith(VERSION_PREFIX)) return null;

  try {
    const withoutPrefix = ciphertext.slice(VERSION_PREFIX.length);
    const parts = withoutPrefix.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");

    if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) return null;

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Proverava da li je string enkriptovan (počinje sa version prefix-om).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(VERSION_PREFIX);
}

/**
 * Enkriptuje ako FIELD_ENCRYPTION_KEY postoji, inače vraća original.
 * Korisno za graceful degradation.
 */
export function encryptOrPassthrough(plaintext: string): string {
  return encryptField(plaintext) ?? plaintext;
}

/**
 * Dekriptuje ako je vrednost enkriptovana, inače vraća original.
 * Korisno za graceful degradation.
 */
export function decryptOrPassthrough(value: string): string {
  if (!isEncrypted(value)) return value;
  return decryptField(value) ?? value;
}
