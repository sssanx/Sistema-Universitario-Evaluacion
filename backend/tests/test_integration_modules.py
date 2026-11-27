"""Regresiones de integración, con cuentas y expedientes exclusivamente ficticios."""

from datetime import timedelta

import json

import pytest

from sqlalchemy import select

from app.core.models import User, now

from app.core.database import SessionLocal

from app.modules.becas.models import ScholarshipCall, ScholarshipApplication, ScholarshipSocioeconomic

from app.modules.evaluacion_docente.models import Submission

from conftest import in_review



EVD = "/api/v1/evaluacion-docente"

BEC = "/api/v1/becas"





def scholarship(clients, expired=False):

    c = clients["administrador"].post(f"{BEC}/convocatorias", json={

        "title": "Convocatoria ficticia de integración", "modalidad": "academica",

        "description": "Bases ficticias para comprobar la integración.", "min_gpa": 8,

        "amount": "100.25", "slots": 5, "custom_questions": [],

        "start_date": (now() - timedelta(days=10)).isoformat(),

        "end_date": (now() + timedelta(days=-1 if expired else 10)).isoformat(),

    })

    assert c.status_code == 200

    student = clients["estudiante"]

    assert student.post(f"{BEC}/socioeconomico", json={"monthly_income": "1000.25", "monthly_expenses": "900.10", "dependents_count": 2, "housing_type": "propia", "details": {}}).status_code == 200

    response = student.post(f"{BEC}/solicitudes", json={"call_id": c.json()["id"], "gpa": 9.2, "academic_term": "Periodo ficticio", "major": "Programa ficticio", "custom_answers": {}})

    return response





@pytest.mark.parametrize("role", ["docente", "evaluador", "auditor"])

def test_new_roles_cannot_read_title_cases(clients, role):

    case = in_review(clients)

    for path in ("applications", f"applications/{case['id']}", "catalogs"):

        assert clients[role].get(f"/api/v1/titulacion/{path}").status_code == 403





def test_becas_rejects_expired_calls(clients):

    assert scholarship(clients, expired=True).status_code == 400

    with SessionLocal() as db:

        assert not db.scalar(select(ScholarshipApplication.id))





def test_becas_isolates_sensitive_records_and_validates_uploads(clients):

    response = scholarship(clients)

    assert response.status_code == 200

    id = response.json()["id"]

    notice = clients["estudiante"].get("/api/v1/notifications").json()[0]

    assert notice["target_path"] == f"/becas/solicitud/{id}"

    for role in ("vinculacion", "docente", "auditor", "tesoreria"):

        assert clients[role].get(f"{BEC}/solicitudes/{id}").status_code == 403

        assert clients[role].get(f"{BEC}/socioeconomico").status_code == 403

        assert clients[role].post(f"{BEC}/solicitudes/{id}/documentos", data={"kind": "kardex"}, files={"file": ("falso.pdf", b"no es PDF", "application/pdf")}).status_code == 403

    student = clients["estudiante"]

    assert student.post(f"{BEC}/solicitudes/{id}/documentos", data={"kind": "kardex"}, files={"file": ("falso.pdf", b"no es PDF", "application/pdf")}).status_code == 422

    assert student.post(f"{BEC}/solicitudes/{id}/documentos", data={"kind": "kardex"}, files={"file": ("vacio.pdf", b"", "application/pdf")}).status_code == 422

    assert student.post(f"{BEC}/solicitudes/{id}/documentos", data={"kind": "desconocido"}, files={"file": ("ejemplo.pdf", b"%PDF-1.4", "application/pdf")}).status_code == 422

    assert clients["otro"].get(f"{BEC}/solicitudes/{id}").status_code == 403

    reviewer = clients["evaluador"]

    assert reviewer.post(f"{BEC}/solicitudes/{id}/dictamen", json={"decision": "aprobada", "committee_notes": "Revisión ficticia.", "version": 1}).status_code == 409

    assert reviewer.post(f"{BEC}/solicitudes/{id}/dictamen", json={"decision": "revision", "committee_notes": "Completar documentos.", "version": 1}).status_code == 200

    assert reviewer.post(f"{BEC}/solicitudes/{id}/dictamen", json={"decision": "rechazada", "committee_notes": "Versión desactualizada.", "version": 1}).status_code == 409





