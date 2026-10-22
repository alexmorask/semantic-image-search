import React, { useState } from "react";
import { search } from "./api";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");

  async function run(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus("searching...");
    try {
      const data = await search(query);
      setResults(data.results || []);
      setStatus(`${data.count} result(s)`);
    } catch (err) {
      setStatus(String(err.message || err));
    }
  }

  return (
    <div className="wrap">
      <h1>Semantic Image Search</h1>
      <form onSubmit={run} className="searchbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="try: mountain, dog, sunset over water"
        />
        <button type="submit">Search</button>
      </form>
      <p className="status">{status}</p>
      <div className="grid">
        {results.map((r) => (
          <figure key={r.id} className="card">
            <img src={r.url} alt={r.description || r.id} loading="lazy" />
            <figcaption>
              <span>{r.description || r.id}</span>
              {typeof r.score === "number" && <small>score {r.score.toFixed(3)}</small>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
