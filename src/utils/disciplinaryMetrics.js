// Consolida os registros usados em indicadores, gráficos e rankings.
// Quando uma suspensão é gerada a partir de uma ocorrência, a ocorrência
// de origem e a suspensão representam o mesmo evento disciplinar para fins
// de métricas. Mantemos a suspensão e removemos somente a ocorrência que
// está explicitamente referenciada por ocorrencia_origem_id.
export const consolidarOcorrencias = (ocorrencias = []) => {
  const lista = Array.isArray(ocorrencias) ? ocorrencias : [];

  const idsDeOrigens = new Set(
    lista
      .filter((item) => item?.categoria === "suspensao" && item?.ocorrencia_origem_id)
      .map((item) => String(item.ocorrencia_origem_id)),
  );

  if (idsDeOrigens.size === 0) return lista;

  return lista.filter((item) => !idsDeOrigens.has(String(item?.id)));
};
