/**
 * Regras centrais para o contexto multi-escola no frontend.
 *
 * Usuários comuns trabalham exclusivamente na escola vinculada à conta.
 * Contas globais podem selecionar uma escola explicitamente quando a tela
 * oferecer operação multi-escola.
 */
export function resolveSchoolId({ selectedSchoolId, schoolId, isGlobalAdmin }) {
  if (isGlobalAdmin) {
    return selectedSchoolId || null;
  }

  return schoolId || null;
}

export function canSelectSchool(isGlobalAdmin) {
  return Boolean(isGlobalAdmin);
}

export function isSchoolSelectionAllowed({ selectedSchoolId, schoolId, isGlobalAdmin }) {
  if (!selectedSchoolId) return true;
  if (isGlobalAdmin) return true;
  return String(selectedSchoolId) === String(schoolId || "");
}

export function scopePayload(payload, { schoolId, isGlobalAdmin }) {
  if (isGlobalAdmin) return payload;

  return {
    ...payload,
    escola_id: schoolId,
  };
}
