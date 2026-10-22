const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export async function search(query, limit = 12) {
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json();
}
