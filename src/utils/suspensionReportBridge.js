import { FaCopy, FaDownload, FaShareAlt } from "react-icons/fa";

const formatDateForReport = (value) => value || "—";

const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[char]));

const getReportData = (card, selectedStudent) => {
  const text = card.innerText.replace(/\s+/g, " ").trim();
  const periodMatch = text.match(/Período:\s*(\d{2}\/\d{2}\/\d{4})\s*até\s*(\d{2}\/\d{2}\/\d{4})/i);
  const numberMatch = text.match(/(?:Suspensão|Gerou suspensão)\s*#(\d+)/i);
  const descriptionMatch = text.match(/Descrição\s+(.+?)\s+Professor\s+/i);
  const professorMatch = text.match(/Professor\s+(.+?)\s+Aplicação\s+/i);
  const totalMatch = text.match(/atingiu\s+(\d+)\s+ocorrências?/i);
  const dates = periodMatch ? [periodMatch[1], periodMatch[2]] : ["—", "—"];
  const start = dates[0] === "—" ? "" : dates[0];
  const end = dates[1] === "—" ? "" : dates[1];

  let days = 1;
  if (start && end) {
    const [sd, sm, sy] = start.split("/").map(Number);
    const [ed, em, ey] = end.split("/").map(Number);
    days = Math.max(1, Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1);
  }

  return {
    aluno: selectedStudent?.nome || "Aluno",
    turma: selectedStudent?.turma || "—",
    numero: numberMatch?.[1] || "1",
    days,
    inicio: dates[0],
    fim: dates[1],
    totalOcorrencias: totalMatch?.[1] || "3",
    descricao: descriptionMatch?.[1] || "Não informado",
    professor: professorMatch?.[1] || "Não informado",
  };
};

const reportText = (data) => `🚨 COMUNICADO DE SUSPENSÃO\n\nAluno: ${data.aluno}\nTurma: ${data.turma}\n\nSuspensão: ${data.numero}ª\nDuração: ${data.days} ${data.days === 1 ? "dia" : "dias"}\nPeríodo: ${data.inicio} até ${data.fim}\n\nMotivo: O aluno atingiu ${data.totalOcorrencias} ocorrências.\nOcorrência que gerou a medida: ${data.descricao}\nProfessor responsável: ${data.professor}\n\nRegistro realizado pelo LogZélia – Sistema de Gestão Escolar.`;

const createReportBlob = async (data) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#166534";
  ctx.fillRect(0, 0, canvas.width, 170);

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 40px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("COMUNICADO DE SUSPENSÃO", 80, 85);
  ctx.font = '600 23px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("LogZélia • Gestão Escolar", 80, 128);

  const box = (x, y, w, h, fill = "#ffffff", stroke = "#e2e8f0") => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.fill();
    ctx.stroke();
  };

  box(70, 215, 1260, 185);
  ctx.fillStyle = "#64748b";
  ctx.font = '700 17px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("ALUNO", 100, 255);
  ctx.fillText("TURMA", 880, 255);
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 32px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.aluno).slice(0, 42), 100, 300);
  ctx.font = '700 27px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.turma).slice(0, 25), 880, 300);

  box(70, 430, 1260, 150, "#fff7ed", "#fed7aa");
  ctx.fillStyle = "#b45309";
  ctx.font = '700 17px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("SUSPENSÃO", 100, 468);
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 30px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${data.numero}ª suspensão`, 100, 515);
  ctx.textAlign = "right";
  ctx.fillText(`${data.days} ${data.days === 1 ? "dia" : "dias"}`, 1300, 515);
  ctx.font = '600 17px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#64748b";
  ctx.fillText(`${data.inicio} até ${data.fim}`, 1300, 550);
  ctx.textAlign = "left";

  ctx.fillStyle = "#64748b";
  ctx.font = '700 17px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("MOTIVO", 90, 645);
  ctx.fillStyle = "#334155";
  ctx.font = '600 23px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(`O aluno atingiu ${data.totalOcorrencias} ocorrências.`, 90, 685);

  ctx.fillStyle = "#64748b";
  ctx.font = '700 17px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("OCORRÊNCIA QUE GEROU A MEDIDA", 90, 745);
  ctx.fillStyle = "#334155";
  ctx.font = '500 21px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.descricao).slice(0, 100), 90, 785);

  ctx.fillStyle = "#64748b";
  ctx.font = '600 18px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Professor responsável: ${String(data.professor).slice(0, 70)}`, 90, 875);
  ctx.fillStyle = "#94a3b8";
  ctx.font = '500 16px Inter, "Segoe UI", Arial, sans-serif';
  ctx.fillText("Registro realizado pelo LogZélia – Sistema de Gestão Escolar.", 90, 1010);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.98));
};

