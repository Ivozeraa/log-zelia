const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function replaceOnce(text, pattern, replacement, label) {
  const next = typeof pattern === 'string' ? text.replace(pattern, replacement) : text.replace(pattern, replacement);
  if (next === text && label) throw new Error(`Patch não aplicado: ${label}`);
  return next;
}

function patchPopup() {
  const file = path.join(root, 'src/components/ui/SuspensionDecisionPopup.jsx');
  let text = fs.readFileSync(file, 'utf8');

  if (!text.includes('const [expulsionNotice, setExpulsionNotice]')) {
    text = replaceOnce(
      text,
      '  const [notice, setNotice] = useState("");\n',
      '  const [notice, setNotice] = useState("");\n  const [expulsionNotice, setExpulsionNotice] = useState(null);\n',
      'estado do modal de expulsão',
    );
  }

  if (!text.includes('const professorResponsavel =')) {
    text = replaceOnce(
      text,
      '  const totalPendentes = items.length;\n',
      '  const totalPendentes = items.length;\n  const professorResponsavel = pending?.occurrence?.professor_nome || "Não informado";\n  const ocorrenciasAteLimite = Number(pending?.ocorrenciasAteLimite || numeroSuspensao * 3);\n',
      'dados adicionais do comunicado',
    );
  }

  text = text.replace(
    /  const textoCompartilhamento = pending\n    \? `.*?`\n    : "";/s,
    `  const textoCompartilhamento = pending
    ? \`🚨 COMUNICADO DE SUSPENSÃO\\n\\n👤 Aluno: \${pending.aluno?.nome || "Aluno"}\\n🏫 Turma: \${pending.turma?.nome || "—"}\\n⚠️ Suspensão: \${numeroSuspensao}ª\\n⏳ Duração: \${days} \${Number(days) === 1 ? "dia" : "dias"}\\n📅 Período: \${formatDate(startDate)} até \${formatDate(endDate)}\\n📝 Motivo: O aluno atingiu \${ocorrenciasAteLimite} ocorrências.\\n📌 Ocorrência que acionou a suspensão: \${pending.occurrence?.descricao || "Não informado"}\\n👨‍🏫 Professor responsável: \${professorResponsavel}\\n\\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.\`
    : "";`,
  );

  // Use the same visual family as the rest of the application in generated images and modal text.
  text = text.replace(/ctx\.font = "([^"]+) Arial";/g, 'ctx.font = "$1-apple-system, BlinkMacSystemFont, \\"Segoe UI\\", system-ui, sans-serif";');
  text = text.replace('className="space-y-5">', 'className="space-y-5 font-sans">');
  text = text.replace(/font-black/g, 'font-bold');

  // Keep the image generation useful for sharing, adding teacher and reason.
  text = text.replace(
    '    ctx.fillText("Ocorrência", 90, 725);',
    '    ctx.fillText("Motivo", 90, 705);\n    ctx.font = "500 21px -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", system-ui, sans-serif";\n    ctx.fillText(`O aluno atingiu ${ocorrenciasAteLimite} ocorrências.`, 90, 740);\n    ctx.font = "600 22px -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", system-ui, sans-serif";\n    ctx.fillText("Ocorrência que acionou a suspensão", 90, 790);',
  );
  text = text.replace('    let y = 760;', '    let y = 825;');
  text = text.replace('    ctx.fillText("Registro gerado pelo LogZélia • Sistema de gestão escolar", 90, 885);', '    ctx.font = "500 18px -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", system-ui, sans-serif";\n    ctx.fillStyle = "#64748b";\n    ctx.fillText(`Professor responsável: ${professorResponsavel}`, 90, 925);');
  text = text.replace('        ctx.drawImage(footerImage, 0, 900, 1400, 80);', '        ctx.drawImage(footerImage, 0, 970, 1400, 90);');

  if (!text.includes('const closeExpulsion = () =>')) {
    const insertAt = text.indexOf('  if (!pending) return null;');
    if (insertAt < 0) throw new Error('Ponto de inserção do modal de expulsão não encontrado.');
    text = text.slice(0, insertAt) + `  const closeExpulsion = () => {\n    const id = expulsionNotice?.pending?.occurrence?.id;\n    setExpulsionNotice(null);\n    if (id) onDismiss?.(id);\n  };\n\n` + text.slice(insertAt);
  }

  text = text.replace(
    '      await onConfirm?.(pending, { days: Number(days), startDate, endDate });\n      onDismiss?.(pending.occurrence.id);',
    '      await onConfirm?.(pending, { days: Number(days), startDate, endDate });\n      if (numeroSuspensao >= 3) {\n        setExpulsionNotice({ pending, days: Number(days), startDate, endDate });\n      } else {\n        onDismiss?.(pending.occurrence.id);\n      }',
  );

  if (!text.includes('title="Expulsão do aluno"')) {
    const marker = /\n[ ]{4}<\/Modal>\n[ ]{2}\);\n}\s*$/;
    const modal = `      </Modal>\n\n      <Modal isOpen={Boolean(expulsionNotice)} onClose={closeExpulsion} title="Expulsão do aluno">\n        {expulsionNotice && (\n          <div className="space-y-5 font-sans">\n            <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5">\n              <div className="flex items-start gap-3">\n                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><FaExclamationTriangle /></div>\n                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Medida disciplinar final</p><h3 className="mt-1 text-xl font-bold text-red-900">O aluno será expulso</h3><p className="mt-1 text-sm leading-6 text-red-800">A 3ª suspensão foi registrada e resulta em expulsão.</p></div>\n              </div>\n            </div>\n            <div className="grid gap-3 sm:grid-cols-2">\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aluno</p><p className="mt-1 text-lg font-bold text-slate-900">{expulsionNotice.pending.aluno?.nome || "—"}</p>{expulsionNotice.pending.aluno?.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula: {expulsionNotice.pending.aluno.matricula}</p>}</div>\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turma</p><p className="mt-1 text-lg font-bold text-slate-900">{expulsionNotice.pending.turma?.nome || "—"}</p></div>\n            </div>\n            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">\n              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Motivo da expulsão</p>\n              <p className="mt-1 text-base font-semibold text-red-900">O aluno atingiu a 3ª suspensão.</p>\n              <p className="mt-2 text-sm leading-6 text-red-800">📌 Ocorrência: {expulsionNotice.pending.occurrence?.descricao || "Não informado"}</p>\n              <p className="mt-2 text-xs font-medium text-red-700">👨‍🏫 Professor responsável: {professorResponsavel}</p>\n            </div>\n            <div className="grid gap-3 sm:grid-cols-2">\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Medida</p><p className="mt-1 text-lg font-bold text-slate-900">3ª suspensão — expulsão</p></div>\n              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p><p className="mt-1 text-lg font-bold text-slate-900">{formatDate(expulsionNotice.startDate)} até {formatDate(expulsionNotice.endDate)}</p><p className="mt-1 text-xs text-slate-500">{expulsionNotice.days} {Number(expulsionNotice.days) === 1 ? "dia" : "dias"}</p></div>\n            </div>\n            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">\n              <button type="button" onClick={() => copyText(\`🚨 COMUNICADO DE EXPULSÃO\\n\\n👤 Aluno: \${expulsionNotice.pending.aluno?.nome || "Aluno"}\\n🏫 Turma: \${expulsionNotice.pending.turma?.nome || "—"}\\n🚫 Medida: 3ª suspensão — expulsão\\n⏳ Duração: \${expulsionNotice.days} \${Number(expulsionNotice.days) === 1 ? "dia" : "dias"}\\n📅 Período: \${formatDate(expulsionNotice.startDate)} até \${formatDate(expulsionNotice.endDate)}\\n📝 Motivo: O aluno atingiu a 3ª suspensão, resultando em expulsão.\\n📌 Ocorrência: \${expulsionNotice.pending.occurrence?.descricao || "Não informado"}\\n👨‍🏫 Professor responsável: \${professorResponsavel}\\n\\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.\`)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><FaCopy /> Copiar texto</button>\n              <button type="button" onClick={() => downloadImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><FaDownload /> Baixar imagem</button>\n              <button type="button" onClick={() => shareImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"><FaShareAlt /> Compartilhar</button>\n            </div>\n            <div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" onClick={closeExpulsion} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800">Concluir</button></div>\n          </div>\n        )}\n      </Modal>\n    </div>,\n    document.body,\n  );\n}`;
    if (!text.includes(marker)) throw new Error('Fim do popup não encontrado.');
    text = text.replace(marker, modal);
  }

  write(file, text);
}

