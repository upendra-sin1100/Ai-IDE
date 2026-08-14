from pydantic import BaseModel, Field


class InlineCompletionRequest(BaseModel):
    code: str = Field(min_length=1)
    prefix: str | None = None
    suffix: str | None = None
    language: str | None = None
    model: str | None = None
    provider: str | None = None


class InlineCompletionResponse(BaseModel):
    text: str
