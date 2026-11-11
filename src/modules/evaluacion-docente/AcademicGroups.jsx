import { useState } from "react";
import { api } from "../../shared/api";
import { Field, Modal, BusyButton, useAsync } from "../../shared/ui";
import { Heading, LoadState, MutationState, useMutation } from "../../shared/Work";

const BASE = "/evaluacion-docente";

function GenerateEvaluationsModal({ group, onClose, mutation }) {
  const subjects = useAsync(() => api(`${BASE}/grupos/${group.id}/materias`), [group.id]);
  const periods = useAsync(() => api(`${BASE}/periodos`), []);
  const drafts = (periods.data || []).filter((period) => period.status === "borrador");

  async function generate(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => api(`${BASE}/asignaciones/grupo`, {
      method: "POST",
      body: {
        period_id: Number(form.get("period_id")),
        group_id: group.id,
        group_subject_id: Number(form.get("group_subject_id")),
      },
    }), "Evaluaciones del grupo generadas correctamente.");
    if (saved) onClose();
  }

  return (
    <Modal title={`Generar evaluaciones para ${group.name}`} onClose={() => { if (!mutation.busy) onClose(); }}>
      <LoadState state={periods} empty="No hay períodos de evaluación disponibles">
        <LoadState state={subjects} empty="Este grupo todavía no tiene materias asignadas">
          <form onSubmit={generate}>
            <MutationState state={mutation} />
            <p className="work-help">Se creará una asignación por estudiante inscrito en el grupo para la materia seleccionada. Las asignaciones existentes no se duplicarán.</p>
            {!drafts.length && <p className="work-note">Necesitas preparar un período en borrador antes de generar evaluaciones.</p>}
            <Field name="period_id" label="Período en preparación" as="select" required defaultValue="">
              <option value="" disabled>Selecciona un período</option>
              {drafts.map((period) => <option key={period.id} value={period.id}>{period.title}</option>)}
            </Field>
            <Field name="group_subject_id" label="Materia y docente" as="select" required defaultValue="">
              <option value="" disabled>Selecciona una materia</option>
              {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.teacher_name}</option>)}
            </Field>
            <div className="work-actions">
              <BusyButton type="submit" className="button button-primary" busy={mutation.busy} disabled={!drafts.length || !subjects.data?.length}>Generar evaluaciones</BusyButton>
              <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={onClose}>Cancelar</button>
            </div>
          </form>
        </LoadState>
      </LoadState>
    </Modal>
  );
}

function GroupSubjectsList({ group }) {
  const subjects = useAsync(() => api(`${BASE}/grupos/${group.id}/materias`), [group.id]);
  return (
    <section>
      <h3>Materias y docentes asignados</h3>
      <LoadState state={subjects} empty="Este grupo todavía no tiene materias asignadas">
        <div className="work-records">
          {subjects.data?.map((item) => (
            <article className="work-record" key={item.id}>
              <div><h4>{item.subject}</h4><p className="work-help">Docente: {item.teacher_name}</p></div>
            </article>
          ))}
        </div>
      </LoadState>
    </section>
  );
}

function GroupStudentsList({ group }) {
  const students = useAsync(() => api(`${BASE}/grupos/${group.id}/estudiantes`), [group.id]);
  return (
    <section>
      <details>
        <summary style={{ cursor: "pointer", padding: "12px 0", fontWeight: 600 }}>
          Estudiantes inscritos ({students.data?.length ?? 0})
        </summary>
        <div style={{ marginTop: 12 }}>
          <LoadState state={students} empty="Este grupo todavía no tiene estudiantes inscritos">
            <div className="work-records">
              {students.data?.map((student) => (
                <article className="work-record" key={student.id}>
                  <div style={{ minWidth: 0 }}>
                    <h4>{student.name}</h4>
                    <p className="work-help" style={{ overflowWrap: "anywhere" }}>{student.email}</p>
                  </div>
                </article>
              ))}
            </div>
          </LoadState>
        </div>
      </details>
    </section>
  );
}

