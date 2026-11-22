/**
 * Copies bytes into a fresh ArrayBuffer-backed view that Web Crypto accepts.
 *
 * This is the only place that narrows a Uint8Array to BufferSource (#574).
 * A view over a SharedArrayBuffer, or a slice with a non-zero byteOffset, is
 * copied rather than cast, so a wrong buffer type is caught by the type
 * checker instead of failing at runtime inside the crypto call.
 */
export function toBufferSource(bytes: Uint8Array): BufferSource {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}
