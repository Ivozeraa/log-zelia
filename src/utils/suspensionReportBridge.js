import logoLogin from "../assets/images/logo-login.png";
import topoMini from "../assets/images/topo_mini.png";

const formatDateForReport = (value) => value || "—";

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
    days = Math.max(
      1,
      Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1,
    );
  }

  const descricaoBruta = descriptionMatch?.[1] || "Não informado";
  const motivoProfessorMatch = descricaoBruta.match(/Motivo\s+do\s+professor:\s*(.+)$/i);
  const motivoProfessor = motivoProfessorMatch?.[1]?.trim() || descricaoBruta;
  const ocorrenciaResumo = `O aluno atingiu ${totalMatch?.[1] || "3"} ocorrências.`;

  return {
    aluno: selectedStudent?.nome || "Aluno",
    turma: selectedStudent?.turma || "—",
    numero: numberMatch?.[1] || "1",
    days,
    inicio: dates[0],
    fim: dates[1],
    totalOcorrencias: totalMatch?.[1] || "3",
    motivoOcorrencias: ocorrenciaResumo,
    motivoProfessor,
    descricao: descricaoBruta,
    professor: professorMatch?.[1] || "Não informado",
  };
};

const reportText = (data) =>
  `🚨 *COMUNICADO DE SUSPENSÃO*\n\n*Aluno:* ${data.aluno}\n*Turma:* ${data.turma}\n\n*Suspensão:* ${data.numero}ª\n*Duração:* ${data.days} ${data.days === 1 ? "dia" : "dias"}\n\n📅 *Período: ${data.inicio} até ${data.fim}*\n\n*Motivo da suspensão:* ${data.motivoOcorrencias}\n\n*Motivo informado pelo professor:* ${data.motivoProfessor}\n\n👨‍🏫 *Professor responsável:* ${data.professor}\n\n_Registro realizado pelo LogZélia – Sistema de Gestão Escolar._`;

const loadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback abaixo para navegadores/dispositivos que bloqueiam clipboard.writeText.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
};

const drawImageContain = (ctx, image, x, y, width, height) => {
  if (!image?.naturalWidth || !image?.naturalHeight) return false;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  return true;
};

const drawImageCoverBottom = (ctx, image, x, bottomY, width, height) => {
  if (!image?.naturalWidth || !image?.naturalHeight) return false;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = bottomY - drawHeight;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, bottomY - height, width, height);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
  return true;
};

const createReportBlob = async (data) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 1260;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const font = 'Inter, "Segoe UI", Arial, sans-serif';
  const logo = await loadImage(logoLogin);
  const footer = await loadImage(topoMini);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cabeçalho institucional.
  ctx.fillStyle = "#166534";
  ctx.fillRect(0, 0, canvas.width, 175);

  // Logo ampliada.
  if (logo) {
    drawImageContain(ctx, logo, 20, 0, 295, 175);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 38px ${font}`;
  ctx.fillText("COMUNICADO DE SUSPENSÃO", 335, 74);
  ctx.font = `600 23px ${font}`;
  ctx.fillText("LogZélia • Gestão Escolar", 335, 117);

  const box = (x, y, w, h, fill = "#ffffff", stroke = "#e2e8f0") => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.fill();
    ctx.stroke();
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
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
    if (lines.length <= maxLines) return lines;

    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.…]+$/, "")}…`;
    return clipped;
  };

  const drawWrapped = (value, x, y, maxWidth, lineHeight, maxLines = 2) => {
    wrap(value, maxWidth, maxLines).forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
  };

  const label = (value, x, y, color = "#64748b") => {
    ctx.fillStyle = color;
    ctx.font = `700 17px ${font}`;
    ctx.fillText(value.toUpperCase(), x, y);
  };

  box(70, 215, 1260, 185);
  label("Aluno", 100, 255);
  label("Turma", 880, 255);

  ctx.fillStyle = "#0f172a";
  ctx.font = `700 32px ${font}`;
  drawWrapped(data.aluno, 100, 300, 670, 38, 2);
  ctx.font = `700 27px ${font}`;
  drawWrapped(data.turma, 880, 300, 380, 34, 2);

  box(70, 430, 1260, 150, "#fff7ed", "#fed7aa");
  ctx.fillStyle = "#b45309";
  ctx.font = `700 17px ${font}`;
  ctx.fillText("SUSPENSÃO", 100, 468);

  ctx.fillStyle = "#0f172a";
  ctx.font = `700 30px ${font}`;
  ctx.fillText(`${data.numero}ª suspensão`, 100, 515);
  ctx.textAlign = "right";
  ctx.fillText(`${data.days} ${data.days === 1 ? "dia" : "dias"}`, 1300, 515);
  ctx.font = `600 17px ${font}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText(`${data.inicio} até ${data.fim}`, 1300, 550);
  ctx.textAlign = "left";

  // Campos brancos, no mesmo padrão visual do primeiro modelo.
  box(70, 610, 1260, 145, "#ffffff", "#e2e8f0");
  label("Motivo da suspensão (limite de ocorrências)", 100, 650, "#64748b");
  ctx.fillStyle = "#1e293b";
  ctx.font = `600 23px ${font}`;
  drawWrapped(data.motivoOcorrencias, 100, 695, 1180, 31, 2);

  box(70, 780, 1260, 190, "#ffffff", "#e2e8f0");
  label("Motivo informado pelo professor", 100, 820, "#64748b");
  ctx.fillStyle = "#334155";
  ctx.font = `500 21px ${font}`;
  drawWrapped(data.motivoProfessor, 100, 865, 1180, 30, 3);

  ctx.fillStyle = "#64748b";
  ctx.font = `600 18px ${font}`;
  drawWrapped(`👨‍🏫 Professor responsável: ${data.professor}`, 100, 1005, 1180, 25, 2);

  // Footer fica exatamente no limite inferior do canvas e usa somente o topo_mini.
  if (footer) {
    drawImageCoverBottom(ctx, footer, 0, canvas.height, canvas.width, 160);
  }

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
        const copied = await copyText(reportText(getData()));
        copyButton.querySelector("span").textContent = copied ? "Copiado!" : "Falha ao copiar";
        setTimeout(() => {
          copyButton.querySelector("span").textContent = "Copiar texto";
        }, 1600);
      };

      downloadButton.onclick = async () => {
        const blob = await createReportBlob(getData());
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `suspensao-${selectedStudent.nome.replace(/\s+/g, "-").toLowerCase()}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      shareButton.onclick = async () => {
        const data = getData();
        const text = reportText(data);
        const blob = await createReportBlob(data);
        if (!blob) return;

        const file = new File([blob], "comunicado-suspensao.png", { type: "image/png" });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          try {
            await navigator.share({
              title: "Comunicado de Suspensão",
              text,
              files: [file],
            });
            return;
          } catch (error) {
            if (error?.name === "AbortError") return;
          }
        }

        const copied = await copyText(text);
        shareButton.querySelector("span").textContent = copied ? "Texto copiado" : "Não foi possível compartilhar";
        setTimeout(() => {
          shareButton.querySelector("span").textContent = "Compartilhar";
        }, 1800);
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
