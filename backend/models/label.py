from datetime import datetime

from pydantic import BaseModel, Field


class Label(BaseModel):
    problem_id: str = Field(
        ..., description="Problem identifier (e.g., 'django__django-10097')"
    )
    agent_name: str = Field(
        ..., description="Agent name (e.g., '20250316_augment_agent_v0')"
    )
    content: str = Field("", description="Markdown content of the label/comment")
    created_at: datetime = Field(
        default_factory=datetime.now, description="When label was first created"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="When label was last modified"
    )


class LabelCreate(BaseModel):
    content: str = Field(..., description="Markdown content to save")


class LabelResponse(BaseModel):
    problem_id: str
    agent_name: str
    content: str
    created_at: str
    updated_at: str
