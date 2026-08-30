const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'src', 'pages', 'Occurrences.jsx');
let text = fs.readFileSync(file, 'utf8');

const oldCount = `const contarSuspensoes = (ocorrenciasDoAluno) => {
  if (!ocorrenciasDoAluno || ocorrenciasDoAluno.length === 0) return 0;
  const suspensoesDiretas = ocorrenciasDoAluno.filter(
    (item) => item.categoria === "suspensao",
  ).length;
  const totalSimples = ocorrenciasDoAluno.filter(
    (item) => item.categoria === "ocorrencia",
  ).length;
  return suspensoesDiretas + Math.floor(totalSimples / 3);
};`;

const newCount = `const contarSuspensoes = (ocorrenciasDoAluno) => {
  if (!ocorrenciasDoAluno || ocorrenciasDoAluno.length === 0) return 0;
  return ocorrenciasDoAluno.filter(
    (item) => item.categoria === "suspensao",
  ).length;
};`;

const oldOrder = `const ordenarESinalizarSuspensoes = (lista) => {
  const ascendente = [...lista].sort((a, b) =>
    (a.data_ocorrido || "").localeCompare(b.data_ocorrido || ""),
  );
  let contadorSimples = 0;
  let numeroSuspensao = 0;
  const sinalizadas = ascendente.map((occ) => {
    if (occ.categoria === "suspensao") {
      numeroSuspensao += 1;
      return { ...occ, suspensaoGerada: { numero: numeroSuspensao, origem: "direta" } };
    }
    contadorSimples += 1;
    if (contadorSimples % 3 === 0) {
      numeroSuspensao += 1;
      return { ...occ, suspensaoGerada: { numero: numeroSuspensao, origem: "acumulo" } };
    }
    return { ...occ, suspensaoGerada: null };
  });
  return sinalizadas.sort((a, b) =>
    (b.data_ocorrido || "").localeCompare(a.data_ocorrido || ""),
  );
};`;

const newOrder = `const ordenarESinalizarSuspensoes = (lista) => {
  const ascendente = [...lista].sort((a, b) => {
    const dateCompare = (a.data_ocorrido || "").localeCompare(b.data_ocorrido || "");
    if (dateCompare !== 0) return dateCompare;
    return String(a.created_at || a.id || "").localeCompare(String(b.created_at || b.id || ""));
  });

  // A suspensão automática referencia a ocorrência que atingiu o limite.
  // Para o histórico do aluno, a ocorrência de origem não deve aparecer como
  // um segundo registro: exibimos apenas a suspensão e explicamos sua origem.
  const idsDeOrigens = new Set(
    ascendente
      .filter((item) => item.categoria === "suspensao" && item.ocorrencia_origem_id)
      .map((item) => String(item.ocorrencia_origem_id)),
  );

  const historico = ascendente.filter(
    (item) => !idsDeOrigens.has(String(item.id)),
  );

  let numeroSuspensao = 0;

  return historico
    .map((occ) => {
      if (occ.categoria !== "suspensao") {
        return { ...occ, suspensaoGerada: null };
      }

      numeroSuspensao += 1;

      const origem = occ.ocorrencia_origem_id
        ? ascendente.find((item) => String(item.id) === String(occ.ocorrencia_origem_id))
        : null;

      const ocorrenciasAteOrigem = origem
        ? ascendente.filter(
            (item) =>
              item.categoria === "ocorrencia" &&
              (item.data_ocorrido || "") <= (origem.data_ocorrido || ""),
          ).length
        : null;

      const motivo = origem?.descricao || occ.descricao || "Não informado";
      const professor = origem?.professor_nome || occ.professor_nome || "Não informado";

      return {
        ...occ,
        descricao: origem
          ? `O aluno atingiu ${ocorrenciasAteOrigem || 3} ocorrências. Motivo do professor: ${motivo}.`
          : occ.descricao || "Suspensão registrada.",
        professor_nome: professor,
        suspensaoGerada: { numero: numeroSuspensao, origem: "aplicada" },
      };
    })
    .sort((a, b) => {
      const dateCompare = (b.data_ocorrido || "").localeCompare(a.data_ocorrido || "");
      if (dateCompare !== 0) return dateCompare;
      return String(b.created_at || b.id || "").localeCompare(String(a.created_at || a.id || ""));
    });
};`;

const nextCount = text.replace(oldCount, newCount);
const nextOrder = nextCount.replace(oldOrder, newOrder);

if (nextOrder === text) {
  if (text.includes('const idsDeOrigens = new Set(') && text.includes('return ocorrenciasDoAluno.filter(')) {
    process.exit(0);
  }
  throw new Error('Não foi possível localizar a lógica atual do histórico disciplinar.');
}

fs.writeFileSync(file, nextOrder, 'utf8');
console.log('[LogZélia] Histórico disciplinar corrigido: origem da suspensão fica consolidada no registro da suspensão.');