const createButton = (label, icon, className = "") => {
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `${icon}<span>${label}</span>`;
  button.className = `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${className}`;
  return button;
};

export function installSuspensionReportBridge() {
  if (typeof window === "undefined" || window.__logzeliaSuspensionReportBridge) return () => {};
  window.__logzeliaSuspensionReportBridge = true;

  let selectedStudent = { nome: "Aluno", turma: "—" };

  const rememberStudent = (target) => {
    const button = target.closest?.('[data-cy="student-name-button"]');
    if (!button) return;
    const row = button.closest("tr");
    const cells = row ? Array.from(row.querySelectorAll("td")) : [];
    selectedStudent = {
      nome: button.textContent.trim(),
      turma: cells[2]?.textContent.trim() || "—",
    };
  };

  const addActions = () => {
    if (!window.location.pathname.includes("/app/advertencias")) return;

    document.querySelectorAll("div.rounded-2xl.border.p-4").forEach((card) => {
      if (card.dataset.suspensionReportReady === "true") return;
      const text = card.innerText || "";
      if (!/(Suspensão|suspensão)\s*#\d+/.test(text)) return;
      card.dataset.suspensionReportReady = "true";

      const actions = document.createElement("div");
      actions.className = "logzelia-suspension-report-actions mt-1 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700";

      const copyButton = createButton("Copiar texto", "", "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700");
      const downloadButton = createButton("Baixar imagem", "", "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700");
      const shareButton = createButton("Compartilhar", "", "border-green-200 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300 dark:hover:bg-green-950/50");

      const getData = () => getReportData(card, selectedStudent);

      copyButton.onclick = async () => {
        await navigator.clipboard?.writeText(reportText(getData()));
        copyButton.querySelector("span").textContent = "Copiado!";
        setTimeout(() => { copyButton.querySelector("span").textContent = "Copiar texto"; }, 1600);
      };

      downloadButton.onclick = async () => {
        const blob = await createReportBlob(getData());
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `suspensao-${selectedStudent.nome.replace(/\s+/g, "-").toLowerCase()}.png`;
        anchor.click();
        URL.revokeObjectURL(url);
      };

      shareButton.onclick = async () => {
        const data = getData();
        const blob = await createReportBlob(data);
        if (!blob) return;
        const file = new File([blob], "comunicado-suspensao.png", { type: "image/png" });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: "Comunicado de Suspensão", text: reportText(data), files: [file] }).catch(() => {});
        } else {
          await navigator.clipboard?.writeText(reportText(data));
          shareButton.querySelector("span").textContent = "Texto copiado";
          setTimeout(() => { shareButton.querySelector("span").textContent = "Compartilhar"; }, 1800);
        }
      };

      actions.append(copyButton, downloadButton, shareButton);
      card.appendChild(actions);
    });
  };

  const onClick = (event) => {
    rememberStudent(event.target);
    setTimeout(addActions, 0);
  };

  document.addEventListener("click", onClick, true);
  const observer = new MutationObserver(addActions);
  observer.observe(document.body, { childList: true, subtree: true });
  addActions();

  return () => {
    document.removeEventListener("click", onClick, true);
    observer.disconnect();
    delete window.__logzeliaSuspensionReportBridge;
  };
}