def test_becas_orders_are_unique_and_never_invent_bank_references(clients):

    response = scholarship(clients)

    id = response.json()["id"]

    with SessionLocal() as db:

        db.get(ScholarshipApplication, id).status = "aprobada"

        db.commit()

    payload = {"application_id": id, "period": "Periodo ficticio", "scheduled_date": (now() + timedelta(days=3)).isoformat()}

    assert clients["evaluador"].post(f"{BEC}/ordenes-cobro/generar", json=payload).status_code == 403

    assert clients["administrador"].post(f"{BEC}/ordenes-cobro/generar", json=payload).status_code == 403

    assert clients["tesoreria"].post(f"{BEC}/ordenes-cobro/generar", json=payload).status_code == 200

    assert clients["tesoreria"].post(f"{BEC}/ordenes-cobro/generar", json=payload).status_code == 409

    orders = clients["estudiante"].get(f"{BEC}/ordenes-cobro").json()

    assert len(orders) == 1 and orders[0]["reference"] == ""

    assert float(orders[0]["amount"]) == 100.25





def setup_evaluation(clients):

    admin = clients["administrador"]

    q = admin.post(f"{EVD}/cuestionarios", json={"title": "Cuestionario ficticio", "options": [{"value": i, "label": f"Opción {i}"} for i in range(1, 4)], "questions": [{"id": f"q{i}", "section": f"Sección {i}", "text": f"Pregunta de ejemplo número {i}", "weight": 2 if i == 1 else 1} for i in range(1, 4)]})

    assert q.status_code == 201, q.text

    period = admin.post(f"{EVD}/periodos", json={"title": "Periodo ficticio de integración", "questionnaire_id": q.json()["id"], "start_date": (now() - timedelta(days=1)).isoformat(), "end_date": (now() + timedelta(days=10)).isoformat(), "minimum_responses": 2})

    assert period.status_code == 201

    period_id = period.json()["id"]

    people = {u["email"]: u for u in admin.get(f"{EVD}/personas").json()}

    teacher = people["docente@test.local"]["id"]

    ids = []

    for student in ("estudiante", "otro"):

        a = admin.post(f"{EVD}/asignaciones", json={"period_id": period_id, "student_id": people[f"{student}@test.local"]["id"], "teacher_id": teacher, "subject": "Asignatura ficticia", "group_name": "Grupo de prueba"})

        assert a.status_code == 201

        ids.append(a.json()["id"])

    assert clients["estudiante"].get(f"{EVD}/asignaciones").json() == []

    assert clients["docente"].get(f"{EVD}/asignaciones").json() == []

    assert clients["estudiante"].get(f"{EVD}/asignaciones/{ids[0]}").status_code == 404

    assert admin.post(f"{EVD}/periodos/{period_id}/estado", json={"status": "abierto", "version": 1}).status_code == 200

    return period_id, teacher, ids





