from pydantic import BaseModel


class ModelInfo(BaseModel):
    id: str
    provider: str
    label: str


class ModelListResponse(BaseModel):
    default_provider: str
    default_model: str
    models: list[ModelInfo]