function patchHistory() {
  const file = path.join(root, 'src/pages/Occurrences.jsx');
  let text = fs.readFileSync(file, 'utf8');

  text = text.replace(
    /const contarSuspensoes = \(ocorrenciasDoAluno\) => \{.*?\n\};/s,
    `const contarSuspensoes = (ocorrenciasDoAluno) => {
  if (!ocorrenciasDoAluno || ocorrenciasDoAluno.length === 0) return 0;
  return ocorrenciasDoAluno.filter((item) => item.categoria === "suspensao").length;
};`,
  );

  text = text.replace(
    /const ordenarESinalizarSuspensoes = \(lista\) => \{.*?\n\};/s,
    `const ordenarESinalizarSuspensoes = (lista) => {
  const ascendente = [...lista].sort((a, b) => (a.data_ocorrido || "").localeCompare(b.data_ocorrido || ""));
  let numeroSuspensao = 0;
  return ascendente
    .filter((occ) => occ.categoria === "suspensao")
    .map((occ) => {
      numeroSuspensao += 1;
      const origem = occ.ocorrencia_origem_id ? ascendente.find((item) => item.id === occ.ocorrencia_origem_id) : null;
      const ocorrenciasAteOrigem = origem
        ? ascendente.filter((item) => item.categoria === "ocorrencia" && (item.data_ocorrido || "") <= (origem.data_ocorrido || "")).length
        : null;
      return {
        ...occ,
        descricao: origem
          ? \`O aluno atingiu \${ocorrenciasAteOrigem || numeroSuspensao * 3} ocorrências. Motivo do professor: \${origem.descricao || "Não informado"}.\`
          : (occ.descricao || "Suspensão registrada."),
        suspensaoGerada: { numero: numeroSuspensao, origem: "aplicada" },
      };
    })
    .sort((a, b) => (b.data_ocorrido || "").localeCompare(a.data_ocorrido || ""));
};`,
  );

  text = text.replace(/  const criarNotificacaoSuspensao = async \(\{.*?\n\};\n\n/s, '');
  file && fs.writeFileSync(file, text, 'utf8');
}

function patchHome() {
  const file = path.join(root, 'src/pages/Home.jsx');
  let text = fs.readFileSync(file, 'utf8');

  text = text.replace(
    'if (tipoAdvertencia === "ocorrencia") {\n        const [ocorrenciasResult, suspensoesResult] = await Promise.all([',
    'if (tipoAdvertencia === "ocorrencia" || tipoAdvertencia === "suspensao") {\n        const [ocorrenciasResult, suspensoesResult] = await Promise.all([',
  );

  text = text.replace(
    '            suspensoes: totalSuspensoes,\n          });',
    '            suspensoes: totalSuspensoes,\n            ocorrenciasAteLimite: totalDepois,\n          });',
  );

  if (!text.includes('alreadyApplied: true')) {
    const target = `        }\n      }\n    }\n\n    setSubmitting(false);`;
    const direct = `        }\n      }\n\n      if (tipoAdvertencia === "suspensao" && totalSuspensoes + 1 >= 3) {\n        const aluno = alunos.find((item) => String(item.id) === String(alunoId));\n        const turma = turmas.find((item) => String(item.id) === String(selectedTurma));\n        suspensoesPendentes.push({\n          occurrence: insertedOccurrence,\n          aluno: aluno || { id: alunoId, nome: "Aluno" },\n          turma: turma || { id: selectedTurma, nome: "—" },\n          suspensoes: totalSuspensoes,\n          alreadyApplied: true,\n          days: Math.max(1, Math.floor((new Date(\`${dataTermino}T12:00:00\`) - new Date(\`${dataInicio}T12:00:00\`)) / 86400000) + 1),\n          startDate: dataInicio,\n          endDate: dataTermino,\n        });\n      }\n    }\n\n    setSubmitting(false);`;
    if (text.includes(target)) text = text.replace(target, direct, 1);
  }

  fs.writeFileSync(file, text, 'utf8');
}

patchPopup();
patchHistory();
patchHome();
console.log('[LogZélia] Refinamento disciplinar aplicado com sucesso.');
