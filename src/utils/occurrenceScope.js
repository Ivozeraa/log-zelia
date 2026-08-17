/**
 * Regras de escopo para operações de ocorrências.
 *
 * Usuários vinculados a uma escola nunca podem enviar uma escola diferente
 * da escola da própria sessão. Contas globais podem operar sobre a escola
 * explicitamente selecionada pela interface.
 */
export function resolveOccurrenceSchoolId({ selectedSchoolId, schoolId, isGlobalAdmin }) {
  if (isGlobalAdmin) {
    return selectedSchoolId || null;
  }

  return schoolId || null;
}

export function scopeOccurrencePayload(payload, { schoolId, isGlobalAdmin }) {
  if (isGlobalAdmin) return { ...payload };

  return {
    ...payload,
    escola_id: schoolId,
  };
}

export function canAccessOccurrenceSchool({ occurrenceSchoolId, schoolId, isGlobalAdmin }) {
  if (!occurrenceSchoolId) return false;
  if (isGlobalAdmin) return true;
  return String(occurrenceSchoolId) === String(schoolId || "");
}

export function buildOccurrenceSchoolFilter(query, { schoolId, isGlobalAdmin, selectedSchoolId }) {
  const resolvedSchoolId = resolveOccurrenceSchoolId({
    selectedSchoolId,
    schoolId,
    isGlobalAdmin,
  });

  if (resolvedSchoolId) {
    return query.eq("escola_id", resolvedSchoolId);
  }

  return query;
}
