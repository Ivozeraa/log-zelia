import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCopy,
  FaDownload,
  FaExclamationTriangle,
  FaShareAlt,
} from "react-icons/fa";
import logoLogin from "../../assets/images/logo-login.png";
import topoMini from "../../assets/images/topo_mini.png";
import { supabase } from "../../utils/supabase";
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

const loadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const plural = (value, singular, pluralValue) =>
  Number(value) === 1 ? singular : pluralValue;

export function SuspensionDecisionPopup({ items = [], onConfirm, onDismiss }) {
  const pending = items[0] || null;
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const [expulsionNotice, setExpulsionNotice] = useState(null);
  const [schoolName, setSchoolName] = useState("Escola");

  const numeroSuspensao = Number(pending?.suspensoes || 0) + 1;
  const resultaraEmExpulsao = numeroSuspensao >= 3;
  const ocorrenciasAteLimite = Number(
    pending?.ocorrenciasAteLimite || numeroSuspensao * 3,
  );
  const professorResponsavel =
    pending?.occurrence?.professor_nome || "Não informado";
  const totalPendentes = items.length;
  const endDate = useMemo(() => addDays(startDate, days), [startDate, days]);

  useEffect(() => {
    if (!pending) return;
    setDays(pending.alreadyApplied ? Number(pending.days || 1) : 1);
    setStartDate(
      pending.alreadyApplied ? pending.startDate || today() : today(),
    );
    setNotice("");
    setExpulsionNotice(null);
  }, [pending?.occurrence?.id, pending?.alreadyApplied]);

  useEffect(() => {
    let cancelled = false;
    const escolaId = pending?.occurrence?.escola_id;
    if (!escolaId) {
      setSchoolName("Escola");
      return () => {
        cancelled = true;
      };
    }

    supabase
      .from("escolas")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSchoolName(data?.nome || "Escola");
      });

    return () => {
      cancelled = true;
    };
  }, [pending?.occurrence?.escola_id]);

  const textoCompartilhamento = pending
    ? `🚨| *COMUNICADO DE SUSPENSÃO*\n\n*Aluno:* ${pending.aluno?.nome || "Aluno"}\n*Turma:* ${pending.turma?.nome || "—"}\n\n*Suspensão:* ${numeroSuspensao}ª\n*Duração:* ${days} ${plural(days, "dia", "dias")}\n\n📅 *Período: ${formatDate(startDate)} até ${formatDate(endDate)}*\n\n*Motivo:* O aluno atingiu ${ocorrenciasAteLimite} ocorrências.\n\n*Ocorrência que gerou a suspensão:* ${pending.occurrence?.descricao || "Não informado"}\n\n👨‍🏫 *Professor responsável:* ${professorResponsavel}\n\n_Registro realizado pelo LogZélia – Sistema de Gestão Escolar._`
    : "";

  const textoExpulsao = expulsionNotice
    ? `🚨| *COMUNICADO DE EXPULSÃO*\n\n*Aluno:* ${expulsionNotice.pending.aluno?.nome || "Aluno"}\n*Turma:* ${expulsionNotice.pending.turma?.nome || "—"}\n\n*Medida:* 3ª suspensão — expulsão\n\n📅 *Período: ${formatDate(expulsionNotice.startDate)} até ${formatDate(expulsionNotice.endDate)}*\n\n*Motivo:* O aluno atingiu a 3ª suspensão, resultando em expulsão.\n\n*Ocorrência que gerou a medida:* ${expulsionNotice.pending.occurrence?.descricao || "Não informado"}\n\n👨‍🏫 *Professor responsável:* ${professorResponsavel}\n\n_Registro realizado pelo LogZélia – Sistema de Gestão Escolar._`
    : "";

  const createImageBlob = async (isExpulsion = false, details = {}) => {
    if (!pending) return null;

    const currentDays = Number(details.days ?? days);
    const currentStart = details.startDate ?? startDate;
    const currentEnd = details.endDate ?? endDate;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const font = 'Inter, "Segoe UI", Arial, sans-serif';
    const headerHeight = 165;
    const pagePadding = 70;
    const contentWidth = canvas.width - pagePadding * 2;

    const roundedRect = (x, y, width, height, radius) => {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    };

    const wrapLines = (value, maxWidth, maxLines = 2) => {
      const words = String(value || "—").split(/\s+/);
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && ctx.measureText(candidate).width > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
      if (lines.length > maxLines) {
        const clipped = lines.slice(0, maxLines);
        const last = clipped[maxLines - 1];
        clipped[maxLines - 1] = `${last.replace(/[.…]+$/, "")}…`;
        return clipped;
      }
      return lines;
    };

    const drawWrapped = (
      value,
      x,
      y,
      maxWidth,
      lineHeight = 30,
      maxLines = 2,
    ) => {
      wrapLines(value, maxWidth, maxLines).forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
      });
    };

    const drawLabel = (label, x, y) => {
      ctx.fillStyle = "#64748b";
      ctx.font = `700 17px ${font}`;
      ctx.fillText(label.toUpperCase(), x, y);
    };

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header sólido, compacto e sem degradê.
    ctx.fillStyle = isExpulsion ? "#991b1b" : "#166534";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    const headerLogo = await loadImage(logoLogin);
    if (headerLogo?.naturalWidth) {
      const logoHeight = 132;
      const logoWidth = Math.min(180, (headerLogo.naturalWidth / headerLogo.naturalHeight) * logoHeight);
      ctx.drawImage(headerLogo, 58, 17, logoWidth, logoHeight);
    }

    ctx.fillStyle = "#ffffff";
    let schoolFontSize = 36;
    ctx.font = `700 ${schoolFontSize}px ${font}`;
    while (ctx.measureText(String(schoolName || "Escola")).width > 1010 && schoolFontSize > 24) {
      schoolFontSize -= 2;
      ctx.font = `700 ${schoolFontSize}px ${font}`;
    }
    ctx.fillText(String(schoolName || "Escola"), 285, 67);
    ctx.font = `600 23px ${font}`;
    ctx.fillText(
      isExpulsion ? "COMUNICADO DE EXPULSÃO" : "COMUNICADO DE SUSPENSÃO",
      285,
      116,
    );

    // Identificação do aluno.
    roundedRect(pagePadding, 205, contentWidth, 190, 24);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawLabel("Aluno", 100, 245);
    drawLabel("Turma", 840, 245);
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 32px ${font}`;
    drawWrapped(pending.aluno?.nome || "Aluno", 100, 286, 670, 38, 2);
    ctx.font = `700 27px ${font}`;
    drawWrapped(pending.turma?.nome || "—", 840, 286, 390, 34, 2);

    if (pending.aluno?.matricula) {
      ctx.fillStyle = "#64748b";
      ctx.font = `500 17px ${font}`;
      ctx.fillText(`Matrícula: ${pending.aluno.matricula}`, 100, 365);
    }

    // Card principal da medida.
    roundedRect(pagePadding, 425, contentWidth, 145, 24);
    ctx.fillStyle = isExpulsion ? "#fef2f2" : "#fff7ed";
    ctx.fill();
    ctx.strokeStyle = isExpulsion ? "#fecaca" : "#fed7aa";
    ctx.stroke();

    ctx.fillStyle = isExpulsion ? "#b91c1c" : "#b45309";
    ctx.font = `700 17px ${font}`;
    ctx.fillText(isExpulsion ? "MEDIDA DISCIPLINAR" : "SUSPENSÃO", 100, 463);

    ctx.fillStyle = "#0f172a";
    ctx.font = `700 31px ${font}`;
    ctx.fillText(
      isExpulsion ? "3ª suspensão — expulsão" : `${numeroSuspensao}ª suspensão`,
      100,
      510,
    );

    if (!isExpulsion) {
      ctx.textAlign = "right";
      ctx.font = `700 30px ${font}`;
      ctx.fillText(`${currentDays} ${plural(currentDays, "dia", "dias")}`, 1260, 510);
      ctx.font = `600 17px ${font}`;
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${formatDate(currentStart)} até ${formatDate(currentEnd)}`, 1260, 546);
      ctx.textAlign = "left";
    }

    // Motivo e ocorrência em blocos com tipografia maior.
    drawLabel("Motivo", 90, 635);
    ctx.fillStyle = "#334155";
    ctx.font = `600 21px ${font}`;
    drawWrapped(
      isExpulsion
        ? "O aluno atingiu a 3ª suspensão, resultando em expulsão."
        : `O aluno atingiu ${ocorrenciasAteLimite} ocorrências.`,
      90,
      671,
      1220,
      30,
      2,
    );

    drawLabel("Ocorrência que gerou a medida", 90, 745);
    ctx.fillStyle = "#334155";
    ctx.font = `500 20px ${font}`;
    drawWrapped(
      pending.occurrence?.descricao || "Não informado",
      90,
      781,
      1220,
      29,
      2,
    );

    ctx.fillStyle = "#64748b";
    ctx.font = `600 18px ${font}`;
    ctx.fillText(`👨‍🏫 Professor responsável: ${professorResponsavel}`, 90, 866);

    // Rodapé oficial usando topo_mini.png.
    const footer = await loadImage(topoMini);
    if (footer?.naturalWidth) {
      ctx.drawImage(footer, 0, 1000, canvas.width, 120);
    }

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.98));
  };

  const copyText = async (value = expulsionNotice ? textoExpulsao : textoCompartilhamento) => {
    try {
      await navigator.clipboard?.writeText(value);
      setNotice("Comunicado copiado para compartilhar.");
    } catch {
      setNotice("Não foi possível copiar o comunicado.");
    }
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
      const file = new File([blob], `${isExpulsion ? "expulsao" : "suspensao"}.png`, {
        type: "image/png",
      });

      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: isExpulsion ? "Comunicado de Expulsão" : "Comunicado de Suspensão",
          text,
          files: [file],
        });
      } else {
        await navigator.clipboard?.writeText(text);
        setNotice("A imagem não pode ser compartilhada neste dispositivo. O texto foi copiado.");
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
      if (!pending.alreadyApplied) {
        await onConfirm?.(pending, {
          days: Number(days),
          startDate,
          endDate,
        });
      }

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

  if (!pending) return null;

  const studentData = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aluno</p>
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">{pending.aluno?.nome || "—"}</p>
        {pending.aluno?.matricula && (
          <p className="mt-1 text-xs text-slate-500">Matrícula: {pending.aluno.matricula}</p>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turma</p>
        <p className="mt-1 text-lg font-bold text-slate-900">{pending.turma?.nome || "—"}</p>
      </div>
    </div>
  );

  return (
    <div className="font-inter">
      <Modal isOpen={!expulsionNotice} onClose={() => onDismiss?.(null)} title="Decisão de suspensão">
        <div className="space-y-5 font-inter">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><FaExclamationTriangle /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Ação necessária</p>
                <p className="text-base font-bold text-slate-900">Este aluno será suspenso</p>
                <p className="text-xs font-medium text-slate-500">Informe a duração antes de concluir.</p>
              </div>
            </div>
            {totalPendentes > 1 && <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">{totalPendentes} pendentes</span>}
          </div>

          {studentData}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-amber-900">Ocorrência que acionou a suspensão</p>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">{formatDate(pending.occurrence?.data_ocorrido)}</span>
            </div>
            <p className="mt-2 text-base font-medium leading-6 text-amber-900">{pending.occurrence?.descricao || "Descrição não informada."}</p>
            <p className="mt-2 text-sm font-semibold text-amber-700">Situação: {pending.occurrence?.tipo || "Ocorrência"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Suspensão</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{numeroSuspensao}ª suspensão</p>
            {resultaraEmExpulsao && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">🚨 Esta é a 3ª suspensão e resultará em expulsão.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Duração da suspensão</span>
              <div className="relative">
                <FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value === "" ? "" : e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>
              <span className="mt-1 block text-xs font-medium text-slate-500">O professor define quantos dias o aluno ficará suspenso.</span>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Início</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
              <span className="mt-1 block text-xs font-medium text-slate-500">Término calculado: <strong>{formatDate(endDate)}</strong></span>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Motivo</p><p className="mt-1 text-sm font-bold text-slate-900">O aluno atingiu {ocorrenciasAteLimite} ocorrências.</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Período</p><p className="mt-1 text-sm font-bold text-slate-900">{formatDate(startDate)} até {formatDate(endDate)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Professor</p><p className="mt-1 text-sm font-bold text-slate-900">{professorResponsavel}</p></div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => copyText()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FaCopy /> Copiar texto</button>
            <button type="button" onClick={() => downloadImage()} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FaDownload /> Baixar imagem</button>
            <button type="button" onClick={() => shareImage()} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 transition hover:bg-green-100 disabled:opacity-50"><FaShareAlt /> Compartilhar</button>
          </div>

          {notice && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{notice}</div>}

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="button" onClick={confirmSuspension} disabled={saving || Number(days) < 1 || !startDate || !endDate} className="rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Registrando..." : "Confirmar suspensão"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(expulsionNotice)} onClose={closeExpulsion} title="Expulsão do aluno">
        {expulsionNotice && (
          <div className="space-y-5 font-inter">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><FaExclamationTriangle /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Medida disciplinar final</p>
                  <h3 className="mt-1 text-xl font-bold text-red-900">O aluno será expulso</h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-red-800">A 3ª suspensão foi registrada e resulta em expulsão.</p>
                </div>
              </div>
            </div>
            {studentData}
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-red-600">Motivo da expulsão</p>
              <p className="mt-1 text-base font-bold text-red-900">O aluno atingiu a 3ª suspensão.</p>
              <p className="mt-2 text-sm font-medium leading-6 text-red-800">📌 Ocorrência: {expulsionNotice.pending.occurrence?.descricao || "Não informado"}</p>
              <p className="mt-2 text-sm font-bold text-red-700">👨‍🏫 Professor responsável: {professorResponsavel}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medida</p><p className="mt-1 text-lg font-bold text-slate-900">3ª suspensão — expulsão</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Período</p><p className="mt-1 text-lg font-bold text-slate-900">{formatDate(expulsionNotice.startDate)} até {formatDate(expulsionNotice.endDate)}</p><p className="mt-1 text-sm font-medium text-slate-500">{expulsionNotice.days} {plural(expulsionNotice.days, "dia", "dias")}</p></div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => copyText(textoExpulsao)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FaCopy /> Copiar texto</button>
              <button type="button" onClick={() => downloadImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FaDownload /> Baixar imagem</button>
              <button type="button" onClick={() => shareImage(true, expulsionNotice)} disabled={sharing} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"><FaShareAlt /> Compartilhar</button>
            </div>
            {notice && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{notice}</div>}
            <div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" onClick={closeExpulsion} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800">Concluir</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
