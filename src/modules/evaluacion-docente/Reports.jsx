import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { useAuth } from "../../app/Auth";
import { api } from "../../shared/api";
import { Field, Modal, BusyButton, Empty, useAsync } from "../../shared/ui";
import {
  Heading,
  LoadState,
  MutationState,
  useMutation,
  Status,
} from "../../shared/Work";
const BASE = "/evaluacion-docente";
export function Results() {
  const { user } = useAuth(),
    admin = user.role === "administrador",
    [params] = useSearchParams();
  const periods = useAsync(() => api(`${BASE}/periodos`), []),
    [selection, setSelection] = useState("");
  const id = selection || params.get("periodo") || periods.data?.[0]?.id || "";
  const [analisisIA, setAnalisisIA] = useState({});
  const [cargandoIA, setCargandoIA] = useState(null);
  const [errorIA, setErrorIA] = useState("");
  const period = periods.data?.find((p) => String(p.id) === String(id));
  const visible = period && (admin || period.status === "publicado");
  const state = useAsync(
    () =>
      visible ? api(`${BASE}/resultados?period_id=${id}`) : Promise.resolve([]),
    [id, visible],
  );
  const plans = useAsync(
  () => visible ? api(`${BASE}/planes`) : Promise.resolve([]),
  [visible],
);
const feedbacks = useAsync(
  () =>
    visible && id
      ? api(`${BASE}/retroalimentacion?period_id=${id}`)
      : Promise.resolve([]),
  [id, visible],
);
async function analizarDocente(teacherId) {
  setCargandoIA(teacherId);
  setErrorIA("");
  try {
    const respuesta = await api(
      `${BASE}/analisis-ia?period_id=${encodeURIComponent(id)}&teacher_id=${encodeURIComponent(teacherId)}`,
      { method: "POST" }
    );
    const resultado = respuesta.resultados?.[0];
    if (!resultado) {
      throw new Error("No se recibió un análisis de la IA.");
    }
    setAnalisisIA((anteriores) => ({
      ...anteriores,
      [teacherId]: resultado.analisis,
    }));
  } catch (error) {
    setErrorIA(error.message || "No se pudo generar el análisis.");
  } finally {
    setCargandoIA(null);
  }
}
  return (
    <>
    <div className="no-print">
       <Heading
        eyebrow={
          admin
            ? "Evaluación docente / Coordinación"
            : "Evaluación docente / Docente"
        }
        title={admin ? "Resultados por periodo" : "Mis resultados"}
        action={
          visible && (
            <div className="work-actions no-print">
              <a
                className="button button-secondary"
                href={`/api/v1${BASE}/reportes.csv?period_id=${id}`}
              >
                <Download size={16} /> Exportar CSV
              </a>
              <button
                className="button button-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Imprimir informe
              </button>
            </div>
          )
        }
      >
        {admin
          ? "Consulta resultados agregados y verifica el umbral de privacidad antes de publicar."
          : "Consulta tus resultados y los comentarios revisados después de su publicación."}
      </Heading>
    </div>
      <LoadState state={periods} empty="No hay periodos asignados">
        <div className="work-toolbar no-print">
          <Field
            as="select"
            label="Periodo de evaluación"
            value={id}
            onChange={(e) => setSelection(e.target.value)}
          >
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Field>
          {period && (
            <Status value={period.status}>
              {period.status === "publicado"
                ? "Publicado"
                : "Pendiente de publicación"}
            </Status>
          )}
        </div>
        {!visible ? (
          <Empty title="Resultados pendientes de publicación">
            El área responsable debe cerrar la recepción, revisar los
            comentarios y publicar el periodo.
          </Empty>
        ) : (
          <LoadState
            state={state}
            empty="No hay resultados registrados para este periodo"
          >
            {state.data?.map((report) => (
          <article className="work-report" key={report.teacher_id} data-teacher-id={report.teacher_id}
>                <span className="eyebrow">
                  {report.period_title} ·{" "}
                  {report.published ? "Publicado" : "Vista interna"}
                </span>
                <h2>{report.teacher_name}</h2>
                <div className="work-actions no-print">
                  <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                const teacherId = String(report.teacher_id);
                document.querySelectorAll(".work-report").forEach((element) => {
                  element.classList.toggle(
                    "print-selected",
                    element.dataset.teacherId === teacherId
                  );
                });
                document.body.dataset.printTeacher = teacherId;
                window.addEventListener(
                  "afterprint",
                  () => {
                    delete document.body.dataset.printTeacher;
                    document.querySelectorAll(".work-report").forEach((element) => {
                      element.classList.remove("print-selected");
                    });
                  },
                  { once: true }
                );
                window.print();
              }}
              >
                Descargar PDF
              </button>
            </div>
           {report.subjects?.length > 0 && (
                  <p className="work-help">
           <strong>Asignaturas:</strong> {report.subjects.join(", ")}
           </p>
        )}
        {report.careers?.length > 0 && (
          <p className="work-help">
          <strong>Carreras:</strong> {report.careers.join(", ")}
          </p>
            )}
                {report.available ? (
                  <>
                    <dl className="work-meta">
                      <div>
                        <dt>Promedio ponderado</dt>
                        <dd>
                          <span className="result-average">
                            {report.average.toFixed(2)}
                          </span>{" "}
                          / {Math.max(...report.scale.map((o) => o.value))}
                        </dd>
                      </div>
                      <div>
                        <dt>Evaluaciones recibidas</dt>
                        <dd>{report.response_count}</dd>
                      </div>
                      <div>
                        <dt>Participantes</dt>
                        <dd>{report.participant_count}</dd>
                      </div>
                    </dl>
                    <div
                      className="work-bars"
                      aria-label="Promedios por sección"
                    >
                      {report.sections.map((s) => (
                        <div key={s.name} className="work-bar">
                          <div>
                            <span>{s.name}</span>
                            <strong>{s.average.toFixed(2)}</strong>
                          </div>
                          <div className="work-bar-track" aria-hidden="true">
                            <span
                              style={{
                                width: `${(100 * s.average) / Math.max(...report.scale.map((o) => o.value))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
              <details className="question-results-table">
                        <summary className="text-link">Consultar resultados por pregunta</summary>
                      <div
                        className="work-table"
                        role="region"
                        aria-label={`Resultados de ${report.teacher_name}`}
                        tabIndex={0}
                      >
                        <table>
                          <thead>
                            <tr>
                              <th>Sección y pregunta</th>
                              <th>Peso</th>
                              <th>Promedio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.questions.map((q) => (
                              <tr key={q.id}>
                                <td>
                                  {q.text}
                                  <small>{q.section}</small>
                                </td>
                                <td>{q.weight}</td>
                                <td>{q.average.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  <p className="work-help">{report.calculation}</p>
          <div className="work-bars question-chart-grid" aria-label="Gráfica de resultados por pregunta">
                <h4>Promedios por pregunta</h4>
                  {report.questions.map((q) => (
                    <div key={q.id} className="work-bar">
                      <div>
                        <span>{q.text}</span>
                        <strong>{q.average.toFixed(2)}</strong>
                      </div>
                      <div className="work-bar-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${(q.average / Math.max(...report.scale.map((o) => o.value))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
<div className="work-actions">
  <button
    type="button"
    className="button button-secondary"
    disabled={cargandoIA !== null}
    onClick={() => analizarDocente(report.teacher_id)}
  >
    {cargandoIA === report.teacher_id
      ? "Analizando con IA..."
      : "Analizar con IA"}
  </button>
</div>
{analisisIA[report.teacher_id] && (
  <section className="work-section">
    <h3>Resumen de evaluación docente</h3>
    {(() => {
      const lineas = analisisIA[report.teacher_id].split("\n");
      const obtener = (titulo) => {
        const linea = lineas.find((l) => l.startsWith(titulo));
        return linea ? linea.slice(titulo.length).trim() : "";
      };
      const fortalezas = obtener("Fortalezas mencionadas:");
      const mejoras = obtener("Áreas de oportunidad:");
      const recurrentes = obtener("Temas recurrentes:");
      const recomendaciones = obtener("Recomendaciones sugeridas:");
      return (
        <div>
          {fortalezas && (
            <p>
              <strong>Valoración positiva:</strong> {fortalezas}
            </p>
          )}
          {mejoras && (
            <p>
              <strong>Áreas de mejora:</strong> {mejoras}
            </p>
          )}
          {recurrentes && (
            <p>
              <strong>Temas recurrentes:</strong> {recurrentes}
            </p>
          )}
          {recomendaciones && (
                <div>
                  <p>
                    <strong>Recomendaciones sugeridas por IA:</strong>
                  </p>
                  <ul>
                    {recomendaciones.split("; ").map((recomendacion, i) => (
                      <li key={i}>{recomendacion}</li>
                    ))}
                  </ul>
                </div>
              )}
          <p className="work-help">
            Análisis asistido por IA. Requiere revisión humana.
          </p>
        </div>
      );
    })()}
  </section>
)}
{errorIA && (
  <p role="alert" className="work-help">
    {errorIA}
  </p>
)}
                    <section className="work-section">
                      <h3>Comentarios revisados</h3>
                      {report.comments.length ? (
                        report.comments.map((comment, i) => (
                          <blockquote className="work-comment" key={i}>
                            {comment}
                          </blockquote>
                        ))
                      ) : (
                        <p className="work-help">
                          No hay comentarios publicados para este informe.
                        </p>
                      )}
                    </section>
              <section className="work-section">
              <h3>Retroalimentación de Dirección Académica</h3>
               {admin && report.available && !feedbacks.data?.some(
              (item) =>
                String(item.teacher_id) === String(report.teacher_id) &&
                String(item.period_id) === String(id)
            ) && (
              <form
                className="work-section no-print"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const feedback = new FormData(form).get("feedback");
                  try {
                    await api(`${BASE}/retroalimentacion`, {
                      method: "POST",
                      body: {
                        period_id: Number(id),
                        teacher_id: report.teacher_id,
                        feedback,
                      },
                    });
                    await feedbacks.refresh();
                    form.reset();
                  } catch (error) {
                    alert(error.message || "No se pudo guardar la retroalimentación.");
                  }
                }}
              >
                <h3>Registrar retroalimentación</h3>
                <textarea
                  name="feedback"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  placeholder="Escribe la retroalimentación de Dirección Académica..."
                />
                <div className="work-actions">
                  <button type="submit" className="button button-primary">
                    Guardar retroalimentación
                  </button>
                </div>
              </form>
            )}
              {(() => {
                const feedback = feedbacks.data?.find(
                  (item) =>
                    String(item.teacher_id) === String(report.teacher_id) &&
                    String(item.period_id) === String(id)
                );
                if (feedbacks.loading) {
                  return (
                    <p className="work-help">Cargando retroalimentación...</p>
                  );
                }
                return (
                  <p className="work-help">
                    {feedback?.feedback ||
                      "Pendiente de registrar por Dirección Académica."}
                  </p>
                );
              })()}
            </section>
                  <section className="work-section">
                    <h3>Plan de acción
                    </h3>
                    {admin && (
                  <div className="work-actions no-print">
                    <Link
                      className="button button-secondary"
                      to={`${BASE}/direccion/planes-accion`}
                    >
                      Ir a planes de mejora
                    </Link>
                  </div>
                )}
                    {(() => {
                      const plan = plans.data?.find(
                        (p) =>
                          String(p.teacher_id) === String(report.teacher_id) &&
                          String(p.period_id) === String(id)
                      );
                      if (plans.loading) {
                        return <p className="work-help">Cargando plan de mejora...</p>;
                      }
                      if (!plan) {
                        return (
                          <p className="work-help">
                            No hay un plan de mejora registrado para este docente y período.
                          </p>
                        );
                      }
                      return (
                        <div>
                          <p><strong>Acción de mejora:</strong> {plan.action}</p>
                          <p><strong>Evidencia esperada:</strong> {plan.evidence || "No registrada"}</p>
                          <p><strong>Fecha de cumplimiento:</strong> {new Date(plan.due_date).toLocaleDateString("es-MX", { timeZone: "UTC" })}</p>
                          <p><strong>Estado:</strong> {plan.status}</p>
                        </div>
                      );
                    })()}
                  </section>
                  </>
                ) : (
                  <p className="work-note">{report.reason}</p>
                )}
              </article>
            ))}
          </LoadState>
        )}
      </LoadState>
    </>
  );
}
export function TeacherSubjects() {
  const state = useAsync(() => api(`${BASE}/asignaciones`), []);
  return (
    <>
      <Heading eyebrow="Evaluación docente / Docente" title="Mis asignaturas">
        Asignaturas y grupos incluidos en tus periodos de evaluación. La
        participación individual de estudiantes permanece reservada.
      </Heading>
      <LoadState state={state} empty="No hay asignaturas asignadas">
        <div className="work-records">
          {state.data?.map((a, i) => (
            <article className="work-record" key={`${a.period_id}-${i}`}>
              <div>
                <span className="record-code">
                  {a.period_title} · {a.group_name}
                </span>
                <h2>{a.subject}</h2>
              </div>
              <Link
                className="button button-secondary"
                to={`${BASE}/docente/resultados?periodo=${a.period_id}`}
              >
                Consultar resultados del periodo
              </Link>
            </article>
          ))}
        </div>
      </LoadState>
    </>
  );
}
export function ModerateComments() {
  const periods = useAsync(() => api(`${BASE}/periodos`), []),
    [selection, setSelection] = useState("");
  const id = selection || periods.data?.[0]?.id || "",
    period = periods.data?.find((p) => String(p.id) === String(id));
  const state = useAsync(
    () =>
      id ? api(`${BASE}/comentarios?period_id=${id}`) : Promise.resolve([]),
    [id],
  );
  const [selected, setSelected] = useState(null),
    mutation = useMutation();
  const [teacherFilter, setTeacherFilter] = useState("");
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      await mutation.run(async () => {
        await api(`${BASE}/comentarios/${selected.id}/revision`, {
          method: "POST",
          body: { public_comment: form.get("public_comment") },
        });
        await state.refresh();
      }, "Revisión del comentario guardada.")
    )
      setSelected(null);
  }
  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Revisión previa"
        title="Comentarios para publicación"
        action={
          <Link
            className="button button-secondary"
            to={`${BASE}/direccion/periodos`}
          >
            Volver a periodos
          </Link>
        }
      >
        Retira nombres, contactos y referencias que identifiquen a estudiantes
        antes de publicar los comentarios al docente.
      </Heading>
      {!selected && <MutationState state={mutation} />}
      <LoadState state={periods} empty="No hay periodos registrados">
        <div className="work-toolbar">
          <Field
            label="Periodo"
            as="select"
            value={id}
            onChange={(e) => {
              setTeacherFilter("");
              setSelection(e.target.value);
            }}
          >
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Field>
          <Field
            label="Docente"
            as="select"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          >
            <option value="">Todos los docentes</option>
            {[
              ...new Map(
                (state.data || [])
                  .filter((c) => c.teacher_id)
                  .map((c) => [
                    String(c.teacher_id),
                    c.teacher_name || `Docente ${c.teacher_id}`,
                  ])
              ).entries(),
            ].map(([teacherId, teacherName]) => (
              <option key={teacherId} value={teacherId}>
                {teacherName}
              </option>
            ))}
          </Field>
        </div>
        <LoadState state={state} empty="No hay comentarios en este periodo">
          <div className="work-records">
            {state.data
              ?.filter(
                (c) => !teacherFilter || String(c.teacher_id) === teacherFilter
              )
              .map((c) => (
              <article className="work-record" key={c.id}>
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
                    <strong>
                      {c.teacher_name || "Docente sin nombre registrado"}
                    </strong>
                    <Status value={c.reviewed ? "validado" : "pendiente"}>
                      {c.reviewed ? "Revisado" : "Pendiente de revisión"}
                    </Status>
                  </div>
                  <div style={{ marginBottom: c.reviewed ? 16 : 0 }}>
                    <p className="work-help" style={{ marginBottom: 6 }}>
                      Comentario original
                    </p>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {c.comment}
                    </p>
                  </div>
                  {c.reviewed && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "rgba(127, 127, 127, 0.07)",
                      }}
                    >
                      <p className="work-help" style={{ marginTop: 0, marginBottom: 6 }}>
                        Versión para publicar
                      </p>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {c.public_comment || "Excluido del informe"}
                      </p>
                    </div>
                  )}
                </div>
                {period?.status !== "publicado" && (
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      mutation.clear();
                      setSelected(c);
                    }}
                  >
                    Revisar comentario
                  </button>
                )}
              </article>
            ))}
          </div>
        </LoadState>
      </LoadState>
      {selected && (
        <Modal
          title="Revisar comentario"
          onClose={() => {
            if (!mutation.busy) setSelected(null);
          }}
        >
          <form onSubmit={submit}>
            <MutationState state={mutation} />
            <p className="work-help">Original reservado al área revisora</p>
            <blockquote className="work-comment">{selected.comment}</blockquote>
            <Field
              name="public_comment"
              label="Texto para el informe del docente"
              as="textarea"
              rows={6}
              maxLength={2000}
              defaultValue={
                selected.reviewed ? selected.public_comment : selected.comment
              }
              hint="Retira datos identificables. Deja este campo vacío para excluir el comentario del informe."
            />
            <div className="work-actions">
              <BusyButton
                type="submit"
                busy={mutation.busy}
                className="button button-primary"
              >
                Guardar revisión
              </BusyButton>
              <button
                type="button"
                disabled={mutation.busy}
                className="button button-secondary"
                onClick={() => setSelected(null)}
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
