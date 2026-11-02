import QuestionnaireEditor from "./QuestionnaireEditor";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, date } from "../../shared/api";
import { Field, Modal, BusyButton, useAsync } from "../../shared/ui";
import {
  Heading,
  LoadState,
  MutationState,
  useMutation,
  Status,
  localDateInput,
} from "../../shared/Work";

const BASE = "/evaluacion-docente";
const statusLabel = {
  borrador: "En preparación",
  abierto: "Recepción abierta",
  cerrado: "Recepción cerrada",
  publicado: "Resultados publicados",
};

export function Periods() {
  const state = useAsync(() => api(`${BASE}/periodos`), []),
    questionnaires = useAsync(() => api(`${BASE}/cuestionarios`), []);
  const [dialog, setDialog] = useState(null),
    mutation = useMutation();
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      await mutation.run(
        async () => {
          if (dialog.create)
            await api(`${BASE}/periodos`, {
              method: "POST",
              body: {
                title: form.get("title"),
                questionnaire_id: Number(form.get("questionnaire_id")),
                start_date: new Date(form.get("start_date")).toISOString(),
                end_date: new Date(form.get("end_date")).toISOString(),
                minimum_responses: Number(form.get("minimum_responses")),
              },
            });
          else
            await api(`${BASE}/periodos/${dialog.period.id}/estado`, {
              method: "POST",
              body: { status: dialog.next, version: dialog.period.version },
            });
          await state.refresh();
        },
        dialog.create
          ? "Periodo guardado en preparación. Registra las asignaciones antes de abrirlo."
          : "Estado del periodo actualizado.",
      )
    )
      setDialog(null);
  }
  const open = (data) => {
    mutation.clear();
    setDialog(data);
  };
  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Coordinación"
        title="Periodos de evaluación"
        action={
          <button
            className="button button-primary"
            onClick={() => open({ create: true })}
          >
            Preparar un periodo
          </button>
        }
      >
        Prepara cuestionarios y asignaciones, abre la recepción y publica los
        resultados después de revisarlos.
      </Heading>
      {!dialog && <MutationState state={mutation} />}
      <ol className="work-steps">
        <li>
          <span>01</span> Cuestionario
        </li>
        <li>
          <span>02</span> Periodo y asignaciones
        </li>
        <li>
          <span>03</span> Recepción
        </li>
        <li>
          <span>04</span> Revisión y publicación
        </li>
      </ol>
      <LoadState state={state} empty="No hay periodos de evaluación">
        <div className="work-records">
          {state.data?.map((p) => (
            <article className="work-record" key={p.id}>
              <div>
                <span className="record-code">Periodo {p.id}</span>
                <h2>{p.title}</h2>
                <Status value={p.status}>{statusLabel[p.status]}</Status>
                <dl className="work-meta">
                  <div>
                    <dt>Apertura</dt>
                    <dd>{date(p.start_date)}</dd>
                  </div>
                  <div>
                    <dt>Cierre</dt>
                    <dd>{date(p.end_date)}</dd>
                  </div>
                  <div>
                    <dt>Mínimo para mostrar resultados</dt>
                    <dd>{p.minimum_responses} participantes por docente</dd>
                  </div>
                </dl>
              </div>
              <div className="work-actions">
                {p.status === "borrador" && (
                  <Link
                    className="button button-secondary"
                    to={`${BASE}/direccion/grupos`}
                  >
                    Registrar asignaciones
                  </Link>
                )}
                {p.status === "cerrado" && (
                  <Link
                    className="button button-secondary"
                    to={`${BASE}/direccion/comentarios`}
                  >
                    Revisar comentarios
                  </Link>
                )}
                {p.status !== "publicado" && (
                  <button
                    className="button button-primary"
                    onClick={() =>
                      open({
                        period: p,
                        next: {
                          borrador: "abierto",
                          abierto: "cerrado",
                          cerrado: "publicado",
                        }[p.status],
                      })
                    }
                  >
                    {p.status === "borrador"
                      ? "Abrir recepción"
                      : p.status === "abierto"
                        ? "Cerrar recepción"
                        : "Publicar resultados"}
                  </button>
                )}
                {p.status === "publicado" && (
                  <Link
                    className="button button-secondary"
                    to={`${BASE}/direccion/resultados`}
                  >
                    Consultar resultados
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </LoadState>
      {dialog && (
        <Modal
          title={
            dialog.create
              ? "Preparar periodo de evaluación"
              : dialog.next === "abierto"
                ? "Abrir recepción"
                : dialog.next === "cerrado"
                  ? "Cerrar recepción"
                  : "Publicar resultados"
          }
          onClose={() => {
            if (!mutation.busy) setDialog(null);
          }}
        >
          <form onSubmit={submit}>
            <MutationState state={mutation} />
            {dialog.create ? (
              <>
                <Field
                  name="title"
                  label="Nombre del periodo"
                  required
                  minLength={3}
                  maxLength={150}
                />
                <LoadState
                  state={questionnaires}
                  empty="Guarda un cuestionario antes de preparar el periodo"
                  action={
                    <Link
                      className="button button-secondary"
                      to={`${BASE}/direccion/cuestionarios`}
                    >
                      Crear cuestionario
                    </Link>
                  }
                >
                  <Field
                    name="questionnaire_id"
                    label="Versión del cuestionario"
                    as="select"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona un cuestionario
                    </option>
                    {questionnaires.data?.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} · v{q.version}
                      </option>
                    ))}
                  </Field>
                </LoadState>
                <div className="form-grid">
                  <Field
                    name="start_date"
                    label="Apertura de recepción"
                    type="datetime-local"
                    defaultValue={localDateInput()}
                    required
                  />
                  <Field
                    name="end_date"
                    label="Cierre de recepción"
                    type="datetime-local"
                    required
                  />
                </div>
                <Field
                  name="minimum_responses"
                  label="Mínimo de participantes por docente"
                  type="number"
                  min="2"
                  max="500"
                  required
                  hint="Valor definido por el área responsable. El mínimo técnico es 2; no representa una política institucional aprobada."
                />
              </>
            ) : (
              <>
                <p>
                  <strong>{dialog.period.title}</strong>
                </p>
                <p>
                  {dialog.next === "abierto"
                    ? "Los estudiantes con asignación podrán responder durante las fechas registradas."
                    : dialog.next === "cerrado"
                      ? "Se impedirá recibir más respuestas. Después podrás revisar comentarios y publicar los resultados."
                      : "Los docentes verán únicamente sus resultados agregados cuando se alcance el mínimo configurado. Debes revisar antes todos los comentarios y retirar datos identificables."}
                </p>
              </>
            )}
            <div className="work-actions">
              <BusyButton
                type="submit"
                className="button button-primary"
                busy={mutation.busy}
                disabled={dialog.create && !questionnaires.data?.length}
              >
                {dialog.create ? "Guardar periodo" : "Confirmar cambio"}
              </BusyButton>
              <button
                type="button"
                className="button button-secondary"
                disabled={mutation.busy}
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Questionnaires() {
  const state = useAsync(() => api(`${BASE}/cuestionarios`), []),
    mutation = useMutation(),
    [dialog, setDialog] = useState(null);
  async function submit(body) {
    if (
      await mutation.run(async () => {
        await api(`${BASE}/cuestionarios`, { method: "POST", body });
        await state.refresh();
      }, "Versión del cuestionario guardada. Las versiones anteriores se conservan.")
    )
      setDialog(null);
  }
  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Configuración"
        title="Cuestionarios y escalas"
        action={
          <button
            className="button button-primary"
            onClick={() => {
              mutation.clear();
              setDialog({});
            }}
          >
            Crear cuestionario
          </button>
        }
      >
        Cada versión conserva sus preguntas, escala y pesos. Los periodos usan
        una versión fija para mantener comparables sus respuestas.
      </Heading>
      {!dialog && <MutationState state={mutation} />}
      <LoadState state={state} empty="Aún no hay cuestionarios">
        <div className="work-records">
          {state.data?.map((q) => (
            <article className="work-record" key={q.id}>
              <div>
                <span className="record-code">
                  Versión {q.version} · {q.questions.length} preguntas
                </span>
                <h2>{q.title}</h2>
                <p>
                  {[...new Set(q.questions.map((x) => x.section))].join(" · ")}
                </p>
                <p className="work-help">
                  Escala:{" "}
                  {q.options.map((o) => `${o.value} ${o.label}`).join(" / ")}
                </p>
                <details>
                  <summary className="text-link">
                    Consultar preguntas y pesos
                  </summary>
                  <ol>
                    {q.questions.map((question) => (
                      <li key={question.id}>
                        {question.section}: {question.text} · Peso{" "}
                        {question.weight}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
              <button
                className="button button-secondary"
                onClick={() => {
                  mutation.clear();
                  setDialog(q);
                }}
              >
                Crear nueva versión
              </button>
            </article>
          ))}
        </div>
      </LoadState>
      {dialog && (
        <Modal
          title={
            dialog.id ? "Crear versión del cuestionario" : "Crear cuestionario"
          }
          onClose={() => {
            if (!mutation.busy) setDialog(null);
          }}
        >
          <QuestionnaireEditor
            source={dialog}
            mutation={mutation}
            onSave={submit}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
    </>
  );
}

export function ManageAssignments() {
  const state = useAsync(() => api(`${BASE}/asignaciones`), []),
    people = useAsync(() => api(`${BASE}/personas`), []),
    periods = useAsync(() => api(`${BASE}/periodos`), []);
    const groupedAssignments = Object.values(
  (state.data || []).reduce((groups, assignment) => {
    const key = [
      assignment.period_id,
      assignment.group_name,
      assignment.teacher_id,
      assignment.subject
    ].join("|");

    if (!groups[key]) {
      groups[key] = {
        key,
        period_title: assignment.period_title,
        group_name: assignment.group_name,
        teacher_name: assignment.teacher_name,
        subject: assignment.subject,
        total: 0,
        submitted: 0
      };
    }

    groups[key].total++;

    if (assignment.submitted) {
      groups[key].submitted++;
    }

    return groups;
  }, {})
);
  const [dialog, setDialog] = useState(false),
    mutation = useMutation();
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      await mutation.run(async () => {
        await api(`${BASE}/asignaciones`, {
          method: "POST",
          body: {
            period_id: Number(form.get("period_id")),
            student_id: form.get("student_id"),
            teacher_id: form.get("teacher_id"),
            subject: form.get("subject"),
            group_name: form.get("group_name"),
          },
        });
        await state.refresh();
      }, "Asignación guardada.")
    )
      setDialog(false);
  }
  const drafts = (periods.data || []).filter((p) => p.status === "borrador");
  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Preparación"
        title="Asignaciones por periodo"
        action={
          <button
            className="button button-primary"
            onClick={() => {
              mutation.clear();
              setDialog(true);
            }}
          >
            Registrar asignación
          </button>
        }
      >
        Vincula estudiante, docente y asignatura antes de abrir la recepción.
        Cada asignación admite una evaluación.
      </Heading>
      {!dialog && <MutationState state={mutation} />}
      <LoadState state={state} empty="No hay asignaciones registradas">
        <div
          className="work-table"
          role="region"
          aria-label="Asignaciones"
          tabIndex={0}
        >
         <table>
  <thead>
    <tr>
      <th>Periodo y asignatura</th>
      <th>Docente</th>
      <th>Grupo</th>
      <th>Estudiantes</th>
      <th>Participación</th>
    </tr>
  </thead>

  <tbody>
    {groupedAssignments.map((group) => (
      <tr key={group.key}>
        <td>
          {group.subject}
          <small>{group.period_title}</small>
        </td>

        <td>{group.teacher_name}</td>

        <td>{group.group_name}</td>

        <td>{group.total}</td>

        <td>
          <strong>
            {group.submitted} de {group.total}
          </strong>
          <small>
            {group.total - group.submitted} pendientes
          </small>
        </td>
      </tr>
    ))}
  </tbody>
</table>
        </div>
      </LoadState>
      {dialog && (
        <Modal
          title="Registrar asignación de evaluación"
          onClose={() => {
            if (!mutation.busy) setDialog(false);
          }}
        >
          <LoadState state={periods}>
            <LoadState state={people}>
              <form onSubmit={submit}>
                <MutationState state={mutation} />
                {!drafts.length && (
                  <p className="work-note">
                    Prepara un periodo antes de registrar asignaciones.{" "}
                    <Link
                      className="text-link"
                      to={`${BASE}/direccion/periodos`}
                    >
                      Ir a periodos
                    </Link>
                  </p>
                )}
                <Field
                  name="period_id"
                  label="Periodo en preparación"
                  as="select"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona el periodo
                  </option>
                  {drafts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Field>
                {[
                  ["student_id", "Estudiante", "estudiante"],
                  ["teacher_id", "Docente", "docente"],
                ].map(([name, label, role]) => (
                  <Field
                    key={name}
                    name={name}
                    label={label}
                    as="select"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona la cuenta
                    </option>
                    {people.data
                      ?.filter((p) => p.role === role)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.email}
                        </option>
                      ))}
                  </Field>
                ))}
                <Field
                  name="subject"
                  label="Asignatura"
                  required
                  minLength={3}
                  maxLength={150}
                />
                <Field
                  name="group_name"
                  label="Grupo"
                  required
                  maxLength={80}
                />
                <div className="work-actions">
                  <BusyButton
                    type="submit"
                    busy={mutation.busy}
                    disabled={!drafts.length}
                    className="button button-primary"
                  >
                    Guardar asignación
                  </BusyButton>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={mutation.busy}
                    onClick={() => setDialog(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </LoadState>
          </LoadState>
        </Modal>
      )}
    </>
  );
}

export function People({ role }) {
  const state = useAsync(() => api(`${BASE}/personas`), []);
  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Cuentas habilitadas"
        title={role === "docente" ? "Docentes" : "Estudiantes"}
      >
        Consulta las cuentas disponibles para las asignaciones. Su alta y sus
        permisos se administran en la identidad compartida del portal.
      </Heading>
      <LoadState state={state} empty="No hay cuentas habilitadas">
        <div
          className="work-table"
          role="region"
          aria-label="Cuentas disponibles"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
              </tr>
            </thead>
            <tbody>
              {state.data
                ?.filter((p) => p.role === role)
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.email}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </LoadState>
    </>
  );
}
