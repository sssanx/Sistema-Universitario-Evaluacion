import { useState } from "react";
import { api } from "../../shared/api";
import { Field, Modal, BusyButton, useAsync } from "../../shared/ui";
import {
  Heading,
  LoadState,
  MutationState,
  useMutation,
} from "../../shared/Work";

const BASE = "/evaluacion-docente";

function GenerateEvaluationsModal({ group, onClose, mutation }) {
  const subjects = useAsync(
    () => api(`${BASE}/grupos/${group.id}/materias`),
    [group.id],
  );
  const periods = useAsync(() => api(`${BASE}/periodos`), []);
  const drafts = (periods.data || []).filter((period) => period.status === "borrador");

  async function generate(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const saved = await mutation.run(async () => {
      const result = await api(`${BASE}/asignaciones/grupo`, {
        method: "POST",
        body: {
          period_id: Number(form.get("period_id")),
          group_id: group.id,
          group_subject_id: Number(form.get("group_subject_id")),
        },
      });
      return result;
    }, "Evaluaciones del grupo generadas correctamente.");

    if (saved) onClose();
  }

  return (
    <Modal
      title={`Generar evaluaciones para ${group.name}`}
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <LoadState state={periods} empty="No hay períodos de evaluación disponibles">
        <LoadState state={subjects} empty="Este grupo todavía no tiene materias asignadas">
          <form onSubmit={generate}>
            <MutationState state={mutation} />
            <p className="work-help">
              Se creará una asignación por estudiante inscrito en el grupo para
              la materia seleccionada. Las asignaciones existentes no se duplicarán.
            </p>
            {!drafts.length && (
              <p className="work-note">
                Necesitas preparar un período en borrador antes de generar evaluaciones.
              </p>
            )}
            <Field
              name="period_id"
              label="Período en preparación"
              as="select"
              required
              defaultValue=""
            >
              <option value="" disabled>Selecciona un período</option>
              {drafts.map((period) => (
                <option key={period.id} value={period.id}>{period.title}</option>
              ))}
            </Field>
            <Field
              name="group_subject_id"
              label="Materia y docente"
              as="select"
              required
              defaultValue=""
            >
              <option value="" disabled>Selecciona una materia</option>
              {subjects.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject} · {item.teacher_name}
                </option>
              ))}
            </Field>
            <div className="work-actions">
              <BusyButton
                type="submit"
                className="button button-primary"
                busy={mutation.busy}
                disabled={!drafts.length || !subjects.data?.length}
              >
                Generar evaluaciones
              </BusyButton>
              <button
                type="button"
                className="button button-secondary"
                disabled={mutation.busy}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </form>
        </LoadState>
      </LoadState>
    </Modal>
  );
}

function GroupSubjectsList({ group }) {
  const subjects = useAsync(
    () => api(`${BASE}/grupos/${group.id}/materias`),
    [group.id],
  );

  return (
    <section>
      <h3>Materias y docentes asignados</h3>
      <LoadState state={subjects} empty="Este grupo todavía no tiene materias asignadas">
        <div className="work-records">
          {subjects.data?.map((item) => (
            <article className="work-record" key={item.id}>
              <div>
                <h4>{item.subject}</h4>
                <p className="work-help">Docente: {item.teacher_name}</p>
              </div>
            </article>
          ))}
        </div>
      </LoadState>
    </section>
  );
}

