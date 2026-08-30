const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function patchPopup() {
  const file = path.join(root, 'src/components/ui/SuspensionDecisionPopup.jsx');
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes('const [expulsionNotice, setExpulsionNotice]')) return;

  text = text.replace(
    '  const [notice, setNotice] = useState("");\n',
    '  const [notice, setNotice] = useState("");\n  const [expulsionNotice, setExpulsionNotice] = useState(null);\n',
  );
  text = text.replace(
    '  const resultaraEmExpulsao = numeroSuspensao >= 3;\n  const totalPendentes = items.length;\n',
    '  const resultaraEmExpulsao = numeroSuspensao >= 3;\n  const totalPendentes = items.length;\n  const professorResponsavel = pending?.occurrence?.professor_nome || "Não informado";\n  const ocorrenciasAteLimite = Number(pending?.ocorrenciasAteLimite || numeroSuspensao * 3);\n',
  );

  text = text.replace(
    /  const textoCompartilhamento = pending\n    \? `.*?`\n    : "";/s,
    '  const textoCompartilhamento = pending\n    ? `🚨 COMUNICADO DE SUSPENSÃO\\n\\n👤 Aluno: ${pending.aluno?.nome || "Aluno"}\\n🏫 Turma: ${pending.turma?.nome || "—"}\\n⚠️ Suspensão: ${numeroSuspensao}ª\\n⏳ Duração: ${days} ${Number(days) === 1 ? "dia" : "dias"}\\n📅 Período: ${formatDate(startDate)} até ${formatDate(endDate)}\\n📝 Motivo: O aluno atingiu ${ocorrenciasAteLimite} ocorrências.\\n📌 Ocorrência que acionou a suspensão: ${pending.occurrence?.descricao || "Não informado"}\\n👨‍🏫 Professor responsável: ${professorResponsavel}\\n\\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.`\n    : "";',
  );

  const createStart = text.indexOf('  const createImageBlob = async () => {');
  const createEnd = text.indexOf('  const copyText = async () => {', createStart);
  if (createStart < 0 || createEnd < 0) throw new Error('Não foi possível localizar createImageBlob.');
  const imageFunction = `  const createImageBlob = async (isExpulsion = false, details = {}) => {
    if (!pending) return null;
    const currentDays = details.days ?? days;
    const currentStart = details.startDate ?? startDate;
    const currentEnd = details.endDate ?? endDate;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1060;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, 1400, 1060);
    const gradient = ctx.createLinearGradient(0, 0, 1400, 270);
    gradient.addColorStop(0, isExpulsion ? "#991b1b" : "#166534");
    gradient.addColorStop(1, isExpulsion ? "#dc2626" : "#0f766e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1400, 270);

    const logoImage = await loadAssetImage(logoLogin);
    if (logoImage?.naturalWidth) ctx.drawImage(logoImage, 72, 54, 160, 160);
    ctx.fillStyle = "#fff";
    ctx.font = \`700 48px \${font}\`;
    ctx.fillText("LogZélia", 270, 112);
    ctx.font = \`600 25px \${font}\`;
    ctx.fillText(isExpulsion ? "COMUNICADO DE EXPULSÃO" : "COMUNICADO DE SUSPENSÃO", 270, 160);

    ctx.fillStyle = "#0f172a";
    ctx.font = \`600 23px \${font}\`;
    ctx.fillText("Aluno", 90, 330);
    ctx.font = \`700 36px \${font}\`;
    ctx.fillText(pending.aluno?.nome || "Aluno", 90, 375);
    ctx.font = \`500 21px \${font}\`;
    if (pending.aluno?.matricula) ctx.fillText(\`Matrícula: \${pending.aluno.matricula}\`, 90, 410);
    ctx.font = \`600 23px \${font}\`;
    ctx.fillText("Turma", 90, 465);
    ctx.font = \`600 30px \${font}\`;
    ctx.fillText(pending.turma?.nome || "—", 90, 505);

    ctx.fillStyle = isExpulsion ? "#b91c1c" : "#b45309";
    ctx.font = \`600 23px \${font}\`;
    ctx.fillText(isExpulsion ? "Expulsão" : "Suspensão", 90, 585);
    ctx.fillStyle = "#0f172a";
    ctx.font = \`700 32px \${font}\`;
    ctx.fillText(isExpulsion ? "3ª suspensão — expulsão" : \`\${numeroSuspensao}ª suspensão\`, 90, 630);
    ctx.font = \`600 23px \${font}\`;
    ctx.fillText("Duração", 760, 585);
    ctx.font = \`700 32px \${font}\`;
    ctx.fillText(\`\${currentDays} \${Number(currentDays) === 1 ? "dia" : "dias"}\`, 760, 630);
    ctx.font = \`500 21px \${font}\`;
    ctx.fillText(\`\${formatDate(currentStart)} até \${formatDate(currentEnd)}\`, 760, 670);

    ctx.fillStyle = "#334155";
    ctx.font = \`600 22px \${font}\`;
    ctx.fillText("Motivo", 90, 730);
    ctx.font = \`500 20px \${font}\`;
    ctx.fillText(isExpulsion ? "O aluno atingiu a 3ª suspensão, resultando em expulsão." : \`O aluno atingiu \${ocorrenciasAteLimite} ocorrências.\`, 90, 765);
    ctx.font = \`600 22px \${font}\`;
    ctx.fillText("Ocorrência que acionou a medida", 90, 815);
    ctx.font = \`500 19px \${font}\`;
    const words = String(pending.occurrence?.descricao || "Não informado").split(/\\s+/);
    let line = "";
    let y = 850;
    for (const word of words) {
      const candidate = line ? \`\${line} \${word}\` : word;
      if (ctx.measureText(candidate).width > 1220) {
        ctx.fillText(line, 90, y);
        line = word;
        y += 27;
      } else line = candidate;
      if (y > 900) break;
    }
    if (line) ctx.fillText(line, 90, y);
    ctx.fillStyle = "#64748b";
    ctx.font = \`500 17px \${font}\`;
    ctx.fillText(\`Professor responsável: \${professorResponsavel}\`, 90, 935);

    const footerImage = await loadAssetImage(topoMini);
    if (footerImage?.naturalWidth) ctx.drawImage(footerImage, 0, 970, 1400, 90);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };\n\n`;
  if (!text.includes('const loadAssetImage = ')) {
    const helper = `const loadAssetImage = (src) => new Promise((resolve) => {\n  const image = new Image();\n  image.crossOrigin = "anonymous";\n  image.onload = () => resolve(image);\n  image.onerror = () => resolve(null);\n  image.src = src;\n});\n\n`;
    text = text.replace('export function SuspensionDecisionPopup', helper + 'export function SuspensionDecisionPopup', 1);
  }
  text = text.slice(0, createStart) + imageFunction + text.slice(createEnd);

  const confirmStart = text.indexOf('  const confirmSuspension = async () => {');
  const confirmEnd = text.indexOf('  if (!pending) return null;', confirmStart);
  if (confirmStart < 0 || confirmEnd < 0) throw new Error('Não foi possível localizar confirmSuspension.');
  const confirmFunction = `  const confirmSuspension = async () => {
    if (!pending || Number(days) < 1 || !startDate || !endDate || saving) return;
    setSaving(true);
    setNotice("");
    try {
      await onConfirm?.(pending, { days: Number(days), startDate, endDate });
      if (numeroSuspensao >= 3) {
        setExpulsionNotice({ pending, days: Number(days), startDate, endDate });
      } else {
        onDismiss?.(pending.occurrence.id);
      }
    } catch (error) {
      console.error(error);
      setNotice("Não foi possível registrar a suspensão.");
    } finally {
      setSaving(false);
    }
  };

  const closeExpulsion = () => {
    const id = expulsionNotice?.pending?.occurrence?.id;
    setExpulsionNotice(null);
    if (id) onDismiss?.(id);
  };

`;
  text = text.slice(0, confirmStart) + confirmFunction + text.slice(confirmEnd);

  const marker = `      </Modal>\n  );\n}`;
  const expulsionModal = `      </Modal>\n\n      <Modal isOpen={Boolean(expulsionNotice)} onClose={closeExpulsion} title="Expulsão do aluno">\n        {expulsionNotice && (\n          <div className="space-y-5 font-sans">\n            <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5">\n              <div className="flex items-start gap-3">\n                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><FaExclamationTriangle /></div>\n                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Medida disciplinar final</p><h3 className="mt-1 text-xl font-bold text-red-900">O aluno será expulso</h3><p className="mt-1 text-sm leading-6 text-red-800">A 3ª suspensão foi registrada e resulta em expulsão.</p></div>\n              </div>\n            </div>\n            <div className="grid gap-3 sm:grid-cols-2">\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aluno</p><p className="mt-1 text-lg font-bold text-slate-900">{expulsionNotice.pending.aluno?.nome || "—"}</p>{expulsionNotice.pending.aluno?.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula: {expulsionNotice.pending.aluno.matricula}</p>}</div>\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turma</p><p className="mt-1 text-lg font-bold text-slate-900">{expulsionNotice.pending.turma?.nome || "—"}</p></div>\n            </div>\n            <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-red-600">Motivo</p><p className="mt-1 text-base font-semibold text-red-900">O aluno atingiu a 3ª suspensão.</p><p className="mt-2 text-sm leading-6 text-red-800">📌 Ocorrência: {expulsionNotice.pending.occurrence?.descricao || "Não informado"}</p><p className="mt-2 text-xs font-medium text-red-700">👨‍🏫 Professor responsável: {professorResponsavel}</p></div>\n            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Medida</p><p className="mt-1 text-lg font-bold text-slate-900">3ª suspensão — expulsão</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p><p className="mt-1 text-lg font-bold text-slate-900">{formatDate(expulsionNotice.startDate)} até {formatDate(expulsionNotice.endDate)}</p><p className="mt-1 text-xs text-slate-500">{expulsionNotice.days} {Number(expulsionNotice.days) === 1 ? "dia" : "dias"}</p></div></div>\n            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:justify-end"><button type="button" onClick={() => copyText(`🚨 COMUNICADO DE EXPULSÃO\\n\\n👤 Aluno: ${expulsionNotice.pending.aluno?.nome || "Aluno"}\\n🏫 Turma: ${expulsionNotice.pending.turma?.nome || "—"}\\n🚫 Medida: 3ª suspensão — expulsão\\n⏳ Duração: ${expulsionNotice.days} ${Number(expulsionNotice.days) === 1 ? "dia" : "dias"}\\n📅 Período: ${formatDate(expulsionNotice.startDate)} até ${formatDate(expulsionNotice.endDate)}\\n📝 Motivo: O aluno atingiu a 3ª suspensão, resultando em expulsão.\\n📌 Ocorrência: ${expulsionNotice.pending.occurrence?.descricao || "Não informado"}\\n👨‍🏫 Professor responsável: ${professorResponsavel}\\n\\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.`)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><FaCopy /> Copiar texto</button><button type="button" onClick={() => downloadImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><FaDownload /> Baixar imagem</button><button type="button" onClick={() => shareImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"><FaShareAlt /> Compartilhar</button></div>\n            <div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" onClick={closeExpulsion} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white">Concluir</button></div>\n          </div>\n        )}\n      </Modal>\n  );\n}`;
  if (!text.includes('title="Expulsão do aluno"')) text = text.replace(marker, expulsionModal, 1);

  popup.writeText(text, 'utf8');
}

