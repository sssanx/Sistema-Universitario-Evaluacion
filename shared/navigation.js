// Registro único del portal. La API comprueba los permisos independientemente.
export const MODULES = [
  {
    id: "titulacion",
    path: "/titulacion",
    name: "Titulación electrónica",
    shortName: "Titulación",
    area: "Servicios Escolares",
    description:
      "Expediente, revisión de documentos y seguimiento del trámite.",
    entityName: "Expediente",
    roles: [
      "estudiante",
      "escolares",
      "administrador",
      "tesoreria",
      "vinculacion",
    ],
    pages: {
      perfil: "Datos del egresado",
      documentos: "Documentos",
      seguimiento: "Historial",
    },
    actions: {
      estudiante: "Abrir mi expediente",
      default: "Abrir solicitudes",
    },
  },
  {
    id: "becas",
    path: "/becas",
    name: "Gestión de becas",
    shortName: "Becas",
    area: "Becas y apoyos",
    description: "Convocatorias, solicitudes y seguimiento de apoyos.",
    entityName: "Solicitud",
    roles: [
      "estudiante",
      "escolares",
      "administrador",
      "evaluador",
      "auditor",
      "tesoreria",
    ],
    pages: {
      solicitudes: "Mis solicitudes",
      socioeconomico: "Estudio socioeconómico",
      renovacion: "Renovaciones",
      "admin-convocatorias": "Administrar convocatorias",
      dictamen: "Revisar solicitudes",
      "ordenes-cobro": "Órdenes de cobro",
      dashboard: "Actividad de becas",
    },
    actions: {
      estudiante: "Consultar convocatorias",
      auditor: "Consultar actividad",
      tesoreria: "Consultar órdenes",
      default: "Gestionar becas",
    },
  },
  {
    id: "evaluacion-docente",
    path: "/evaluacion-docente",
    name: "Evaluación docente",
    shortName: "Evaluación",
    area: "Área académica",
    description: "Evaluaciones de asignaturas, resultados y planes de mejora.",
    roles: ["estudiante", "docente", "administrador"],
    pages: {
      estudiante: "Mis evaluaciones",
      "estudiante/mis-evaluaciones": "Mis evaluaciones",
      "estudiante/perfil": "Mi cuenta",
      docente: "Mis resultados",
      "docente/resultados": "Mis resultados",
      "docente/comentarios": "Comentarios revisados",
      "docente/reporte": "Informe de resultados",
      "docente/perfil": "Mi cuenta",
      "docente/ayuda": "Ayuda",
      "docente/asignaturas": "Mis asignaturas",
      "docente/planes": "Mi plan de mejora",
      direccion: "Periodos de evaluación",
      "direccion/periodos": "Periodos de evaluación",
      "direccion/cuestionarios": "Cuestionarios",
      "direccion/grupos": "Asignaciones",
      "direccion/docentes": "Docentes",
      "direccion/estudiantes": "Estudiantes",
      "direccion/comentarios": "Revisar comentarios",
      "direccion/resultados": "Resultados por periodo",
      "direccion/reportes": "Informes",
      "direccion/planes-accion": "Planes de mejora",
    },
    actions: {
      estudiante: "Abrir mis evaluaciones",
      docente: "Consultar mis resultados",
      administrador: "Preparar evaluación",
    },
  },
];

export function moduleLinks(module, role) {
  if (!MODULES.find((m) => m.id === module)?.roles.includes(role)) return [];
  if (module === "becas") {
    if (role === "estudiante")
      return [
        ["/becas", "Convocatorias"],
        ["/becas/solicitudes", "Mis solicitudes"],
        ["/becas/socioeconomico", "Estudio socioeconómico"],
        ["/becas/renovacion", "Renovaciones"],
        ["/becas/ordenes-cobro", "Órdenes de cobro"],
      ];
    if (role === "tesoreria")
      return [["/becas/ordenes-cobro", "Órdenes de cobro"]];
    if (role === "auditor")
      return [
        ["/becas/dashboard", "Actividad"],
        ["/becas/ordenes-cobro", "Órdenes de cobro"],
      ];
    return [
      ["/becas", "Catálogo"],
      ["/becas/dictamen", "Solicitudes"],
      ["/becas/admin-convocatorias", "Administrar convocatorias"],
      ["/becas/renovacion", "Renovaciones"],
      ["/becas/ordenes-cobro", "Órdenes de cobro"],
      ["/becas/dashboard", "Actividad"],
    ];
  }
  if (module === "evaluacion-docente") {
    if (role === "estudiante")
      return [["/evaluacion-docente", "Mis evaluaciones"]];
    if (role === "docente")
      return [
        ["/evaluacion-docente/docente/resultados", "Resultados"],
        ["/evaluacion-docente/docente/asignaturas", "Asignaturas"],
        ["/evaluacion-docente/docente/planes", "Plan de mejora"],
      ];
return [
  ["/evaluacion-docente/direccion/periodos", "Periodos"],
  ["/evaluacion-docente/direccion/cuestionarios", "Cuestionarios"],
  ["/evaluacion-docente/direccion/docentes", "Docentes"],
  ["/evaluacion-docente/direccion/estudiantes", "Estudiantes"],
  ["/evaluacion-docente/direccion/grupos-academicos", "Grupos académicos"],
  ["/evaluacion-docente/direccion/grupos", "Asignaciones"],
  ["/evaluacion-docente/direccion/comentarios", "Comentarios"],
  ["/evaluacion-docente/direccion/resultados", "Resultados"],
  ["/evaluacion-docente/direccion/planes-accion", "Planes de mejora"],
];
  }
  return [
    ["/titulacion", role === "estudiante" ? "Mi expediente" : "Solicitudes"],
  ];
}

