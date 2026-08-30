import { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaCopy, FaDownload, FaExclamationTriangle, FaShareAlt } from "react-icons/fa";
import logoLogin from "../../assets/images/logo-login.png";
import topoMini from "../../assets/images/topo_mini.png";
import { Modal } from "./Modal";

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (value, amount) => {
  if (!value || Number(amount) < 1) return "";
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + Number(amount) - 1);
  return date.toISOString().slice(0, 10);
};
const loadImage = (src) => new Promise((resolve) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

export function SuspensionDecisionPopup({ items = [], onConfirm, onDismiss }) {
  const pending = items[0] || null;
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const [expulsionNotice, setExpulsionNotice] = useState(null);

  const numeroSuspensao = Number(pending?.suspensoes || 0) + 1;
  const resultaraEmExpulsao = numeroSuspensao >= 3;
  const ocorrenciasAteLimite = Number(pending?.ocorrenciasAteLimite || numeroSuspensao * 3);
  const professorResponsavel = pending?.occurrence?.professor_nome || "Não informado";
  const totalPendentes = items.length;
  const endDate = useMemo(() => addDays(startDate, days), [startDate, days]);

  useEffect(() => {
    if (!pending) return;
    setDays(pending.alreadyApplied ? Number(pending.days || 1) : 1);
    setStartDate(pending.alreadyApplied ? (pending.startDate || today()) : today());
    setNotice("");
    setExpulsionNotice(null);
  }, [pending?.occurrence?.id, pending?.alreadyApplied]);

  const textoCompartilhamento = pending
    ? `🚨 COMUNICADO DE SUSPENSÃO\n\n👤 Aluno: ${pending.aluno?.nome || "Aluno"}\n🏫 Turma: ${pending.turma?.nome || "—"}\n⚠️ Suspensão: ${numeroSuspensao}ª${resultaraEmExpulsao ? " (3ª e última)" : ""}\n⏳ Duração: ${days} ${Number(days) === 1 ? "dia" : "dias"}\n📅 Período: ${formatDate(startDate)} até ${formatDate(endDate)}\n📝 Motivo: O aluno atingiu ${ocorrenciasAteLimite} ocorrências.\n📌 Ocorrência que acionou a suspensão: ${pending.occurrence?.descricao || "Não informado"}\n👨‍🏫 Professor responsável: ${professorResponsavel}\n\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.`
    : "";
  const textoExpulsao = expulsionNotice
    ? `🚨 COMUNICADO DE EXPULSÃO\n\n👤 Aluno: ${expulsionNotice.pending.aluno?.nome || "Aluno"}\n🏫 Turma: ${expulsionNotice.pending.turma?.nome || "—"}\n🚫 Medida: 3ª suspensão — expulsão\n⏳ Duração: ${expulsionNotice.days} ${Number(expulsionNotice.days) === 1 ? "dia" : "dias"}\n📅 Período: ${formatDate(expulsionNotice.startDate)} até ${formatDate(expulsionNotice.endDate)}\n📝 Motivo: O aluno atingiu a 3ª suspensão, resultando em expulsão.\n📌 Ocorrência relacionada: ${expulsionNotice.pending.occurrence?.descricao || "Não informado"}\n👨‍🏫 Professor responsável: ${professorResponsavel}\n\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.`
    : "";

  const createImageBlob = async (isExpulsion = false, details = {}) => {
    if (!pending) return null;
    const currentDays = Number(details.days ?? days);
    const currentStart = details.startDate ?? startDate;
    const currentEnd = details.endDate ?? endDate;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1060;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const font = '"Segoe UI", Arial, sans-serif';

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, 1400, 1060);
    const gradient = ctx.createLinearGradient(0, 0, 1400, 270);
    gradient.addColorStop(0, isExpulsion ? "#991b1b" : "#166534");
    gradient.addColorStop(1, isExpulsion ? "#dc2626" : "#0f766e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1400, 270);

    const headerLogo = await loadImage(logoLogin);
    if (headerLogo?.naturalWidth) ctx.drawImage(headerLogo, 72, 54, 160, 160);
    ctx.fillStyle = "#fff";
    ctx.font = `700 48px ${font}`;
    ctx.fillText("LogZélia", 270, 112);
    ctx.font = `600 25px ${font}`;
    ctx.fillText(isExpulsion ? "COMUNICADO DE EXPULSÃO" : "COMUNICADO DE SUSPENSÃO", 270, 160);

    ctx.fillStyle = "#0f172a";
    ctx.font = `600 23px ${font}`;
    ctx.fillText("Aluno", 90, 330);
    ctx.font = `700 36px ${font}`;
    ctx.fillText(pending.aluno?.nome || "Aluno", 90, 375);
    ctx.font = `500 21px ${font}`;
    if (pending.aluno?.matricula) ctx.fillText(`Matrícula: ${pending.aluno.matricula}`, 90, 410);
    ctx.font = `600 23px ${font}`;
    ctx.fillText("Turma", 90, 465);
    ctx.font = `600 30px ${font}`;
    ctx.fillText(pending.turma?.nome || "—", 90, 505);

    ctx.fillStyle = isExpulsion ? "#b91c1c" : "#b45309";
    ctx.font = `600 23px ${font}`;
    ctx.fillText(isExpulsion ? "Expulsão" : "Suspensão", 90, 585);
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 32px ${font}`;
    ctx.fillText(isExpulsion ? "3ª suspensão — expulsão" : `${numeroSuspensao}ª suspensão`, 90, 630);
    ctx.font = `600 23px ${font}`;
    ctx.fillText("Duração", 760, 585);
    ctx.font = `700 32px ${font}`;
    ctx.fillText(`${currentDays} ${Number(currentDays) === 1 ? "dia" : "dias"}`, 760, 630);
    ctx.font = `500 21px ${font}`;
    ctx.fillText(`${formatDate(currentStart)} até ${formatDate(currentEnd)}`, 760, 670);

    ctx.fillStyle = "#334155";
    ctx.font = `600 22px ${font}`;
    ctx.fillText("Motivo", 90, 730);
    ctx.font = `500 20px ${font}`;
    ctx.fillText(isExpulsion ? "O aluno atingiu a 3ª suspensão, resultando em expulsão." : `O aluno atingiu ${ocorrenciasAteLimite} ocorrências.`, 90, 765);
    ctx.font = `600 22px ${font}`;
    ctx.fillText("Ocorrência que acionou a medida", 90, 815);
    ctx.font = `500 19px ${font}`;
    const words = String(pending.occurrence?.descricao || "Não informado").split(/\s+/);
    let line = "";
    let y = 850;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > 1220) {
        ctx.fillText(line, 90, y);
        line = word;
        y += 27;
      } else line = candidate;
      if (y > 900) break;
    }
    if (line) ctx.fillText(line, 90, y);
    ctx.fillStyle = "#64748b";
    ctx.font = `500 17px ${font}`;
    ctx.fillText(`Professor responsável: ${professorResponsavel}`, 90, 935);
    const footer = await loadImage(topoMini);
    if (footer?.naturalWidth) ctx.drawImage(footer, 0, 970, 1400, 90);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };

  const copyText = async (value = (expulsionNotice ? textoExpulsao : textoCompartilhamento)) => {
    await navigator.clipboard?.writeText(value);
    setNotice("Comunicado copiado para a área de transferência.");
  };
  const downloadImage = async (isExpulsion = false, details = {}) => {
    setSharing(true);
    try {
      const blob = await createImageBlob(isExpulsion, details);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${isExpulsion ? "expulsao" : "suspensao"}-${(pending.aluno?.nome || "aluno").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  };
  const shareImage = async (isExpulsion = false, details = {}) => {
    setSharing(true);
    try {
      const text = isExpulsion ? textoExpulsao : textoCompartilhamento;
      const blob = await createImageBlob(isExpulsion, details);
      if (!blob) return;
      const file = new File([blob], `${isExpulsion ? "expulsao" : "suspensao"}.png`, { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: isExpulsion ? "Comunicado de Expulsão" : "Comunicado de Suspensão", text, files: [file] });
      else { await navigator.clipboard?.writeText(text); setNotice("Seu dispositivo não permite compartilhar a imagem. O texto foi copiado."); }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    } finally { setSharing(false); }
  };
  const confirmSuspension = async () => {
    if (!pending || Number(days) < 1 || !startDate || !endDate || saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (!pending.alreadyApplied) await onConfirm?.(pending, { days: Number(days), startDate, endDate });
      if (numeroSuspensao >= 3) setExpulsionNotice({ pending, days: Number(days), startDate, endDate });
      else onDismiss?.(pending.occurrence.id);
    } catch (error) {
      console.error(error);
      setNotice("Não foi possível registrar a suspensão.");
    } finally { setSaving(false); }
  };
  const closeExpulsion = () => {
    const id = expulsionNotice?.pending?.occurrence?.id;
    setExpulsionNotice(null);
    if (id) onDismiss?.(id);
  };
  if (!pending) return null;

  const studentData = <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aluno</p><p className="mt-1 text-lg font-bold leading-snug text-slate-900">{pending.aluno?.nome || "—"}</p>{pending.aluno?.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula: {pending.aluno.matricula}</p>}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turma</p><p className="mt-1 text-lg font-bold text-slate-900">{pending.turma?.nome || "—"}</p></div></div>;

  return <div className="font-sans">
    <Modal isOpen={!expulsionNotice} onClose={() => onDismiss?.(null)} title="Decisão de suspensão">
      <div className="space-y-5 font-sans">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-red-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><FaExclamationTriangle /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Ação necessária</p><p className="text-base font-bold text-slate-900">Este aluno será suspenso</p><p className="text-xs text-slate-500">Informe a duração antes de concluir.</p></div></div>{totalPendentes > 1 && <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">{totalPendentes} pendentes</span>}</div>
        {studentData}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-amber-900">Ocorrência que acionou a suspensão</p><span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">{formatDate(pending.occurrence?.data_ocorrido)}</span></div><p className="mt-2 text-sm leading-6 text-amber-800">{pending.occurrence?.descricao || "Descrição não informada."}</p><p className="mt-2 text-xs font-medium text-amber-700">Situação: {pending.occurrence?.tipo || "Ocorrência"}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Suspensão</p><p className="mt-1 text-xl font-bold text-slate-900">{numeroSuspensao}ª suspensão</p>{resultaraEmExpulsao && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">🚨 Esta é a 3ª suspensão e resultará em expulsão.</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold text-slate-700">Duração da suspensão</span><div className="relative"><FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" min="1" step="1" inputMode="numeric" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 font-medium outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" /></div><span className="mt-1 block text-xs text-slate-500">O professor define quantos dias o aluno ficará suspenso.</span></label><label><span className="mb-2 block text-sm font-semibold text-slate-700">Início</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" /><span className="mt-1 block text-xs text-slate-500">Término calculado: <strong>{formatDate(endDate)}</strong></span></label></div>
        {notice && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{notice}</p>}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:justify-end"><button type="button" onClick={() => copyText()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><FaCopy /> Copiar texto</button><button type="button" onClick={() => downloadImage(false)} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><FaDownload /> Baixar imagem</button><button type="button" onClick={() => shareImage(false)} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 disabled:opacity-50"><FaShareAlt /> Compartilhar</button></div>
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => onDismiss?.(null)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100">Decidir depois</button><button type="button" onClick={confirmSuspension} disabled={saving} className="rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-green-800 disabled:opacity-50">{saving ? "Registrando..." : "Confirmar suspensão"}</button></div>
      </div>
    </Modal>
    <Modal isOpen={Boolean(expulsionNotice)} onClose={closeExpulsion} title="Expulsão do aluno">
      {expulsionNotice && <div className="space-y-5 font-sans"><div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><FaExclamationTriangle /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Medida disciplinar final</p><h3 className="mt-1 text-xl font-bold text-red-900">O aluno será expulso</h3><p className="mt-1 text-sm leading-6 text-red-800">A 3ª suspensão foi registrada e resulta em expulsão.</p></div></div></div>{studentData}<div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-red-600">Motivo da expulsão</p><p className="mt-1 text-base font-semibold text-red-900">O aluno atingiu a 3ª suspensão.</p><p className="mt-2 text-sm leading-6 text-red-800">📌 Ocorrência relacionada: {expulsionNotice.pending.occurrence?.descricao || "Não informado"}</p><p className="mt-2 text-xs font-medium text-red-700">👨‍🏫 Professor responsável: {professorResponsavel}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Medida</p><p className="mt-1 text-lg font-bold text-slate-900">3ª suspensão — expulsão</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p><p className="mt-1 text-lg font-bold text-slate-900">{formatDate(expulsionNotice.startDate)} até {formatDate(expulsionNotice.endDate)}</p><p className="mt-1 text-xs text-slate-500">{expulsionNotice.days} {Number(expulsionNotice.days) === 1 ? "dia" : "dias"}</p></div></div><div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => copyText(textoExpulsao)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><FaCopy /> Copiar texto</button><button type="button" onClick={() => downloadImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><FaDownload /> Baixar imagem</button><button type="button" onClick={() => shareImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"><FaShareAlt /> Compartilhar</button></div><div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" onClick={closeExpulsion} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white">Concluir</button></div></div>}
    </Modal>
  </div>;
}
