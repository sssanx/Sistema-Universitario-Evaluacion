
"""agregar retroalimentacion academica"""

from alembic import op
import sqlalchemy as sa

revision = "7f9bb08538dd"
down_revision = "4ef2ec25486e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "evaluation_academic_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "period_id",
            sa.Integer(),
            sa.ForeignKey("evaluation_periods.id"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            sa.String(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "period_id",
            "teacher_id",
            name="one_academic_feedback_per_teacher_period",
        ),
    )


def downgrade():
    op.drop_table("evaluation_academic_feedback")
