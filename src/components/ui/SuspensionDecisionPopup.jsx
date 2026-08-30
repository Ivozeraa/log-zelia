import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt, FaDownload, FaShareAlt, FaCopy, FaTimes, FaExclamationTriangle } from "react-icons/fa";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../hooks/useAuth";
import logo from "../../assets/images/logo.png";

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + Number(days) - 1);
  return date.toISOString().slice(0, 10);
};

const getToday = () => new Date().toISOString().slice(0, 10);

export function SuspensionDecisionPopup() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState(null);
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(getToday());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");

  const endDate = useMemo(() => {
    if (!startDate || !days || Number(days) < 1) return "";
    return addDays(startDate, days);
  }, [startDate, days]);

  useEffect(() => {
    if (loading || !user) return undefined;
    let cancelled = false;
    const loadPending = async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, aluno_id, aluno_nome, mensagem, criado_em, ocorrencia_id, acao, dados")
        .eq("usuario_id", user.id)
        .eq("acao", "definir_suspensao")
        .eq("lida", false)
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled && !error && data) setPending(data);
    };
    void loadPending();
    const interval = window.setInterval(loadPending, 4000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [loading, user]);

  const dados = pending?.dados || {};
  const textoCompartilhamento = pending
    ? `Aluno: ${dados.aluno_nome || pending.aluno_nome}\nTurma: ${dados.turma_nome || "—"}\nSuspensão: ${dados.suspensoes ? `${dados.suspensoes + 1}ª suspensão` : "Suspensão disciplinar"}\nDuração: ${days} ${Number(days) === 1 ? "dia" : "dias"}\nPeríodo: ${formatDate(startDate)} até ${formatDate(endDate)}\n\nMotivo/ocorrência: ${dados.descricao || "Não informado"}`
    : "";

  const createImageBlob = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx || !pending) return null;

    const gradient = ctx.createLinearGradient(0, 0, 1400, 260);
    gradient.addColorStop(0, "#166534");
    gradient.addColorStop(1, "#0f766e");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 250);

    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = logo;
      await new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
      if (image.naturalWidth) ctx.drawImage(image, 80, 55, 150, 150);
    } catch {}

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 48px Arial";
    ctx.fillText("LogZélia", 270, 110);
    ctx.font = "500 26px Arial";
    ctx.fillText("COMUNICADO DE SUSPENSÃO", 270, 155);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial";
    ctx.fillText("Aluno", 90, 340);
    ctx.font = "600 38px Arial";
    ctx.fillText(dados.aluno_nome || pending.aluno_nome || "Aluno", 90, 390);
    ctx.font = "700 26px Arial";
    ctx.fillText("Turma", 90, 455);
    ctx.font = "500 30px Arial";
    ctx.fillText(dados.turma_nome || "—", 90, 495);
    ctx.fillStyle = "#b45309";
    ctx.font = "700 28px Arial";
    ctx.fillText("Suspensão", 90, 575);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial";
    ctx.fillText(`${dados.suspensoes ? `${dados.suspensoes + 1}ª` : ""} suspensão`, 90, 620);
    ctx.font = "700 28px Arial";
    ctx.fillText("Duração", 700, 575);
    ctx.font = "700 34px Arial";
    ctx.fillText(`${days} ${Number(days) === 1 ? "dia" : "dias"}`, 700, 620);
    ctx.font = "500 24px Arial";
    ctx.fillText(`${formatDate(startDate)} até ${formatDate(endDate)}`, 700, 665);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(70, 735, 1260, 2);
    ctx.fillStyle = "#64748b";
    ctx.font = "500 20px Arial";
    ctx.fillText("Registro gerado pelo LogZélia • Sistema de gestão escolar", 90, 790);
    ctx.fillText(`Emitido em ${formatDate(getToday())}`, 90, 825);
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 875, 470, 25);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(470, 875, 470, 25);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(940, 875, 460, 25);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };

  const downloadImage = async () => {
    setSharing(true);
    const blob = await createImageBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `suspensao-${(dados.aluno_nome || pending?.aluno_nome || "aluno").replace(/\s+/g, "-").toLowerCase()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    setSharing(false);
  };

  const shareImage = async () => {
    setSharing(true);
    try {
      const blob = await createImageBlob();
      if (!blob) return;
      const file = new File([blob], "comunicado-suspensao.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "Comunicado de Suspensão", text: textoCompartilhamento, files: [file] });
      } else {
        await navigator.clipboard?.writeText(textoCompartilhamento);
        setNotice("Seu dispositivo não permite compartilhar a imagem. O texto foi copiado.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    } finally { setSharing(false); }
  };

  const copyText = async () => {
    await navigator.clipboard?.writeText(textoCompartilhamento);
    setNotice("Texto da suspensão copiado.");
  };

  const confirmSuspension = async () => {
    if (!pending || Number(days) < 1 || !startDate) return;
    setSaving(true);
    setNotice("");
    const { data: occurrence, error } = await supabase
      .from("ocorrencias")
      .insert({
        escola_id: dados.escola_id || user.escola_id,
        aluno_id: pending.aluno_id,
        professor_id: user.id,
        professor_nome: user.nome,
        turma_id: dados.turma_id,
        data_ocorrido: dados.data_ocorrido || getToday(),
        data_aplicacao: new Date().toISOString(),
        data_inicio: startDate,
        data_fim: endDate,
        tipo: dados.tipo,
        categoria: "suspensao",
        descricao: `Suspensão decorrente da ocorrência: ${dados.descricao || "Não informado"}`,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setNotice("Não foi possível registrar a suspensão.");
      setSaving(false);
      return;
    }

    await supabase.from("notificacoes").update({ lida: true }).eq("id", pending.id).eq("usuario_id", user.id);
    setPending(null);
    setSaving(false);
    setNotice(occurrence ? "Suspensão registrada com sucesso." : "Suspensão registrada.");
  };

  if (!pending || !user) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-5 py-6 text-white sm:px-7">
          <button type="button" onClick={() => setPending(null)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="Fechar"><FaTimes /></button>
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><FaExclamationTriangle /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-white/80">Ação necessária</p><h2 className="text-xl font-black sm:text-2xl">Aluno atingiu o limite de ocorrências</h2></div></div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Aluno</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{dados.aluno_nome || pending.aluno_nome}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Turma</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{dados.turma_nome || "—"}</p></div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-sm font-bold text-amber-900 dark:text-amber-200">Ocorrência que gerou o alerta</p><p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{dados.descricao || "Descrição não informada."}</p><p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">{formatDate(dados.data_ocorrido)} • {dados.tipo || "Ocorrência"}</p></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Duração da suspensão</span><div className="relative"><FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" min="1" step="1" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><span className="mt-1 block text-xs text-slate-500">Informe quantos dias o aluno ficará suspenso.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Início</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><span className="mt-1 block text-xs text-slate-500">Término calculado: <strong>{formatDate(endDate)}</strong></span></label>
          </div>

          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-inner"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Resumo</p><p className="mt-2 text-xl font-black">Suspensão: {dados.suspensoes ? `${dados.suspensoes + 1}ª` : "1ª"}</p><p className="mt-1 text-sm text-slate-300">Duração: <strong className="text-white">{days} {Number(days) === 1 ? "dia" : "dias"}</strong> • {formatDate(startDate)} até {formatDate(endDate)}</p></div>
          {notice && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">{notice}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={copyText} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><FaCopy /> Copiar texto</button>
            <button type="button" onClick={downloadImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><FaDownload /> Baixar imagem</button>
            <button type="button" onClick={shareImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-100 disabled:opacity-50 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"><FaShareAlt /> Compartilhar</button>
            <button type="button" onClick={confirmSuspension} disabled={saving || Number(days) < 1} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Registrando..." : "Confirmar suspensão"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
