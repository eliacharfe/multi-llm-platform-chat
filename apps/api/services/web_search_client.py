

# apps/api/services/web_search_client.py

from urllib.parse import urlparse
from tavily import TavilyClient
import os
import asyncio

_client: TavilyClient | None = None

def get_tavily_client() -> TavilyClient:
    global _client
    if _client is None:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            raise ValueError("TAVILY_API_KEY is not configured")
        _client = TavilyClient(api_key=api_key)
    return _client


def _extract_source(url: str) -> str | None:
    try:
        hostname = urlparse(url).hostname or ""
        return hostname.replace("www.", "") or None
    except Exception:
        return None


async def web_search(query: str, max_results: int = 5) -> str:
    """
    Runs a Tavily search and returns results formatted as a
    markdown string ready to inject into a system prompt.
    """
    client = get_tavily_client()

    response = await asyncio.to_thread(
        client.search,
        query=query,
        search_depth="advanced",
        max_results=max_results,
        include_answer=True,
        include_raw_content=False,
    )

    answer = (response.get("answer") or "").strip()
    results = response.get("results", [])

    lines = ["## Web Search Results\n"]

    if answer:
        lines.append(f"**Summary:** {answer}\n")

    for i, item in enumerate(results, 1):
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        content = (item.get("content") or "").strip()
        source = _extract_source(url)

        if not title or not url:
            continue

        lines.append(f"**[{i}] {title}**")
        if source:
            lines.append(f"Source: {source} — {url}")
        if content:
            lines.append(content)
        lines.append("")

    return "\n".join(lines)