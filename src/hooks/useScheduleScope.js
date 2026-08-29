import { useMemo } from 'react';
import { useSchool } from './useSchool';
import {
  resolveScheduleSchoolId,
  isScheduleConfigAllowed,
  scopeSchedulePayload,
} from '../utils/scheduleScope';

export const useScheduleScope = () => {
  const { schoolId, isGlobalAdmin } = useSchool();

  return useMemo(() => ({
    schoolId,
    isGlobalAdmin,
    resolveSchoolId: (selectedSchoolId = '') => resolveScheduleSchoolId({
      schoolId,
      selectedSchoolId,
      isGlobalAdmin,
    }),
    canAccessConfig: (config) => isScheduleConfigAllowed(config, {
      schoolId,
      isGlobalAdmin,
    }),
    scopePayload: (payload, selectedSchoolId = '') => scopeSchedulePayload(payload, {
      schoolId,
      selectedSchoolId,
      isGlobalAdmin,
    }),
  }), [schoolId, isGlobalAdmin]);
};
