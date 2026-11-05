from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from ...core.database import Base
from ...core.models import now


class Questionnaire(Base):
    __tablename__ = "evaluation_questionnaires"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    version: Mapped[int] = mapped_column(Integer, default=1)
    definition: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("title", "version", name="one_questionnaire_version"),)


class Period(Base):
    __tablename__ = "evaluation_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    questionnaire_id: Mapped[int] = mapped_column(ForeignKey("evaluation_questionnaires.id"))
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="borrador")
    minimum_responses: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Assignment(Base):
    __tablename__ = "evaluation_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("evaluation_periods.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(150))
    group_name: Mapped[str] = mapped_column(String(80))
    __table_args__ = (UniqueConstraint("period_id", "student_id", "teacher_id", "subject", name="one_evaluation_assignment"),)


class Submission(Base):
    __tablename__ = "evaluation_submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("evaluation_assignments.id"), unique=True)
    answers: Mapped[str] = mapped_column(Text)
    comment: Mapped[str] = mapped_column(Text, default="")
    public_comment: Mapped[str] = mapped_column(Text, default="")
    comment_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ImprovementPlan(Base):
    __tablename__ = "evaluation_improvement_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("evaluation_periods.id"))
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="pendiente")
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("period_id", "teacher_id", name="one_evaluation_plan"),)

class AcademicGroup(Base):
    __tablename__ = "academic_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    career: Mapped[str] = mapped_column(String(150))
    academic_term: Mapped[str] = mapped_column(String(50))

    __table_args__ = (
        UniqueConstraint(
            "name",
            "academic_term",
            name="unique_academic_group_term",
        ),
    )


class GroupEnrollment(Base):
    __tablename__ = "group_enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("academic_groups.id"),
        index=True,
    )
    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "student_id",
            name="unique_group_student",
        ),
    )


class GroupSubject(Base):
    __tablename__ = "group_subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("academic_groups.id"),
        index=True,
    )
    teacher_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(150))

    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "teacher_id",
            "subject",
            name="unique_group_teacher_subject",
        ),
    )