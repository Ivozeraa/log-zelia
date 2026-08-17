import { resolveSchoolId, canSelectSchool, scopePayload } from './schoolScope';

/**
 * Normaliza operações da tela de gestão para o contexto multi-escola.
 * Usuários comuns nunca recebem uma escola arbitrária; contas globais
 * podem operar explicitamente sobre a escola selecionada.
 */
export const resolveManagementSchoolId = ({
  selectedSchoolId,
  schoolId,
  isGlobalAdmin,
}) => resolveSchoolId({ selectedSchoolId, schoolId, isGlobalAdmin });

export const canManageMultipleSchools = (isGlobalAdmin) =>
  canSelectSchool(isGlobalAdmin);

export const scopeUserPayload = (payload, { schoolId, isGlobalAdmin }) =>
  scopePayload(payload, { schoolId, isGlobalAdmin });

export const scopeClassPayload = (payload, { schoolId, isGlobalAdmin }) =>
  scopePayload(payload, { schoolId, isGlobalAdmin });

export const isSchoolInScope = ({
  entitySchoolId,
  selectedSchoolId,
  schoolId,
  isGlobalAdmin,
}) => {
  const targetSchoolId = resolveManagementSchoolId({
    selectedSchoolId,
    schoolId,
    isGlobalAdmin,
  });

  if (!targetSchoolId) return Boolean(isGlobalAdmin);
  return String(entitySchoolId || '') === String(targetSchoolId);
};