def test_evaluation_persists_unique_answers_moderates_and_publishes(clients):

    period, teacher, ids = setup_evaluation(clients)

    student, admin, docente = clients["estudiante"], clients["administrador"], clients["docente"]

    assert student.get(f"{EVD}/asignaciones/{ids[1]}").status_code == 404

    assert student.get(f"{EVD}/personas").status_code == 403

    assert student.post(f"{EVD}/asignaciones/{ids[0]}/respuesta", json={"answers": {"q1": 99}}).status_code == 422

    answers = {"q1": 1, "q2": 2, "q3": 3}

    assert student.post(f"{EVD}/asignaciones/{ids[0]}/respuesta", json={"answers": answers, "comment": "Comentario ficticio para revisar."}).status_code == 201

    assert student.post(f"{EVD}/asignaciones/{ids[0]}/respuesta", json={"answers": answers}).status_code == 409

    assert student.get(f"{EVD}/asignaciones/{ids[0]}").json()["submitted"] is True

    preview = admin.get(f"{EVD}/resultados?period_id={period}").json()[0]

    assert preview["available"] is False and "average" not in preview

    assert docente.get(f"{EVD}/resultados?period_id={period}").status_code == 403

    assert clients["otro"].post(f"{EVD}/asignaciones/{ids[1]}/respuesta", json={"answers": {"q1": 3, "q2": 3, "q3": 3}}).status_code == 201

    assert admin.post(f"{EVD}/periodos/{period}/estado", json={"status": "cerrado", "version": 2}).status_code == 200

    assert admin.post(f"{EVD}/periodos/{period}/estado", json={"status": "publicado", "version": 3}).status_code == 409

    comments = admin.get(f"{EVD}/comentarios?period_id={period}").json()

    assert len(comments) == 1 and "student_id" not in comments[0]

    assert admin.post(f"{EVD}/comentarios/{comments[0]['id']}/revision", json={"public_comment": "Comentario revisado sin identidad."}).status_code == 200

    assert admin.post(f"{EVD}/periodos/{period}/estado", json={"status": "publicado", "version": 3}).status_code == 200

    report = docente.get(f"{EVD}/resultados?period_id={period}").json()[0]

    assert docente.get("/api/v1/notifications").json()[0]["target_path"] == f"/evaluacion-docente/docente/resultados?periodo={period}"

    assert report["available"] is True and report["average"] == 2.38

    assert report["comments"] == ["Comentario revisado sin identidad."]

    assert "student_id" not in json.dumps(report) and "answers" not in report

    subjects = docente.get(f"{EVD}/asignaciones").json()

    assert all("student_id" not in a and "submitted" not in a for a in subjects)

    assert docente.get(f"{EVD}/resultados?period_id={period}&teacher_id=otra-cuenta").status_code == 403

    assert docente.get(f"{EVD}/reportes.csv?period_id={period}").status_code == 200

    plan = admin.post(f"{EVD}/planes", json={"period_id": period, "teacher_id": teacher, "action": "Acción ficticia de mejora para la asignatura.", "due_date": (now() + timedelta(days=20)).isoformat()})

    assert plan.status_code == 201

    plan_id = plan.json()["id"]

    progress = {"evidence": "Avance ficticio documentado.", "status": "en_proceso", "version": 1}

    assert admin.post(f"{EVD}/planes/{plan_id}/avance", json=progress).status_code == 403

    assert docente.post(f"{EVD}/planes/{plan_id}/avance", json=progress).status_code == 200

    assert docente.post(f"{EVD}/planes/{plan_id}/avance", json=progress).status_code == 409

    # Seguridad de la retroalimentación académica
    feedback_data = {
        "period_id": period,
        "teacher_id": teacher,
        "feedback": "Retroalimentación ficticia de Dirección Académica.",
    }

    # El estudiante y el docente no pueden registrar retroalimentación.
    assert student.post(
        f"{EVD}/retroalimentacion", json=feedback_data
    ).status_code == 403

    assert docente.post(
        f"{EVD}/retroalimentacion", json=feedback_data
    ).status_code == 403

    # Solo el administrador puede registrarla.
    response = admin.post(
        f"{EVD}/retroalimentacion", json=feedback_data
    )
    assert response.status_code == 201

    # No se permite duplicar la retroalimentación.
    assert admin.post(
        f"{EVD}/retroalimentacion", json=feedback_data
    ).status_code == 409

    # El docente puede consultar su propia retroalimentación.
    feedbacks = docente.get(
        f"{EVD}/retroalimentacion?period_id={period}"
    )
    assert feedbacks.status_code == 200
    assert len(feedbacks.json()) == 1
    assert feedbacks.json()[0]["teacher_id"] == teacher
    assert feedbacks.json()[0]["feedback"] == feedback_data["feedback"]

    # Los estudiantes no tienen permiso de consulta.
    assert student.get(
        f"{EVD}/retroalimentacion?period_id={period}"
    ).status_code == 403

    
    # Crear un segundo docente para comprobar la privacidad.
    from app.core.database import SessionLocal
    from app.core.models import User
    from app.core.security import hash_password
    from app.main import app
    from fastapi.testclient import TestClient

    with SessionLocal() as db:
        segundo_docente = User(
            email="segundo-docente@test.local",
            name="Segundo docente",
            role="docente",
            password=hash_password("Prueba-segura-2026!"),
        )
        db.add(segundo_docente)
        db.commit()

    with TestClient(app) as otro_docente:
        login = otro_docente.post(
            "/api/v1/auth/login",
            json={
                "email": "segundo-docente@test.local",
                "password": "Prueba-segura-2026!",
            },
        )
        assert login.status_code == 200

        # No debe recibir la retroalimentación del primer docente.
        response = otro_docente.get(
            f"{EVD}/retroalimentacion?period_id={period}"
        )
        assert response.status_code == 200
        assert response.json() == []






