const normalizeId = (value) => (value === null || value === undefined ? '' : String(value));

export const resolveScheduleSchoolId = ({ userSchoolId, requestedSchoolId, isGlobalAdmin = false } = {}) => {
  const userId = normalizeId(userSchoolId);
  const requestedId = normalizeId(requestedSchoolId);

  if (isGlobalAdmin) return requestedId || userId;
  return userId;
};

export const scopeScheduleConfig = (config, context = {}) => {
  const escolaId = resolveScheduleSchoolId(context);
  if (!escolaId) return { ...config, escola_id: '' };
  return { ...config, escola_id: escolaId };
};

export const canAccessScheduleConfig = (config, context = {}) => {
  const escolaId = normalizeId(config?.escola_id);
  const scopedId = resolveScheduleSchoolId(context);
  return Boolean(escolaId && scopedId && escolaId === scopedId);
};

export const filterScheduleConfigs = (configs, context = {}) => {
  const scopedId = resolveScheduleSchoolId(context);
  if (!scopedId) return [];
  return (Array.isArray(configs) ? configs : []).filter(
    (config) => normalizeId(config?.escola_id) === scopedId,
  );
};
