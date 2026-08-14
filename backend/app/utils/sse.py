import json
from collections.abc import AsyncIterator


def format_sse(data: object, event: str | None = None) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    prefix = f"event: {event}\n" if event else ""
    return f"{prefix}data: {payload}\n\n"


async def stream_as_sse(generator: AsyncIterator[dict[str, object]]) -> AsyncIterator[str]:
    async for item in generator:
        yield format_sse(item)