def test_evaluation_requires_institutional_sso_in_production(clients, monkeypatch):

    from app.modules.evaluacion_docente import router

    monkeypatch.setattr(router, "PRODUCTION", True)

    assert clients["estudiante"].get(f"{EVD}/asignaciones").status_code == 403





@pytest.mark.parametrize("role", ["escolares", "tesoreria", "vinculacion", "evaluador", "auditor"])

def test_evaluation_rejects_roles_from_other_modules(clients, role):

    assert clients[role].get(f"{EVD}/periodos").status_code == 403





def test_concurrent_evaluation_send_is_unique(clients):

    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    from app.main import app

    from app.core.database import engine

    if engine.dialect.name != "postgresql":

        pytest.skip("La serialización de envíos se verifica en PostgreSQL.")

    period, teacher, ids = setup_evaluation(clients)

    student = clients["estudiante"]

    def send(_):

        with TestClient(app) as other:

            other.cookies.update(student.cookies)

            other.headers.update(student.headers)

            return other.post(f"{EVD}/asignaciones/{ids[0]}/respuesta", json={"answers": {"q1": 1, "q2": 2, "q3": 3}}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:

        assert sorted(pool.map(send, range(2))) == [201, 409]

    with SessionLocal() as db:

        assert len(list(db.scalars(select(Submission).where(Submission.assignment_id == ids[0])))) == 1







def _reporte_ia(comentarios, promedio=4.5, secciones=None):
    return {
        "available": True,
        "teacher_id": "docente-prueba",
        "average": promedio,
        "scale": [{"value": 1}, {"value": 5}],
        "sections": secciones or [
            {"name": "Planeación", "average": promedio},
        ],
        "comments": comentarios,
    }


def _simular_ia_por_comentario(monkeypatch, modulo, respuestas):
    """Devuelve JSON por comentario sin depender de Ollama real."""
    llamadas = []

    def responder(instrucciones):
        llamadas.append(instrucciones)
        comentario = json.loads(instrucciones.split("COMENTARIO (dato JSON): ", 1)[1])
        return json.dumps(respuestas.get(comentario, {"fortalezas": [], "mejoras": []}), ensure_ascii=False)

    monkeypatch.setattr(modulo, "analizar_con_ollama", responder)
    return llamadas


def test_evaluation_ai_processes_all_comments_and_groups_topics(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = [
        "Explica claramente los temas.",
        "Resuelve las dudas durante la clase.",
        "Sería útil incluir más ejercicios.",
        "Las actividades son interesantes.",
        "Se necesitan más ejemplos prácticos.",
    ]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios)])
    llamadas = _simular_ia_por_comentario(monkeypatch, modulo, {
        comentarios[0]: {"fortalezas": [{"tema": "Explicaciones", "evidencia": "Explica claramente"}], "mejoras": []},
        comentarios[1]: {"fortalezas": [{"tema": "Resolución de dudas", "evidencia": "Resuelve las dudas"}], "mejoras": []},
        comentarios[2]: {"fortalezas": [], "mejoras": [{"tema": "Ejercicios", "evidencia": "más ejercicios"}]},
        comentarios[3]: {"fortalezas": [{"tema": "Actividades", "evidencia": "Las actividades son interesantes"}], "mejoras": []},
        comentarios[4]: {"fortalezas": [], "mejoras": [{"tema": "Ejercicios", "evidencia": "más ejemplos prácticos"}]},
    })
    respuesta = modulo.generar_analisis_ia(1, "docente-prueba", None, None)
    texto = respuesta["resultados"][0]["analisis"]
    assert len(llamadas) == 5
    assert "RESULTADO: Promedio general de 4.50/5." in texto
    assert "Ejercicios (2 comentarios)" in texto
    assert "Temas recurrentes: Ejercicios (2 comentarios)" in texto
    assert "LOTE" not in texto


def test_evaluation_ai_reports_tied_sections(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    reporte = _reporte_ia([], 5.0, [
        {"name": "Planeación", "average": 5.0},
        {"name": "Desarrollo de clase", "average": 5.0},
        {"name": "Evaluación", "average": 5.0},
    ])
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [reporte])
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "FORTALEZAS:" in texto
    assert "Planeación, Desarrollo de clase, Evaluación" in texto
    assert "secciones empatadas" in texto
    assert "RESULTADO: Promedio general de 5.00/5." in texto


