from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(min_length=1)
    content: str = Field(default="")


class OpenFile(BaseModel):
    path: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str | None = None
    provider: str | None = None
    open_files: list[OpenFile] = Field(default_factory=list)
    active_file: str | None = None


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    proposed_edits: list[dict] = Field(default_factory=list)

