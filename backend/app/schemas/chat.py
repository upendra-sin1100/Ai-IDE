from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(min_length=1)
    content: str = Field(default="")


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str | None = None
    provider: str | None = None


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