export function homeShortcuts(role) {
  const shortcuts = [];
  if (MODULES[0].roles.includes(role))
    shortcuts.push({
      path: "/titulacion",
      label:
        role === "estudiante"
          ? "Mi solicitud de titulación"
          : "Solicitudes de titulación",
    });
  if (role === "estudiante")
    shortcuts.push(
      { path: "/becas/solicitudes", label: "Mis solicitudes de beca" },
      { path: "/evaluacion-docente", label: "Mis evaluaciones" },
    );
  else if (["escolares", "administrador", "evaluador"].includes(role))
    shortcuts.push({
      path: "/becas/dictamen",
      label: "Revisar solicitudes de beca",
    });
  if (role === "auditor")
    shortcuts.push({ path: "/becas/dashboard", label: "Actividad de becas" });
  if (role === "tesoreria")
    shortcuts.push({
      path: "/becas/ordenes-cobro",
      label: "Órdenes de cobro de becas",
    });
  if (role === "docente")
    shortcuts.push(
      {
        path: "/evaluacion-docente/docente/resultados",
        label: "Mis resultados",
      },
      {
        path: "/evaluacion-docente/docente/planes",
        label: "Mi plan de mejora",
      },
    );
  if (role === "administrador")
    shortcuts.push({
      path: "/evaluacion-docente/direccion/periodos",
      label: "Preparar evaluación docente",
    });
  return [...shortcuts, { path: "/notificaciones", label: "Notificaciones" }];
}

export function breadcrumbsFor(pathname, authenticated, entityLabel) {
  const path = pathname.replace(/\/$/, "") || "/";
  const root = authenticated
    ? { label: "Inicio", path: "/" }
    : { label: "Acceso", path: "/acceso" };
  if (path === "/") return [{ label: "Inicio" }];
  if (path === "/acceso") return [{ label: "Acceso" }];
  const pages = {
    "/recuperar": "Recuperar acceso",
    "/ayuda": "Ayuda",
    "/privacidad": "Privacidad",
    "/notificaciones": "Notificaciones",
    "/cuenta": "Mi cuenta",
  };
  if (pages[path]) return [root, { label: pages[path] }];
  const module = MODULES.find(
    (m) => path === m.path || path.startsWith(`${m.path}/`),
  );
  const unknown = [root, { label: "Página no encontrada" }];
  if (!module) return unknown;
  if (path === module.path) return [root, { label: module.name }];
  const sub = path.slice(module.path.length + 1);
  if (
    module.id === "evaluacion-docente" &&
    /^estudiante\/evaluar\/\d+$/.test(sub)
  )
    return [
      root,
      { label: module.name, path: module.path },
      { label: "Responder evaluación" },
    ];
  const leaf = module.pages?.[sub];
  const isEntity = /^(?:expediente|solicitud)\/\d+$/.test(sub);
  if (!leaf && !isEntity) return unknown;
  return [
    root,
    { label: module.name, path: module.path },
    { label: leaf || entityLabel || module.entityName || "Detalle" },
  ];
}

export function pageTitleFor(pathname, authenticated, role) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/titulacion")
    return `${role === "estudiante" ? "Mi expediente" : "Solicitudes"} · Titulación · UT de Oriental`;
  if (path === "/becas")
    return `${role === "estudiante" ? "Convocatorias" : "Gestión de becas"} · Becas · UT de Oriental`;
  if (path === "/evaluacion-docente")
    return `${role === "estudiante" ? "Mis evaluaciones" : role === "docente" ? "Mis resultados" : "Periodos de evaluación"} · Evaluación docente · UT de Oriental`;
  return `${
    breadcrumbsFor(path, authenticated)
      .slice(authenticated ? 1 : 0)
      .map((item) => item.label)
      .join(" · ") || "Inicio"
  } · UT de Oriental`;
}

export function notificationDestination(notification, role) {
  const target =
    notification.target_path ||
    (notification.application_id
      ? `/titulacion/expediente/${notification.application_id}`
      : "");
  const module = MODULES.find(
    (m) => target === m.path || target.startsWith(`${m.path}/`),
  );
  if (!module?.roles.includes(role)) return null;
  if (
    /^\/becas\/(?:solicitud\/|renovacion)/.test(target) &&
    !["estudiante", "escolares", "administrador", "evaluador"].includes(role)
  )
    return null;
  if (module.id === "evaluacion-docente" && role !== "docente") return null;
  // Solo rutas internas conocidas; nunca URLs externas, fragmentos ni protocolos.
  if (
    !/^\/(?:titulacion\/expediente\/\d+|becas\/(?:solicitud\/\d+|renovacion|ordenes-cobro)|evaluacion-docente\/docente\/resultados\?periodo=\d+)$/.test(
      target,
    )
  )
    return null;
  return {
    path: target,
    label:
      module.id === "evaluacion-docente"
        ? "Consultar resultados"
        : module.id === "becas"
          ? "Consultar en Becas"
          : "Consultar expediente",
  };
}