function ImportRows({ records = [] }) {
  if (!records.length) return null;
  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver detalle por fila ({records.length})</summary>
      <div className="work-records" style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
        {records.map((record, index) => (
          <article className="work-record" key={`${record.fila}-${index}`}>
            <div style={{ minWidth: 0 }}>
              <h4>Fila {record.fila} · {record.nombre || record.matricula || "Sin matrícula"}</h4>
              <p className="work-help" style={{ overflowWrap: "anywhere" }}>{record.correo || "Sin correo"}</p>
              <p className="work-help">{record.estado === "nuevo" ? "Nuevo" : record.estado === "duplicado" ? "Duplicado" : "Error"}: {record.motivo}</p>
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

function downloadImportErrors(records) {
  const invalid = (records || []).filter((r) => r.estado === "error");
  if (!invalid.length) return;
  const safe = (value) => {
    const text = String(value ?? "");
    const guarded = /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const lines = ["fila,matricula,correo,motivo", ...invalid.map((r) => [r.fila, r.matricula, r.correo, r.motivo].map(safe).join(","))];
  const url = URL.createObjectURL(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "errores-importacion-estudiantes.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AcademicGroups() {
  const groups = useAsync(() => api(`${BASE}/grupos`), []);
  const people = useAsync(() => api(`${BASE}/personas`), []);
  const mutation = useMutation();
  const [dialog, setDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [subjectGroup, setSubjectGroup] = useState(null);
  const [generationGroup, setGenerationGroup] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [careerFilter, setCareerFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [enrollmentMode, setEnrollmentMode] = useState("individual");
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState("");
  const [excelResult, setExcelResult] = useState(null);
  const [enrollmentRefresh, setEnrollmentRefresh] = useState(0);

  const students = (people.data || []).filter((person) => person.role === "estudiante");
  const careers = [...new Set(students.map((student) => student.carrera).filter(Boolean))].sort();
  const terms = [...new Set(students.map((student) => String(student.cuatrimestre || "")).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const filteredStudents = students.filter((student) => {
    const search = studentSearch.trim().toLowerCase();
    const matchesSearch = !search || [student.name, student.email, student.matricula]
      .some((value) => String(value || "").toLowerCase().includes(search));
    return matchesSearch && (!careerFilter || student.carrera === careerFilter)
      && (!levelFilter || student.nivel_academico === levelFilter)
      && (!termFilter || String(student.cuatrimestre || "") === termFilter);
  });

  function openGroup(group) {
    mutation.clear();
    setSelectedGroup(group);
    setEnrollmentMode("individual");
    setStudentSearch("");
    setCareerFilter("");
    setLevelFilter("");
    setTermFilter("");
    setExcelFile(null);
    setExcelPreview(null);
    setExcelResult(null);
    setExcelError("");
  }

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos`, {
        method: "POST",
        body: { name: form.get("name"), career: form.get("career"), academic_term: form.get("academic_term") },
      });
      await groups.refresh();
    }, "Grupo académico registrado correctamente.");
    if (saved) setDialog(false);
  }

  async function enrollStudent(e) {
    e.preventDefault();
    if (!selectedGroup) return;
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos/${selectedGroup.id}/estudiantes`, {
        method: "POST", body: { student_id: form.get("student_id") },
      });
    }, "Estudiante inscrito correctamente.");
    if (saved) {
      setEnrollmentRefresh((value) => value + 1);
      formElement.reset();
    }
  }

  async function assignSubject(e) {
    e.preventDefault();
    if (!subjectGroup) return;
    const form = new FormData(e.currentTarget);
    const saved = await mutation.run(async () => {
      await api(`${BASE}/grupos/${subjectGroup.id}/materias`, {
        method: "POST", body: { teacher_id: form.get("teacher_id"), subject: form.get("subject") },
      });
    }, "Materia y docente asignados correctamente.");
    if (saved) setSubjectGroup(null);
  }

  async function previewExcel(e) {
    e.preventDefault();
    if (!selectedGroup || !excelFile || excelBusy) return;
    setExcelBusy(true);
    setExcelError("");
    setExcelPreview(null);
    setExcelResult(null);
    try {
      const form = new FormData();
      form.append("file", excelFile);
      const result = await api(`${BASE}/grupos/${selectedGroup.id}/estudiantes/importar/vista-previa`, {
        method: "POST", body: form,
      });
      setExcelPreview(result);
    } catch (error) {
      setExcelError(error.message || "No se pudo analizar el archivo.");
    } finally {
      setExcelBusy(false);
    }
  }

  async function confirmExcel() {
    if (!selectedGroup || !excelFile || !excelPreview || excelBusy) return;
    setExcelBusy(true);
    setExcelError("");
    try {
      const form = new FormData();
      form.append("file", excelFile);
      const result = await api(`${BASE}/grupos/${selectedGroup.id}/estudiantes/importar/confirmar`, {
        method: "POST", body: form,
      });
      setExcelResult(result);
      setExcelPreview(null);
      setEnrollmentRefresh((value) => value + 1);
    } catch (error) {
      setExcelError(error.message || "No se pudo confirmar la importación.");
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="Evaluación docente / Dirección académica"
        title="Grupos académicos"
        action={<button className="button button-primary" onClick={() => { mutation.clear(); setDialog(true); }}>Registrar grupo</button>}
      >
        Administra los grupos académicos utilizados para organizar las evaluaciones docentes.
      </Heading>
      {!dialog && !selectedGroup && !subjectGroup && !generationGroup && <MutationState state={mutation} />}
      <LoadState state={groups} empty="Todavía no hay grupos académicos registrados">
        <div className="work-records">
          {groups.data?.map((group) => (
            <article className="work-record" key={group.id}>
              <div>
                <span className="record-code">Grupo {group.id}</span>
                <h2>{group.name}</h2>
                <dl className="work-meta">
                  <div><dt>Carrera</dt><dd>{group.career}</dd></div>
                  <div><dt>Período académico</dt><dd>{group.academic_term}</dd></div>
                </dl>
              </div>
              <div className="work-actions">
                <button type="button" className="button button-secondary" onClick={() => openGroup(group)}>Administrar estudiantes</button>
                <button type="button" className="button button-secondary" onClick={() => { mutation.clear(); setSubjectGroup(group); }}>Asignar materia y docente</button>
                <button type="button" className="button button-primary" onClick={() => { mutation.clear(); setGenerationGroup(group); }}>Generar evaluaciones</button>
              </div>
            </article>
          ))}
        </div>
      </LoadState>

      {selectedGroup && (
        <Modal title={`Administrar estudiantes en ${selectedGroup.name}`} onClose={() => { if (!mutation.busy && !excelBusy) setSelectedGroup(null); }}>
          <GroupStudentsList key={`${selectedGroup.id}-${enrollmentRefresh}`} group={selectedGroup} />
          <div className="work-actions" style={{ marginBottom: 16, marginTop: 12 }}>
            <button type="button" className={`button ${enrollmentMode === "individual" ? "button-primary" : "button-secondary"}`} disabled={excelBusy} onClick={() => setEnrollmentMode("individual")}>Inscripción individual</button>
            <button type="button" className={`button ${enrollmentMode === "excel" ? "button-primary" : "button-secondary"}`} disabled={excelBusy} onClick={() => setEnrollmentMode("excel")}>Importar Excel</button>
          </div>

          {enrollmentMode === "individual" && (
            <LoadState state={people} empty="No hay cuentas disponibles">
              <form onSubmit={enrollStudent}>
                <MutationState state={mutation} />
                <Field label="Buscar estudiante" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Nombre, matrícula o correo" />
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: "pointer", padding: "8px 0", fontWeight: 600 }}>Filtros avanzados</summary>
                  <div className="work-fields" style={{ marginTop: 10 }}>
                    <Field label="Carrera" as="select" value={careerFilter} onChange={(e) => setCareerFilter(e.target.value)}>
                      <option value="">Todas las carreras</option>
                      {careers.map((career) => <option key={career} value={career}>{career}</option>)}
                    </Field>
                    <Field label="Nivel académico" as="select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                      <option value="">Todos los niveles</option>
                      <option value="TSU">TSU</option>
                      <option value="Ingeniería">Ingeniería</option>
                    </Field>
                    <Field label="Cuatrimestre" as="select" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                      <option value="">Todos los cuatrimestres</option>
                      {terms.map((term) => <option key={term} value={term}>{term}</option>)}
                    </Field>
                    <button type="button" className="button button-secondary" onClick={() => { setStudentSearch(""); setCareerFilter(""); setLevelFilter(""); setTermFilter(""); }}>Limpiar filtros</button>
                  </div>
                </details>
                <Field name="student_id" label={`Estudiante (${filteredStudents.length} encontrados)`} as="select" required defaultValue="" key={`${studentSearch}-${careerFilter}-${levelFilter}-${termFilter}`}>
                  <option value="" disabled>Selecciona un estudiante</option>
                  {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.email}</option>)}
                </Field>
                <div className="work-actions">
                  <BusyButton type="submit" className="button button-primary" busy={mutation.busy} disabled={!filteredStudents.length}>Inscribir estudiante</BusyButton>
                  <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setSelectedGroup(null)}>Cancelar</button>
                </div>
              </form>
            </LoadState>
          )}

          {enrollmentMode === "excel" && (
            <form onSubmit={previewExcel}>
              <h3>Importación masiva de estudiantes</h3>
              <p className="work-help">Sube un archivo .xlsx con las columnas <strong>matricula</strong> y <strong>correo</strong>. Máximo 2 MB y 1,000 filas. Solo se inscriben cuentas de estudiantes existentes.</p>
              <div className="work-fields">
                <label>
                  Archivo Excel (.xlsx)
                  <input type="file" accept=".xlsx" required disabled={excelBusy} onChange={(e) => { setExcelFile(e.target.files?.[0] || null); setExcelPreview(null); setExcelResult(null); setExcelError(""); }} />
                </label>
              </div>
              {excelError && <p className="work-note" role="alert">{excelError}</p>}
              {excelPreview && (
                <div className="work-record">
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <h3>Vista previa</h3>
                    <p>Registros: {excelPreview.total} · Nuevos: {excelPreview.nuevos} · Duplicados: {excelPreview.duplicados} · Errores: {excelPreview.errores}</p>
                    <ImportRows records={excelPreview.registros} />
                    <div className="work-actions" style={{ marginTop: 12 }}>
                      <button type="button" className="button button-primary" disabled={excelBusy || !excelPreview.nuevos} onClick={confirmExcel}>{excelBusy ? "Procesando..." : `Confirmar ${excelPreview.nuevos} inscripciones`}</button>
                      {excelPreview.errores > 0 && <button type="button" className="button button-secondary" onClick={() => downloadImportErrors(excelPreview.registros)}>Descargar errores (.csv)</button>}
                    </div>
                  </div>
                </div>
              )}
              {excelResult && (
                <div className="work-record" role="status">
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <h3>Importación finalizada</h3>
                    <p>Inscritos: {excelResult.inscritos} · Duplicados: {excelResult.duplicados} · Errores: {excelResult.errores}</p>
                    <ImportRows records={excelResult.registros} />
                    {excelResult.errores > 0 && <div className="work-actions"><button type="button" className="button button-secondary" onClick={() => downloadImportErrors(excelResult.registros)}>Descargar errores (.csv)</button></div>}
                  </div>
                </div>
              )}
              <div className="work-actions">
                <button type="submit" className="button button-secondary" disabled={!excelFile || excelBusy}>{excelBusy ? "Analizando..." : "Analizar Excel"}</button>
                <button type="button" className="button button-secondary" disabled={excelBusy} onClick={() => setSelectedGroup(null)}>Cerrar</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {subjectGroup && (
        <Modal title={`Asignar materia y docente a ${subjectGroup.name}`} onClose={() => { if (!mutation.busy) setSubjectGroup(null); }}>
          <GroupSubjectsList group={subjectGroup} />
          <LoadState state={people} empty="No hay cuentas disponibles">
            <form onSubmit={assignSubject}>
              <MutationState state={mutation} />
              <Field name="teacher_id" label="Docente" as="select" required defaultValue="">
                <option value="" disabled>Selecciona un docente</option>
                {people.data?.filter((person) => person.role === "docente").map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.email}</option>)}
              </Field>
              <Field name="subject" label="Asignatura" required minLength={3} maxLength={150} />
              <div className="work-actions">
                <BusyButton type="submit" className="button button-primary" busy={mutation.busy}>Guardar asignación</BusyButton>
                <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setSubjectGroup(null)}>Cancelar</button>
              </div>
            </form>
          </LoadState>
        </Modal>
      )}

      {generationGroup && <GenerateEvaluationsModal key={generationGroup.id} group={generationGroup} mutation={mutation} onClose={() => setGenerationGroup(null)} />}

      {dialog && (
        <Modal title="Registrar grupo académico" onClose={() => { if (!mutation.busy) setDialog(false); }}>
          <form onSubmit={submit}>
            <MutationState state={mutation} />
            <Field name="name" label="Nombre del grupo" required minLength={2} maxLength={80} />
            <Field name="career" label="Carrera" required minLength={3} maxLength={150} />
            <Field name="academic_term" label="Período académico" required minLength={3} maxLength={50} />
            <div className="work-actions">
              <BusyButton type="submit" className="button button-primary" busy={mutation.busy}>Guardar grupo</BusyButton>
              <button type="button" className="button button-secondary" disabled={mutation.busy} onClick={() => setDialog(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
