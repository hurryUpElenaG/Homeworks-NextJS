export function safeNext(value: string | string[] | undefined): string {

  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\r\n]/.test(candidate)
  )
    return "/";

  try {
    const parsed = new URL(candidate, "https://word-game.local");
    if (parsed.origin !== "https://word-game.local") return "/";
    
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