def test_evaluation_ai_counts_recurrent_topics_not_single_mentions(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = [
        "Necesitamos más ejercicios en clase.",
        "Sería bueno incluir ejercicios prácticos.",
        "El docente siempre es puntual.",
        "Explica claramente los temas.",
    ]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios)])
    _simular_ia_por_comentario(monkeypatch, modulo, {
        comentarios[0]: {"fortalezas": [], "mejoras": [{"tema": "Ejercicios", "evidencia": "más ejercicios"}]},
        comentarios[1]: {"fortalezas": [], "mejoras": [{"tema": "Ejercicios", "evidencia": "ejercicios prácticos"}]},
        comentarios[2]: {"fortalezas": [{"tema": "Puntualidad", "evidencia": "siempre es puntual"}], "mejoras": []},
        comentarios[3]: {"fortalezas": [{"tema": "Explicaciones", "evidencia": "Explica claramente"}], "mejoras": []},
    })
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "Áreas de oportunidad: Ejercicios (2 comentarios)" in texto
    assert "Temas recurrentes: Ejercicios (2 comentarios)" in texto
    assert "Puntualidad (2 comentarios)" not in texto


def test_evaluation_ai_hides_personal_data_before_ollama(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = [
        "Explica claramente. Mi correo es alumno123@universidad.edu.mx.",
        "Necesitamos más ejercicios. Mi teléfono es 4421234567.",
        "Faltan ejemplos. Mi matrícula: A12345678.",
    ]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios)])
    enviados = []

    def ollama_simulado(instrucciones):
        enviados.append(instrucciones)
        return '{"fortalezas": [], "mejoras": []}'

    monkeypatch.setattr(modulo, "analizar_con_ollama", ollama_simulado)
    modulo.generar_analisis_ia(1, "docente-prueba", None, None)
    contenido = "\n".join(enviados)
    assert len(enviados) == 3
    assert "alumno123@universidad.edu.mx" not in contenido
    assert "4421234567" not in contenido
    assert "A12345678" not in contenido
    assert "[CORREO OCULTO]" in contenido
    assert "[TELÉFONO OCULTO]" in contenido
    assert "[MATRÍCULA OCULTA]" in contenido


def test_evaluation_ai_does_not_count_negated_positive(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = ["No está bien.", "Está bien, pero faltan prácticas."]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios, 4.0)])
    _simular_ia_por_comentario(monkeypatch, modulo, {
        comentarios[0]: {"fortalezas": [], "mejoras": []},
        comentarios[1]: {
            "fortalezas": [{"tema": "Valoración general", "evidencia": "Está bien"}],
            "mejoras": [{"tema": "Prácticas", "evidencia": "faltan prácticas"}],
        },
    })
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "Fortalezas mencionadas: Valoración general (1 comentario)" in texto
    assert "Áreas de oportunidad: Prácticas (1 comentario)" in texto
    assert "Valoración general (2 comentarios)" not in texto


def test_evaluation_ai_verifies_textual_evidence():
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = ["Esta bien, falta mejorar las practicas.", "que lleguen temprano"]
    assert modulo.verificar_evidencia_ia(
        'Mejorar las prácticas [Evidencia: "falta mejorar las practicas"]', comentarios
    ) == {"hallazgo": "Mejorar las prácticas", "evidencia": "falta mejorar las practicas"}
    assert modulo.verificar_evidencia_ia(
        'Mejorar la comunicación [Evidencia: "falta comunicación"]', comentarios
    ) is None
    assert modulo.verificar_evidencia_ia("Mejorar la atención al estudiante", comentarios) is None


def test_evaluation_ai_filters_unsupported_findings(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = ["Esta bien, falta mejorar las practicas.", "que lleguen temprano"]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios, 5.0)])
    _simular_ia_por_comentario(monkeypatch, modulo, {
        comentarios[0]: {
            "fortalezas": [{"tema": "Actitud", "evidencia": "falta comunicación"}],
            "mejoras": [{"tema": "Prácticas", "evidencia": "falta mejorar las practicas"}],
        },
        comentarios[1]: {
            "fortalezas": [],
            "mejoras": [{"tema": "Puntualidad", "evidencia": "lleguen temprano"}],
        },
    })
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "falta comunicación" not in texto
    assert "Actitud" not in texto
    assert "Prácticas (1 comentario)" in texto
    assert "Puntualidad (1 comentario)" in texto


