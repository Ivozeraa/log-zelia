import { useMemo, useState } from "react";
import { FaCopy, FaDownload, FaShareAlt } from "react-icons/fa";
import logoLogin from "../../assets/images/logo-login.png";
import topoMini from "../../assets/images/topo_mini.png";

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const plural = (value, singular, pluralValue) => Number(value) === 1 ? singular : pluralValue;

const addDays = (value, amount) => {
  if (!value || Number(amount) < 1) return "";
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + Number(amount) - 1);
  return date.toISOString().slice(0, 10);
};

const loadImage = (src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

export function SuspensionReportActions({
  suspension,
  aluno,
  turmaName,
  originOccurrence,
  ocorrenciasAteLimite,
  numeroSuspensao = 1,
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const startDate = suspension?.data_inicio || suspension?.data_ocorrido || "";
  const endDate = suspension?.data_fim || startDate;
  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }, [startDate, endDate]);

  const totalOcorrencias = Number(ocorrenciasAteLimite || 3);
  const professorResponsavel = originOccurrence?.professor_nome || suspension?.professor_nome || "Não informado";
  const motivo = originOccurrence?.descricao || "Não informado";
  const periodoFim = endDate || addDays(startDate, days);

  const text = `🚨 *COMUNICADO DE SUSPENSÃO*\n\n*Aluno:* ${aluno?.nome || "Aluno"}\n*Turma:* ${turmaName || "—"}\n\n*Suspensão:* ${numeroSuspensao}ª\n*Duração:* ${days} ${plural(days, "dia", "dias")}\n\n📅 *Período:* ${formatDate(startDate)} até ${formatDate(periodoFim)}\n\n*Motivo:* O aluno atingiu ${totalOcorrencias} ocorrências.\n\n*Ocorrência que gerou a suspensão:* ${motivo}\n\n👨‍🏫 *Professor responsável:* ${professorResponsavel}\n\n_Registro realizado pelo LogZélia – Sistema de Gestão Escolar._`;

  const createImageBlob = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const font = 'Inter, "Segoe UI", Arial, sans-serif';
    const padding = 70;
    const width = canvas.width - padding * 2;

    const roundedRect = (x, y, w, h, radius) => {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const wrap = (value, maxWidth, maxLines = 2) => {
      const words = String(value || "—").split(/\s+/);
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && ctx.measureText(candidate).width > maxWidth) {
          lines.push(current);
          current = word;
        } else current = candidate;
      }
      if (current) lines.push(current);
      if (lines.length <= maxLines) return lines;
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.…]+$/, "")}…`;
      return clipped;
    };

    const drawWrapped = (value, x, y, maxWidth, lineHeight, maxLines = 2) => {
      wrap(value, maxWidth, maxLines).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    };

    const label = (value, x, y) => {
      ctx.fillStyle = "#64748b";
      ctx.font = `700 17px ${font}`;
      ctx.fillText(value.toUpperCase(), x, y);
    };

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, canvas.width, 165);

    const logo = await loadImage(logoLogin);
    if (logo?.naturalWidth) {
      const h = 132;
      const w = Math.min(180, (logo.naturalWidth / logo.naturalHeight) * h);
      ctx.drawImage(logo, 58, 17, w, h);
    }

    ctx.fillStyle = "#fff";
    let schoolFontSize = 36;
    ctx.font = `700 ${schoolFontSize}px ${font}`;
    ctx.fillText("COMUNICADO DE SUSPENSÃO", 285, 116);
    ctx.font = `600 23px ${font}`;
    ctx.fillText("LogZélia • Gestão Escolar", 285, 67);

    roundedRect(padding, 205, width, 190, 24);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();
    label("Aluno", 100, 245);
    label("Turma", 840, 245);
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 32px ${font}`;
    drawWrapped(aluno?.nome || "Aluno", 100, 286, 670, 38, 2);
    ctx.font = `700 27px ${font}`;
    drawWrapped(turmaName || "—", 840, 286, 390, 34, 2);
    if (aluno?.matricula) {
      ctx.fillStyle = "#64748b";
      ctx.font = `500 17px ${font}`;
      ctx.fillText(`Matrícula: ${aluno.matricula}`, 100, 365);
    }

    roundedRect(padding, 425, width, 145, 24);
    ctx.fillStyle = "#fff7ed";
    ctx.fill();
    ctx.strokeStyle = "#fed7aa";
    ctx.stroke();
    ctx.fillStyle = "#b45309";
    ctx.font = `700 17px ${font}`;
    ctx.fillText("SUSPENSÃO", 100, 463);
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 31px ${font}`;
    ctx.fillText(`${numeroSuspensao}ª suspensão`, 100, 510);
    ctx.textAlign = "right";
    ctx.font = `700 30px ${font}`;
    ctx.fillText(`${days} ${plural(days, "dia", "dias")}`, 1260, 510);
    ctx.font = `600 17px ${font}`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${formatDate(startDate)} até ${formatDate(periodoFim)}`, 1260, 546);
    ctx.textAlign = "left";

    label("Motivo", 90, 635);
    ctx.fillStyle = "#334155";
    ctx.font = `600 21px ${font}`;
    drawWrapped(`O aluno atingiu ${totalOcorrencias} ocorrências.`, 90, 671, 1220, 30, 2);
    label("Ocorrência que gerou a medida", 90, 745);
    ctx.fillStyle = "#334155";
    ctx.font = `500 20px ${font}`;
    drawWrapped(motivo, 90, 781, 1220, 29, 2);
    ctx.fillStyle = "#64748b";
    ctx.font = `600 18px ${font}`;
    ctx.fillText(`👨‍🏫 Professor responsável: ${professorResponsavel}`, 90, 866);

    const footer = await loadImage(topoMini);
    if (footer?.naturalWidth) ctx.drawImage(footer, 0, 1000, canvas.width, 120);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.98));
  };

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setNotice("Comunicado copiado.");
    } catch {
      setNotice("Não foi possível copiar o comunicado.");
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await createImageBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `suspensao-${(aluno?.nome || "aluno").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await createImageBlob();
      if (!blob) return;
      const file = new File([blob], "suspensao.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "Comunicado de Suspensão", text, files: [file] });
      } else {
        await navigator.clipboard?.writeText(text);
        setNotice("Seu dispositivo não permite compartilhar a imagem. O texto foi copiado.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
      <button type="button" onClick={copy} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
        <FaCopy /> Copiar texto
      </button>
      <button type="button" onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
        <FaDownload /> Baixar imagem
      </button>
      <button type="button" onClick={share} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300 dark:hover:bg-green-950/50">
        <FaShareAlt /> Compartilhar
      </button>
      {notice && <span className="w-full text-right text-xs font-medium text-slate-500 dark:text-slate-400">{notice}</span>}
    </div>
  );
}
