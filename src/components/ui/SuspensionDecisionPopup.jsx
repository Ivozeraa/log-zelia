import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCopy,
  FaDownload,
  FaExclamationTriangle,
  FaShareAlt,
} from "react-icons/fa";
import logo from "../../assets/images/logo.png";
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

export function SuspensionDecisionPopup({ items = [], onConfirm, onDismiss }) {
  const pending = items[0] || null;
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!pending) return;
    setDays(1);
    setStartDate(today());
    setNotice("");
  }, [pending?.occurrence?.id]);

  const endDate = useMemo(() => addDays(startDate, days), [startDate, days]);
  const numeroSuspensao = Number(pending?.suspensoes || 0) + 1;
  const resultaraEmExpulsao = numeroSuspensao >= 3;
  const totalPendentes = items.length;

  const textoCompartilhamento = pending
    ? `Aluno: ${pending.aluno?.nome || "Aluno"}\nTurma: ${pending.turma?.nome || "—"}\nSuspensão: ${numeroSuspensao}ª${resultaraEmExpulsao ? " (resultará em expulsão)" : ""}\nDuração: ${days} ${Number(days) === 1 ? "dia" : "dias"}\nPeríodo: ${formatDate(startDate)} até ${formatDate(endDate)}\n\nOcorrência: ${pending.occurrence?.descricao || "Não informado"}`
    : "";

  const createImageBlob = async () => {
    if (!pending) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 980;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 1400, 260);
    gradient.addColorStop(0, "#166534");
    gradient.addColorStop(1, "#0f766e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 250);

    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = logo;
      await new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
      if (image.naturalWidth) ctx.drawImage(image, 80, 50, 150, 150);
    } catch {}

    ctx.fillStyle = "#fff";
    ctx.font = "700 48px Arial";
    ctx.fillText("LogZélia", 270, 110);
    ctx.font = "500 26px Arial";
    ctx.fillText("COMUNICADO DE SUSPENSÃO", 270, 155);

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 28px Arial";
    ctx.fillText("Aluno", 90, 330);
    ctx.font = "600 38px Arial";
    ctx.fillText(pending.aluno?.nome || "Aluno", 90, 375);
    ctx.font = "500 22px Arial";
    if (pending.aluno?.matricula) ctx.fillText(`Matrícula: ${pending.aluno.matricula}`, 90, 410);
    ctx.font = "700 25px Arial";
    ctx.fillText("Turma", 90, 465);
    ctx.font = "500 30px Arial";
    ctx.fillText(pending.turma?.nome || "—", 90, 505);

    ctx.fillStyle = "#b45309";
    ctx.font = "700 27px Arial";
    ctx.fillText("Suspensão", 90, 580);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial";
    ctx.fillText(`${numeroSuspensao}ª suspensão`, 90, 625);
    ctx.font = "700 27px Arial";
    ctx.fillText("Duração", 700, 580);
    ctx.font = "700 34px Arial";
    ctx.fillText(`${days} ${Number(days) === 1 ? "dia" : "dias"}`, 700, 625);
    ctx.font = "500 23px Arial";
    ctx.fillText(`${formatDate(startDate)} até ${formatDate(endDate)}`, 700, 665);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 22px Arial";
    ctx.fillText("Ocorrência", 90, 725);
    ctx.font = "500 21px Arial";
    const description = pending.occurrence?.descricao || "Não informado";
    const words = description.split(" ");
    let line = "";
    let y = 760;
    for (const word of words) {
      const test = `${line}${word} `;
      if (ctx.measureText(test).width > 1220) {
        ctx.fillText(line.trim(), 90, y);
        line = `${word} `;
        y += 30;
      } else {
        line = test;
      }
      if (y > 845) break;
    }
    ctx.fillText(line.trim(), 90, y);
    ctx.fillStyle = "#64748b";
    ctx.font = "500 18px Arial";
    ctx.fillText("Registro gerado pelo LogZélia • Sistema de gestão escolar", 90, 885);
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 930, 470, 50);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(470, 930, 470, 50);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(940, 930, 460, 50);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };

  const copyText = async () => {
    await navigator.clipboard?.writeText(textoCompartilhamento);
    setNotice("Texto da suspensão copiado.");
  };

  const downloadImage = async () => {
    setSharing(true);
    try {
      const blob = await createImageBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `suspensao-${(pending?.aluno?.nome || "aluno").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  };

  const shareImage = async () => {
    setSharing(true);
    try {
      const blob = await createImageBlob();
      if (!blob) return;
      const file = new File([blob], "comunicado-suspensao.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: "Comunicado de Suspensão",
          text: textoCompartilhamento,
          files: [file],
        });
      } else {
        await navigator.clipboard?.writeText(textoCompartilhamento);
        setNotice("Seu dispositivo não permite compartilhar a imagem. O texto foi copiado.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    } finally {
      setSharing(false);
    }
  };

  const confirmSuspension = async () => {
    if (!pending || Number(days) < 1 || !startDate || !endDate || saving) return;
    setSaving(true);
    setNotice("");
    try {
      await onConfirm?.(pending, { days: Number(days), startDate, endDate });
      onDismiss?.(pending.occurrence.id);
    } catch (error) {
      console.error(error);
      setNotice("Não foi possível registrar a suspensão.");
    } finally {
      setSaving(false);
    }
  };

  if (!pending) return null;

  return (
    <Modal
      isOpen={true}
      onClose={() => onDismiss?.(null)}
      title="Decisão de suspensão"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-red-50 px-4 py-4 dark:border-amber-900/60 dark:from-amber-950/30 dark:to-red-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"><FaExclamationTriangle /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Ação necessária</p>
              <p className="text-base font-black text-slate-900 dark:text-white">Este aluno será suspenso</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Informe a duração antes de concluir.</p>
            </div>
          </div>
          {totalPendentes > 1 && <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{totalPendentes} pendentes</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Aluno</p>
            <p className="mt-1 text-lg font-black leading-snug text-slate-900 dark:text-white">{pending.aluno?.nome || "—"}</p>
            {pending.aluno?.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula: {pending.aluno.matricula}</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Turma</p>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{pending.turma?.nome || "—"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Ocorrência que acionou a suspensão</p>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900 dark:bg-amber-900 dark:text-amber-200">{formatDate(pending.occurrence?.data_ocorrido)}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{pending.occurrence?.descricao || "Descrição não informada."}</p>
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">Situação: {pending.occurrence?.tipo || "Ocorrência"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suspensão</p>
          <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{numeroSuspensao}ª suspensão</p>
          {resultaraEmExpulsao && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">🚨 Esta é a 3ª suspensão. Após o registro, o aluno será expulso.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Duração da suspensão</span>
            <div className="relative"><FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" min="1" step="1" inputMode="numeric" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 font-semibold outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
            <span className="mt-1 block text-xs text-slate-500">O professor define quantos dias o aluno ficará suspenso.</span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Início</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <span className="mt-1 block text-xs text-slate-500">Término calculado: <strong>{formatDate(endDate)}</strong></span>
          </label>
        </div>

        {notice && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">{notice}</p>}

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" onClick={copyText} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><FaCopy /> Copiar texto</button>
          <button type="button" onClick={downloadImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><FaDownload /> Baixar imagem</button>
          <button type="button" onClick={shareImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 transition hover:bg-green-100 disabled:opacity-50 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"><FaShareAlt /> Compartilhar</button>
          <button type="button" onClick={() => onDismiss?.(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">Decidir depois</button>
          <button type="button" onClick={confirmSuspension} disabled={saving || sharing} className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800 disabled:opacity-50">{saving ? "Registrando..." : "Confirmar suspensão"}</button>
        </div>
      </div>
    </Modal>
  );
}
