// Search normalization: lowercase, strip accents and punctuation. Shared by the sync (which precomputes
// the search keys stored in the dataset) and the worker (which normalizes only the typed query).
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
