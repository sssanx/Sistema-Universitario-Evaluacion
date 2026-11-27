import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { useAuth } from "../../app/Auth";
import RoleRoute from "../../app/RoleRoute";
const Layout = lazy(() => import("./Layout"));
const Students = lazy(() =>
  import("./Student").then((m) => ({ default: m.StudentAssignments })),
);  
const Answer = lazy(() =>
  import("./Student").then((m) => ({ default: m.AnswerEvaluation })),
);
const Periods = lazy(() =>
  import("./Manage").then((m) => ({ default: m.Periods })),
);
const Questionnaires = lazy(() =>
  import("./Manage").then((m) => ({ default: m.Questionnaires })),
);  
const Assignments = lazy(() =>
  import("./Manage").then((m) => ({ default: m.ManageAssignments })),
);  

const AcademicGroups = lazy(() =>
  import("./AcademicGroups").then((m) => ({ default: m.AcademicGroups })),
);

const People = lazy(() =>
  import("./Manage").then((m) => ({ default: m.People })),
);  
const Results = lazy(() =>
  import("./Reports").then((m) => ({ default: m.Results })),
);  
const Comments = lazy(() =>
  import("./Reports").then((m) => ({ default: m.ModerateComments })),
);  
const Subjects = lazy(() =>
  import("./Reports").then((m) => ({ default: m.TeacherSubjects })),
);
const Plans = lazy(() => import("./Plans"));
const allowed = (roles, children) => (
  <RoleRoute roles={roles}>{children}</RoleRoute>
);
const admin = (children) => allowed(["administrador"], children);
const teacher = (children) => allowed(["docente"], children);
function Entry() {
  const { user } = useAuth();
  return user.role === "estudiante" ? (
    <Students />
  ) : user.role === "docente" ? (
    <Results />
  ) : (
    <Periods />
  );
}
export const evaluationRoutes = (
  <Route
    path="evaluacion-docente"
    element={allowed(["estudiante", "docente", "administrador"], <Layout />)}
  >
    <Route index element={<Entry />} />
    <Route path="estudiante" element={allowed(["estudiante"], <Students />)} />
    <Route
      path="estudiante/mis-evaluaciones"
      element={allowed(["estudiante"], <Students />)}
    />
    <Route
      path="estudiante/evaluar/:id"
      element={allowed(["estudiante"], <Answer />)}
    />
    <Route
      path="estudiante/perfil"
      element={<Navigate to="/cuenta" replace />}
    />
    <Route path="docente" element={teacher(<Results />)} />
    {["resultados", "comentarios", "reporte"].map((path) => (
      <Route
        key={path}
        path={`docente/${path}`}
        element={teacher(<Results />)}
      />
    ))}
    <Route path="docente/asignaturas" element={teacher(<Subjects />)} />
    <Route path="docente/planes" element={teacher(<Plans />)} />
    <Route path="docente/perfil" element={<Navigate to="/cuenta" replace />} />
    <Route path="docente/ayuda" element={<Navigate to="/ayuda" replace />} />
    <Route path="direccion" element={admin(<Periods />)} />
    <Route path="direccion/periodos" element={admin(<Periods />)} />
    <Route path="direccion/cuestionarios" element={admin(<Questionnaires />)} />
    <Route path="direccion/grupos" element={admin(<Assignments />)} />
    <Route
  path="direccion/grupos-academicos"
  element={admin(<AcademicGroups />)}
/>
    <Route
      path="direccion/docentes"
      element={admin(<People role="docente" />)}
    />
    <Route
      path="direccion/estudiantes"
      element={admin(<People role="estudiante" />)}
    />
    <Route path="direccion/comentarios" element={admin(<Comments />)} />
    {["resultados", "reportes"].map((path) => (
      <Route
        key={path}
        path={`direccion/${path}`}
        element={admin(<Results />)}
      />
    ))}
    <Route path="direccion/planes-accion" element={admin(<Plans />)} />
  </Route>
);