function GroupStudentsList({ group }) {
  const students = useAsync(
    () => api(`${BASE}/grupos/${group.id}/estudiantes`),
    [group.id],
  );

  return (
    <section>
      <h3>Estudiantes inscritos</h3>
      <LoadState state={students} empty="Este grupo todavía no tiene estudiantes inscritos">
        <div className="work-table" role="region" aria-label="Estudiantes inscritos" tabIndex={0}>
          <table style={{ width: "100%", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
              </tr>
            </thead>
            <tbody>
              {students.data?.map((student) => (
                <tr key={student.id}>
                  <td style={{ overflowWrap: "anywhere" }}>{student.name}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{student.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LoadState>
    </section>
  );
}

export function AcademicGroups() {
  const groups = useAsync(() => api(`${BASE}/grupos`), []);
  const people = useAsync(() => api(`${BASE}/personas`), []);
  const mutation = useMutation();
  const [dialog, setDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [subjectGroup, setSubjectGroup] = useState(null);
  const [generationGroup, setGenerationGroup] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos`, {
        method: "POST",
        body: {
          name: form.get("name"),
          career: form.get("career"),
          academic_term: form.get("academic_term"),
        },
      });
      await groups.refresh();
    }, "Grupo académico registrado correctamente.");
    if (saved) setDialog(false);
  }

  async function enrollStudent(e) {
    e.preventDefault();
    if (!selectedGroup) return;
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos/${selectedGroup.id}/estudiantes`, {
        method: "POST",
        body: { student_id: form.get("student_id") },
      });
    }, "Estudiante inscrito correctamente.");
    if (saved) setSelectedGroup(null);
  }

  async function assignSubject(e) {
    e.preventDefault();
    if (!subjectGroup) return;
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos/${subjectGroup.id}/materias`, {
        method: "POST",
        body: {
          teacher_id: form.get("teacher_id"),
          subject: form.get("subject"),
        },
      });
    }, "Materia y docente asignados correctamente.");
    if (saved) setSubjectGroup(null);
  }

  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Dirección académica"
        title="Grupos académicos"
        action={
          <button
            className="button button-primary"
            onClick={() => {
              mutation.clear();
              setDialog(true);
            }}
          >
            Registrar grupo
          </button>
        }
      >
        Administra los grupos académicos utilizados para organizar las
        evaluaciones docentes.
      </Heading>

      {!dialog && !selectedGroup && !subjectGroup && !generationGroup && (
        <MutationState state={mutation} />
      )}

      <LoadState state={groups} empty="Todavía no hay grupos académicos registrados">
        <div className="work-records">
          {groups.data?.map((group) => (
            <article className="work-record" key={group.id}>
              <div>
                <span className="record-code">Grupo {group.id}</span>
                <h2>{group.name}</h2>
                <dl className="work-meta">
                  <div>
                    <dt>Carrera</dt>
                    <dd>{group.career}</dd>
                  </div>
                  <div>
                    <dt>Período académico</dt>
                    <dd>{group.academic_term}</dd>
                  </div>
                </dl>
              </div>
              <div className="work-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    mutation.clear();
                    setSelectedGroup(group);
                  }}
                >
                  Administrar estudiantes
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    mutation.clear();
                    setSubjectGroup(group);
                  }}
                >
                  Asignar materia y docente
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    mutation.clear();
                    setGenerationGroup(group);
                  }}
                >
                  Generar evaluaciones
                </button>
              </div>
            </article>
          ))}
        </div>
      </LoadState>

      {selectedGroup && (
        <Modal
          title={`Inscribir estudiante en ${selectedGroup.name}`}
          onClose={() => {
            if (!mutation.busy) setSelectedGroup(null);
          }}
        >
          <GroupStudentsList group={selectedGroup} />
          <LoadState state={people} empty="No hay cuentas disponibles">
            <form onSubmit={enrollStudent}>
              <MutationState state={mutation} />
              <Field name="student_id" label="Estudiante" as="select" required defaultValue="">
                <option value="" disabled>Selecciona un estudiante</option>
                {people.data
                  ?.filter((person) => person.role === "estudiante")
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} · {student.email}
                    </option>
                  ))}
              </Field>
              <div className="work-actions">
                <BusyButton type="submit" className="button button-primary" busy={mutation.busy}>
                  Inscribir estudiante
                </BusyButton>
                <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setSelectedGroup(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </LoadState>
        </Modal>
      )}

      {subjectGroup && (
        <Modal
          title={`Asignar materia y docente a ${subjectGroup.name}`}
          onClose={() => {
            if (!mutation.busy) setSubjectGroup(null);
          }}
        >
          <GroupSubjectsList group={subjectGroup} />
          <LoadState state={people} empty="No hay cuentas disponibles">
            <form onSubmit={assignSubject}>
              <MutationState state={mutation} />
              <Field name="teacher_id" label="Docente" as="select" required defaultValue="">
                <option value="" disabled>Selecciona un docente</option>
                {people.data
                  ?.filter((person) => person.role === "docente")
                  .map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} · {teacher.email}
                    </option>
                  ))}
              </Field>
              <Field name="subject" label="Asignatura" required minLength={3} maxLength={150} />
              <div className="work-actions">
                <BusyButton type="submit" className="button button-primary" busy={mutation.busy}>
                  Guardar asignación
                </BusyButton>
                <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setSubjectGroup(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </LoadState>
        </Modal>
      )}

      {generationGroup && (
        <GenerateEvaluationsModal
          key={generationGroup.id}
          group={generationGroup}
          mutation={mutation}
          onClose={() => setGenerationGroup(null)}
        />
      )}

      {dialog && (
        <Modal
          title="Registrar grupo académico"
          onClose={() => {
            if (!mutation.busy) setDialog(false);
          }}
        >
          <form onSubmit={submit}>
            <MutationState state={mutation} />
            <Field name="name" label="Nombre del grupo" required minLength={2} maxLength={80} />
            <Field name="career" label="Carrera" required minLength={3} maxLength={150}/>
            <Field name="academic_term" label="Período académico" required minLength={3} maxLength={50} />
            <div className="work-actions">
              <BusyButton type="submit" className="button button-primary" busy={mutation.busy}>
                Guardar grupo
              </BusyButton>
              <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setDialog(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
