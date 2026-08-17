import { resolveSchoolId, scopePayload } from "./schoolScope";

/**
 * Normaliza um aluno antes de uma operação de escrita.
 * Usuários comuns nunca podem escolher a escola pelo payload.
 */
export function scopeStudentPayload(student, context) {
  const schoolId = resolveSchoolId({
    selectedSchoolId: student?.escola_id,
    schoolId: context?.schoolId,
    isGlobalAdmin: context?.isGlobalAdmin,
  });

  if (!schoolId) {
    throw new Error("Não foi possível determinar a escola do aluno.");
  }

  return scopePayload(
    {
      ...student,
      escola_id: schoolId,
    },
    {
      schoolId,
      isGlobalAdmin: context?.isGlobalAdmin,
    },
  );
}

/**
 * Aplica o escopo da escola aos registros vindos de CSV/importação.
 * Para usuários comuns, qualquer escola informada no arquivo é ignorada.
 */
export function scopeStudentImportRows(rows, context) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => scopeStudentPayload(row, context));
}

/**
 * Confere se turma e escola escolhidas pertencem ao mesmo contexto.
 */
export function isStudentSchoolSelectionAllowed({
  selectedSchoolId,
  currentSchoolId,
  isGlobalAdmin,
}) {
  if (!selectedSchoolId) return true;
  if (isGlobalAdmin) return true;
  return String(selectedSchoolId) === String(currentSchoolId || "");
}
