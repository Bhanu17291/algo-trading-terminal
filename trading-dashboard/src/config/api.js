const BASE_URL =
    import.meta.env.VITE_API_URL || "https://algo-trading-terminal.onrender.com"

export async function fetchJson(path) {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
}

export default BASE_URL