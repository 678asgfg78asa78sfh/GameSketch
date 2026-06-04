import { randomBytes } from "node:crypto";
const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

export function ulid() {
  // 48-bit time + 80-bit randomness, encoded to 26 chars.
  const time = Date.now();
  let ts = "";
  let t = time;
  for (let i = 9; i >= 0; i--) { ts = ENC[t % 32] + ts; t = Math.floor(t / 32); }
  ts = ts.slice(-10);
  const rnd = randomBytes(10);
  let rand = "";
  let bits = 0, value = 0;
  for (const byte of rnd) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { rand += ENC[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) rand += ENC[(value << (5 - bits)) & 31];
  return (ts + rand).slice(0, 26);
}