def test_evaluation_ai_groups_open_topics_without_fixed_rules(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentarios = [
        "Mejorar la comunicacion",
        "Mejorar la comunicación, menos teórico",
    ]
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(comentarios, 5.0)])
    _simular_ia_por_comentario(monkeypatch, modulo, {
        comentarios[0]: {"fortalezas": [], "mejoras": [
            {"tema": "comunicacion", "evidencia": "Mejorar la comunicacion"},
        ]},
        comentarios[1]: {"fortalezas": [], "mejoras": [
            {"tema": "comunicación", "evidencia": "Mejorar la comunicación"},
            {"tema": "teoría", "evidencia": "menos teórico"},
        ]},
    })
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "comunicación (2 comentarios)" in texto
    assert "teoría (1 comentario)" in texto
    assert "Temas recurrentes: comunicación (2 comentarios)" in texto
    assert "teoría (2 comentarios)" not in texto


def test_evaluation_ai_does_not_double_count_same_comment(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    comentario = "La comunicación podría mejorar, mejorar la comunicación."
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia([comentario])])
    _simular_ia_por_comentario(monkeypatch, modulo, {
        comentario: {"fortalezas": [], "mejoras": [
            {"tema": "Comunicación", "evidencia": "comunicación podría mejorar"},
            {"tema": "comunicacion", "evidencia": "mejorar la comunicación"},
        ]},
    })
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "Comunicación (1 comentario)" in texto
    assert "Comunicación (2 comentarios)" not in texto
    assert "Temas recurrentes: No se identificaron" in texto


def test_evaluation_ai_rejects_invalid_model_json(monkeypatch):
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    monkeypatch.setattr(modulo, "results", lambda *args, **kwargs: [_reporte_ia(["Mejorar la comunicación."])])
    monkeypatch.setattr(modulo, "analizar_con_ollama", lambda *args, **kwargs: "respuesta inválida")
    texto = modulo.generar_analisis_ia(1, "docente-prueba", None, None)["resultados"][0]["analisis"]
    assert "algunas respuestas de IA no pudieron interpretarse" in texto
    assert "Comunicación (1 comentario)" not in texto


def test_evaluation_ai_classifies_comments(monkeypatch):
    """Compatibilidad de la función anterior, todavía disponible en el módulo."""
    import importlib
    modulo = importlib.import_module("app.modules.evaluacion_docente.router")
    monkeypatch.setattr(modulo, "analizar_con_ollama", lambda *args: "PRACTICAS")
    assert modulo.clasificar_comentario_ia("Falta mejorar las prácticas.") == "PRACTICAS"
    monkeypatch.setattr(modulo, "analizar_con_ollama", lambda *args: "PUNTUALIDAD")
    assert modulo.clasificar_comentario_ia("Que lleguen temprano.") == "PUNTUALIDAD"
    monkeypatch.setattr(modulo, "analizar_con_ollama", lambda *args: "Una respuesta inesperada")
    assert modulo.clasificar_comentario_ia("Comentario ambiguo.") == "NO_CLASIFICADO"

def test_evaluation_rejects_personal_data_in_comments(clients):
    period, teacher, ids = setup_evaluation(clients)

    admin = clients["administrador"]

    respuesta = clients["estudiante"].post(
        f"{EVD}/asignaciones/{ids[0]}/respuesta",
        json={
            "answers": {"q1": 1, "q2": 2, "q3": 3},
            "comment": "Comentario para revisión.",
        },
    )
    assert respuesta.status_code == 201

    comentarios = admin.get(
        f"{EVD}/comentarios?period_id={period}"
    ).json()

    submission_id = comentarios[0]["id"]

    for texto in (
        "Mi correo es alumno@universidad.edu.mx",
        "Mi teléfono es 4421234567",
        "Mi matrícula: A12345678",
    ):
        respuesta = admin.post(
            f"{EVD}/comentarios/{submission_id}/revision",
            json={"public_comment": texto},
        )
        assert respuesta.status_code == 422

    respuesta = admin.post(
        f"{EVD}/comentarios/{submission_id}/revision",
        json={"public_comment": "Mejorar las actividades prácticas."},
    )
    assert respuesta.status_code == 200