function patchHistory() {
  const file = path.join(root, 'src/pages/Occurrences.jsx');
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('return ocorrenciasDoAluno.filter((item) => item.categoria === "suspensao").length;')) {
    text = text.replace(
      /const contarSuspensoes = \(ocorrenciasDoAluno\) => \{.*?\n\};/s,
      `const contarSuspensoes = (ocorrenciasDoAluno) => {\n  if (!ocorrenciasDoAluno || ocorrenciasDoAluno.length === 0) return 0;\n  return ocorrenciasDoAluno.filter((item) => item.categoria === "suspensao").length;\n};`,
    );
  }
  if (!text.includes('Motivo do professor:')) {
    text = text.replace(
      /const ordenarESinalizarSuspensoes = \(lista\) => \{.*?\n\};/s,
      `const ordenarESinalizarSuspensoes = (lista) => {\n  const ascendente = [...lista].sort((a, b) =>\n    (a.data_ocorrido || "").localeCompare(b.data_ocorrido || ""),\n  );\n  let numeroSuspensao = 0;\n  return ascendente.filter((occ) => occ.categoria === "suspensao").map((occ) => {\n    numeroSuspensao += 1;\n    const origem = occ.ocorrencia_origem_id\n      ? ascendente.find((item) => item.id === occ.ocorrencia_origem_id)\n      : null;\n    const ocorrenciasAteOrigem = origem\n      ? ascendente.filter((item) => item.categoria === "ocorrencia" && (item.data_ocorrido || "") <= (origem.data_ocorrido || "")).length\n      : null;\n    return {\n      ...occ,\n      descricao: origem\n        ? \`O aluno atingiu \${ocorrenciasAteOrigem || numeroSuspensao * 3} ocorrências. Motivo do professor: \${origem.descricao || "Não informado"}.\`\n        : (occ.descricao || "Suspensão registrada."),\n      suspensaoGerada: { numero: numeroSuspensao, origem: "aplicada" },\n    };\n  }).sort((a, b) =>\n    (b.data_ocorrido || "").localeCompare(a.data_ocorrido || ""),\n  );\n};`,
    );
  }
  fs.writeFileSync(file, text, 'utf8');
}

