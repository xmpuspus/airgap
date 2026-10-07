/* eslint-disable no-bitwise -- FNV-1a hash uses ^=, >>> as intended. */

// 32-bit FNV-1a as 8 hex characters. It is fast and stable, not
// cryptographic: a dictionary of common inputs can find a match for any
// hash, so it does not hide short or predictable text.
export function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
