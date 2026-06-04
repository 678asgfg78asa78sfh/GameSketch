const MAP = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };

export function slugify(s) {
  const out = String(s).toLowerCase()
    .replace(/[äöüß]/g, (c) => MAP[c])
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "untitled";
}
