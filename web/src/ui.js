export function errorText(error, t) {
  const key = `qol.errors.${error.code || error.message}`;
  const translated = t(key);
  return translated === key ? error.message || String(error) : translated;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function downloadUrl(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  downloadBlob(await res.blob(), name);
}
