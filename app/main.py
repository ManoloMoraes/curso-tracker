from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import (
    create_engine, Integer, String, DateTime, Boolean,
    ForeignKey, UniqueConstraint, select, func
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship,
    sessionmaker, joinedload
)

DB_PATH = os.environ.get("DB_PATH", "data/app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)

class Base(DeclarativeBase):
    pass

class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    modules: Mapped[List["Module"]] = relationship(back_populates="course", cascade="all, delete-orphan")

class Module(Base):
    __tablename__ = "modules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    lesson_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    course: Mapped["Course"] = relationship(back_populates="modules")
    lessons: Mapped[List["Lesson"]] = relationship(back_populates="module", cascade="all, delete-orphan")

class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    watched: Mapped[bool] = mapped_column(Boolean, default=False)
    watched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    module: Mapped["Module"] = relationship(back_populates="lessons")
    logs: Mapped[List["LessonLog"]] = relationship(back_populates="lesson", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("module_id", "number", name="uix_module_lesson_number"),)

class LessonLog(Base):
    __tablename__ = "lesson_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String, nullable=False)  # "watched" or "unwatched"
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    lesson: Mapped["Lesson"] = relationship(back_populates="logs")


def create_db():
    Base.metadata.create_all(bind=engine)


def seed_if_empty():
    with SessionLocal() as session:
        any_course = session.execute(select(func.count(Course.id))).scalar_one()
        if any_course:
            return
        # Seed demo data
        c1 = Course(title="Docker & Coolify", image_url="")
        c2 = Course(title="Fundamentos de Python", image_url="")
        session.add_all([c1, c2])
        session.flush()

        modules = [
            Module(course_id=c1.id, title="Introdução ao Docker", lesson_count=12),
            Module(course_id=c1.id, title="Publicação com Coolify", lesson_count=10),
            Module(course_id=c2.id, title="Tipos, Listas e Dicionários", lesson_count=14),
            Module(course_id=c2.id, title="Funções e Módulos", lesson_count=9),
        ]
        session.add_all(modules)
        session.flush()

        # Create lessons for each module
        for m in modules:
            session.add_all([Lesson(module_id=m.id, number=i+1) for i in range(m.lesson_count)])

        session.commit()

# ---------- Pydantic Schemas ----------
class CourseCreate(BaseModel):
    title: str
    image_url: Optional[str] = None

class ModuleCreate(BaseModel):
    title: str
    lesson_count: int

class CourseSummary(BaseModel):
    id: int
    title: str
    image_url: Optional[str]
    modules_count: int
    modules_in_progress: list
    modules_completed: int
    total_lessons: int
    watched_lessons: int
    course_progress: float

class ModuleDetail(BaseModel):
    id: int
    course_id: int
    title: str
    lesson_count: int
    watched_count: int
    progress: float

class LessonOut(BaseModel):
    id: int
    module_id: int
    number: int
    watched: bool
    watched_at: Optional[datetime]

class LogOut(BaseModel):
    id: int
    lesson_id: int
    action: str
    timestamp: datetime

# ---------- App ----------
app = FastAPI(title="Curso Tracker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static frontend
app.mount("/assets", StaticFiles(directory="frontend"), name="assets")

@app.get("/healthz")
def healthz():
    return {"ok": True}

# ---------- Helpers ----------
def module_progress_dict(module: Module, watched_count: Optional[int] = None) -> Dict[str, Any]:
    if watched_count is None:
        watched_count = sum(1 for l in module.lessons if l.watched)
    total = module.lesson_count
    progress = (watched_count / total * 100.0) if total else 0.0
    return {
        "id": module.id,
        "course_id": module.course_id,
        "title": module.title,
        "lesson_count": total,
        "watched_count": watched_count,
        "progress": round(progress, 2),
    }

def compute_course_summary(course: Course, session) -> CourseSummary:
    # prefetch lessons counts using SQL for performance
    watched_by_module = dict(
        session.execute(
            select(Lesson.module_id, func.sum(func.cast(Lesson.watched, Integer)))
            .join(Module, Lesson.module_id == Module.id)
            .where(Module.course_id == course.id)
            .group_by(Lesson.module_id)
        ).all()
    )
    total_lessons_by_module = dict(
        session.execute(
            select(Lesson.module_id, func.count(Lesson.id))
            .join(Module, Lesson.module_id == Module.id)
            .where(Module.course_id == course.id)
            .group_by(Lesson.module_id)
        ).all()
    )
    modules_in_progress_list = []
    modules_completed = 0
    total_lessons = 0
    watched_lessons = 0
    for m in course.modules:
        total = total_lessons_by_module.get(m.id, 0)
        watched = watched_by_module.get(m.id, 0) or 0
        total_lessons += total
        watched_lessons += watched
        if total == 0:
            continue
        if watched == 0:
            continue  # not started
        elif watched == total:
            modules_completed += 1
        else:
            modules_in_progress_list.append(module_progress_dict(m, watched))

    course_progress = (watched_lessons / total_lessons * 100.0) if total_lessons else 0.0

    return CourseSummary(
        id=course.id,
        title=course.title,
        image_url=course.image_url,
        modules_count=len(course.modules),
        modules_in_progress=modules_in_progress_list,
        modules_completed=modules_completed,
        total_lessons=total_lessons,
        watched_lessons=watched_lessons,
        course_progress=round(course_progress, 2),
    )

# ---------- API: Courses ----------
@app.get("/api/courses", response_model=List[CourseSummary])
def list_courses():
    with SessionLocal() as session:
        courses = session.execute(select(Course).options(joinedload(Course.modules))).unique().scalars().all()
        return [compute_course_summary(c, session) for c in courses]

@app.post("/api/courses", response_model=CourseSummary)
def create_course(payload: CourseCreate):
    with SessionLocal() as session:
        c = Course(title=payload.title.strip(), image_url=(payload.image_url or "").strip())
        session.add(c)
        session.commit()
        session.refresh(c)
        return compute_course_summary(c, session)

@app.get("/api/courses/{course_id}", response_model=CourseSummary)
def get_course(course_id: int):
    with SessionLocal() as session:
        course = session.get(Course, course_id)
        if not course:
            raise HTTPException(404, "Curso não encontrado.")
        # Load modules
        session.refresh(course)
        _ = course.modules  # ensure relationship-loaded
        return compute_course_summary(course, session)

@app.post("/api/courses/{course_id}/modules", response_model=ModuleDetail)
def create_module(course_id: int, payload: ModuleCreate):
    with SessionLocal() as session:
        course = session.get(Course, course_id)
        if not course:
            raise HTTPException(404, "Curso não encontrado.")
        if payload.lesson_count <= 0 or payload.lesson_count > 2000:
            raise HTTPException(400, "Quantidade de aulas deve ser entre 1 e 2000.")
        m = Module(course_id=course_id, title=payload.title.strip(), lesson_count=payload.lesson_count)
        session.add(m)
        session.flush()
        # Create contiguous lessons
        lessons = [Lesson(module_id=m.id, number=i+1) for i in range(m.lesson_count)]
        session.add_all(lessons)
        session.commit()
        watched_count = 0
        return ModuleDetail(
            id=m.id, course_id=m.course_id, title=m.title,
            lesson_count=m.lesson_count, watched_count=watched_count, progress=0.0
        )

# ---------- API: Modules & Lessons ----------
@app.get("/api/modules/{module_id}", response_model=ModuleDetail)
def get_module(module_id: int):
    with SessionLocal() as session:
        m = session.get(Module, module_id)
        if not m:
            raise HTTPException(404, "Módulo não encontrado.")
        watched_count = session.scalar(select(func.sum(func.cast(Lesson.watched, Integer))).where(Lesson.module_id == module_id)) or 0
        progress = (watched_count / m.lesson_count * 100.0) if m.lesson_count else 0.0
        return ModuleDetail(
            id=m.id, course_id=m.course_id, title=m.title,
            lesson_count=m.lesson_count, watched_count=int(watched_count), progress=round(progress, 2)
        )

@app.get("/api/modules/{module_id}/lessons", response_model=List[LessonOut])
def list_lessons(module_id: int):
    with SessionLocal() as session:
        m = session.get(Module, module_id)
        if not m:
            raise HTTPException(404, "Módulo não encontrado.")
        lessons = session.execute(select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.number)).scalars().all()
        return [LessonOut(id=l.id, module_id=l.module_id, number=l.number, watched=l.watched, watched_at=l.watched_at) for l in lessons]

@app.post("/api/lessons/{lesson_id}/toggle", response_model=Dict[str, Any])
def toggle_lesson(lesson_id: int):
    with SessionLocal() as session:
        l = session.get(Lesson, lesson_id)
        if not l:
            raise HTTPException(404, "Aula não encontrada.")
        now = datetime.now(timezone.utc)
        # Toggle logic
        l.watched = not l.watched
        if l.watched:
            l.watched_at = now
            action = "watched"
        else:
            l.watched_at = None
            action = "unwatched"
        # Log change
        session.add(LessonLog(lesson_id=l.id, action=action, timestamp=now))
        session.commit()

        # Compute updated module summary
        m = session.get(Module, l.module_id)
        watched_count = session.scalar(select(func.sum(func.cast(Lesson.watched, Integer))).where(Lesson.module_id == m.id)) or 0
        progress = (watched_count / m.lesson_count * 100.0) if m.lesson_count else 0.0
        return {
            "lesson": {"id": l.id, "module_id": l.module_id, "number": l.number, "watched": l.watched, "watched_at": l.watched_at},
            "module": {"id": m.id, "course_id": m.course_id, "title": m.title, "lesson_count": m.lesson_count, "watched_count": int(watched_count), "progress": round(progress, 2)},
        }

@app.get("/api/lessons/{lesson_id}/logs", response_model=List[LogOut])
def lesson_logs(lesson_id: int):
    with SessionLocal() as session:
        l = session.get(Lesson, lesson_id)
        if not l:
            raise HTTPException(404, "Aula não encontrada.")
        logs = session.execute(select(LessonLog).where(LessonLog.lesson_id == lesson_id).order_by(LessonLog.timestamp.desc()).limit(100)).scalars().all()
        return [LogOut(id=log.id, lesson_id=log.lesson_id, action=log.action, timestamp=log.timestamp) for log in logs]

@app.get("/api/modules/{module_id}/logs", response_model=List[LogOut])
def module_logs(module_id: int, limit: int = 50):
    with SessionLocal() as session:
        m = session.get(Module, module_id)
        if not m:
            raise HTTPException(404, "Módulo não encontrado.")
        logs = session.execute(
            select(LessonLog).join(Lesson, LessonLog.lesson_id == Lesson.id)
            .where(Lesson.module_id == module_id)
            .order_by(LessonLog.timestamp.desc())
            .limit(limit)
        ).scalars().all()
        return [LogOut(id=log.id, lesson_id=log.lesson_id, action=log.action, timestamp=log.timestamp) for log in logs]

# --------------- Serve index -----------------
@app.get("/")
def index():
    # Serve the frontend index.html
    try:
        with open("frontend/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return {"message": "Frontend não encontrado. Verifique o build."}

# ---------- Startup ----------
@app.on_event("startup")
def on_startup():
    create_db()
    seed_if_empty()
