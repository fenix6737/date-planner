"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "users",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("gender", sa.String(length=20), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_table(
    "categories",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("name", sa.String(length=50), nullable=False),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("name"),
  )
  op.create_table(
    "geocode_cache",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("query", sa.String(length=500), nullable=False),
    sa.Column("lat", sa.Float(), nullable=False),
    sa.Column("lng", sa.Float(), nullable=False),
    sa.Column("address", sa.Text(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("query"),
  )
  op.create_table(
    "plans",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=True),
    sa.Column("date", sa.Date(), nullable=False),
    sa.Column("start_lat", sa.Float(), nullable=False),
    sa.Column("start_lng", sa.Float(), nullable=False),
    sa.Column("budget", sa.Integer(), nullable=False),
    sa.Column("preferences", sa.JSON(), nullable=True),
    sa.Column("share_token", sa.String(length=36), nullable=False),
    sa.Column("total_time", sa.String(length=50), nullable=True),
    sa.Column("total_distance", sa.String(length=50), nullable=True),
    sa.Column("total_price", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("share_token"),
  )
  op.create_table(
    "spots",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("name", sa.String(length=255), nullable=False),
    sa.Column("category_id", sa.Integer(), nullable=True),
    sa.Column("lat", sa.Float(), nullable=False),
    sa.Column("lng", sa.Float(), nullable=False),
    sa.Column("avg_price", sa.Integer(), nullable=False),
    sa.Column("rating", sa.Float(), nullable=False),
    sa.Column("review_count", sa.Integer(), nullable=False),
    sa.Column("source", sa.String(length=50), nullable=False),
    sa.Column("source_id", sa.String(length=100), nullable=True),
    sa.Column("address", sa.String(length=500), nullable=True),
    sa.Column("image_url", sa.String(length=500), nullable=True),
    sa.Column("hours", sa.String(length=200), nullable=True),
    sa.Column("url", sa.String(length=500), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_table(
    "plan_items",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("plan_id", sa.Integer(), nullable=False),
    sa.Column("spot_id", sa.Integer(), nullable=False),
    sa.Column("sequence", sa.Integer(), nullable=False),
    sa.Column("start_time", sa.Time(), nullable=False),
    sa.Column("end_time", sa.Time(), nullable=False),
    sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["spot_id"], ["spots.id"]),
    sa.PrimaryKeyConstraint("id"),
  )


def downgrade() -> None:
  op.drop_table("plan_items")
  op.drop_table("spots")
  op.drop_table("plans")
  op.drop_table("geocode_cache")
  op.drop_table("categories")
  op.drop_table("users")