function patchHome() {
  const file = path.join(root, 'src/pages/Home.jsx');
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('alreadyApplied: true')) {
    text = text.replace(
      'if (tipoAdvertencia === "ocorrencia") {\n        const [ocorrenciasResult, suspensoesResult] = await Promise.all([',
      'if (tipoAdvertencia === "ocorrencia" || tipoAdvertencia === "suspensao") {\n        const [ocorrenciasResult, suspensoesResult] = await Promise.all([',
    );
    text = text.replace(
      '''          suspensoesPendentes.push({
            occurrence: insertedOccurrence,
            aluno: aluno || { id: alunoId, nome: "Aluno" },
            turma: turma || { id: selectedTurma, nome: "—" },
            suspensoes: totalSuspensoes,
          });''',
      '''          suspensoesPendentes.push({
            occurrence: insertedOccurrence,
            aluno: aluno || { id: alunoId, nome: "Aluno" },
            turma: turma || { id: selectedTurma, nome: "—" },
            suspensoes: totalSuspensoes,
            ocorrenciasAteLimite: totalDepois,
          });''',
    );
    text = text.replace(
      '''        }
      }
    }

    setSubmitting(false);''',
      '''        }
      }

      if (tipoAdvertencia === "suspensao" && totalSuspensoes + 1 >= 3) {
        const aluno = alunos.find((item) => String(item.id) === String(alunoId));
        const turma = turmas.find((item) => String(item.id) === String(selectedTurma));
        suspensoesPendentes.push({
          occurrence: insertedOccurrence,
          aluno: aluno || { id: alunoId, nome: "Aluno" },
          turma: turma || { id: selectedTurma, nome: "—" },
          suspensoes: totalSuspensoes,
          alreadyApplied: true,
          days: Math.max(1, Math.floor((new Date(`${dataTermino}T12:00:00`) - new Date(`${dataInicio}T12:00:00`)) / 86400000) + 1),
          startDate: dataInicio,
          endDate: dataTermino,
        });
      }
    }

    setSubmitting(false);''',
    );
  }
  fs.writeFileSync(file, text, 'utf8');
}

patchPopup();
patchHistory();
patchHome();
console.log('[LogZélia] Refinamento do fluxo disciplinar aplicado.');
