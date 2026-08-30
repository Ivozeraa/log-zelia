import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCalendarAlt,
  FaCopy,
  FaDownload,
  FaExclamationTriangle,
  FaShareAlt,
  FaTimes,
} from "react-icons/fa";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../hooks/useAuth";
import logo from "../../assets/images/logo.png";

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const today = () => new Date().toISOString().slice(0, 10);

const addDays = (value, amount) => {
  if (!value || !amount) return "";
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + Number(amount) - 1);
  return date.toISOString().slice(0, 10);
};

export function SuspensionDecisionPopup() {
  const { user, loading } = useAuth();
  const [queue, setQueue] = useState([]);
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const handledIds = useRef(new Set());

  const pending = queue[0] || null;
  const endDate = useMemo(
    () => addDays(startDate, days),
    [startDate, days],
  );

  const enqueueIfNeeded = async (occurrence) => {
    if (!occurrence?.id || occurrence.categoria !== "ocorrencia") return;
    if (handledIds.current.has(occurrence.id)) return;
    handledIds.current.add(occurrence.id);

    const { count, error: countError } = await supabase
      .from("ocorrencias")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", occurrence.aluno_id)
      .eq("categoria", "ocorrencia");

    if (countError || !count || count < 3 || count % 3 !== 0) return;

    const { data: alreadyApplied, error: suspensionError } = await supabase
      .from("ocorrencias")
      .select("id")
      .eq("aluno_id", occurrence.aluno_id)
      .eq("categoria", "suspensao")
      .eq("ocorrencia_origem_id", occurrence.id)
      .limit(1);

    if (suspensionError || alreadyApplied?.length) return;

    const [{ data: aluno }, { data: turma }, { count: suspensoes }] = await Promise.all([
      supabase.from("alunos").select("id, nome, matricula, turma_id").eq("id", occurrence.aluno_id).maybeSingle(),
      supabase.from("turmas").select("id, nome").eq("id", occurrence.turma_id).maybeSingle(),
      supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("aluno_id", occurrence.aluno_id).eq("categoria", "suspensao"),
    ]);

    setQueue((current) => [
      ...current,
      {
        occurrence,
        aluno: aluno || { id: occurrence.aluno_id, nome: occurrence.aluno_nome || "Aluno" },
        turma: turma || { nome: "—" },
        suspensoes: suspensoes || 0,
      },
    ]);
  };

  useEffect(() => {
    if (loading || !user?.id) return undefined;

    let cancelled = false;

    const loadRecent = async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("professor_id", user.id)
        .eq("categoria", "ocorrencia")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!cancelled && !error) {
        for (const occurrence of [...(data || [])].reverse()) {
          await enqueueIfNeeded(occurrence);
        }
      }
    };

    void loadRecent();

    const channel = supabase
      .channel(`suspensao-modal-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ocorrencias",
          filter: `professor_id=eq.${user.id}`,
        },
        (payload) => void enqueueIfNeeded(payload.new),
      )
      .subscribe();

    const interval = window.setInterval(loadRecent, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loading, user?.id]);

  useEffect(() => {
    if (!pending) return;
    setDays(1);
    setStartDate(today());
    setNotice("");
  }, [pending?.occurrence?.id]);

  const numeroSuspensao = (pending?.suspensoes || 0) + 1;
  const resultaraEmExpulsao = numeroSuspensao >= 3;

  const textoCompartilhamento = pending
    ? `Aluno: ${pending.aluno?.nome || "Aluno"}\nTurma: ${pending.turma?.nome || "—"}\nSuspensão: ${numeroSuspensao}ª${resultaraEmExpulsao ? " (resultará em expulsão)" : ""}\nDuração: ${days} ${Number(days) === 1 ? "dia" : "dias"}\nPeríodo: ${formatDate(startDate)} até ${formatDate(endDate)}\n\nOcorrência: ${pending.occurrence?.descricao || "Não informado"}`
    : "";

  const createImageBlob = async () => {
    if (!pending) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 950;
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
    ctx.font = "700 25px Arial";
    ctx.fillText("Turma", 90, 435);
    ctx.font = "500 30px Arial";
    ctx.fillText(pending.turma?.nome || "—", 90, 475);

    ctx.fillStyle = "#b45309";
    ctx.font = "700 27px Arial";
    ctx.fillText("Suspensão", 90, 550);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial";
    ctx.fillText(`${numeroSuspensao}ª suspensão`, 90, 595);

    ctx.font = "700 27px Arial";
    ctx.fillText("Duração", 700, 550);
    ctx.font = "700 34px Arial";
    ctx.fillText(`${days} ${Number(days) === 1 ? "dia" : "dias"}`, 700, 595);
    ctx.font = "500 23px Arial";
    ctx.fillText(`${formatDate(startDate)} até ${formatDate(endDate)}`, 700, 635);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 22px Arial";
    ctx.fillText("Ocorrência", 90, 695);
    ctx.font = "500 21px Arial";
    const description = pending.occurrence?.descricao || "Não informado";
    const words = description.split(" ");
    let line = "";
    let y = 730;
    for (const word of words) {
      const test = `${line}${word} `;
      if (ctx.measureText(test).width > 1220) {
        ctx.fillText(line.trim(), 90, y);
        line = `${word} `;
        y += 30;
      } else line = test;
      if (y > 805) break;
    }
    ctx.fillText(line.trim(), 90, y);

    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 915, 470, 35);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(470, 915, 470, 35);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(940, 915, 460, 35);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  };

  const copyText = async () => {
    await navigator.clipboard?.writeText(textoCompartilhamento);
    setNotice("Texto da suspensão copiado.");
  };

  const downloadImage = async () => {
    setSharing(true);
    const blob = await createImageBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `suspensao-${(pending?.aluno?.nome || "aluno").replace(/\s+/g, "-").toLowerCase()}.png`;
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
    } finally {
      setSharing(false);
    }
  };

  const confirmSuspension = async () => {
    if (!pending || Number(days) < 1 || !startDate) return;
    setSaving(true);
    setNotice("");

    const { error } = await supabase.from("ocorrencias").insert({
      escola_id: pending.occurrence.escola_id,
      aluno_id: pending.aluno.id,
      professor_id: user.id,
      professor_nome: user.nome,
      turma_id: pending.occurrence.turma_id,
      data_ocorrido: pending.occurrence.data_ocorrido,
      data_aplicacao: new Date().toISOString(),
      data_inicio: startDate,
      data_fim: endDate,
      tipo: pending.occurrence.tipo,
      categoria: "suspensao",
      descricao: `Suspensão decorrente da ocorrência: ${pending.occurrence.descricao || "Não informado"}`,
      ocorrencia_origem_id: pending.occurrence.id,
    });

    if (error) {
      console.error(error);
      setNotice("Não foi possível registrar a suspensão.");
      setSaving(false);
      return;
    }

    setQueue((current) => current.slice(1));
    setSaving(false);
    setNotice("Suspensão registrada com sucesso.");
  };

  if (!pending || !user) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-5 py-6 text-white sm:px-7">
          <button type="button" onClick={() => setQueue((current) => current.slice(1))} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="Fechar"><FaTimes /></button>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><FaExclamationTriangle /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/80">Ação necessária</p>
              <h2 className="text-xl font-black sm:text-2xl">Este aluno será suspenso</h2>
              <p className="mt-1 text-sm text-white/85">Informe a duração da suspensão antes de concluir.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Aluno</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{pending.aluno?.nome || "—"}</p>
              {pending.aluno?.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula: {pending.aluno.matricula}</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Turma</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{pending.turma?.nome || "—"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Ocorrência que acionou a suspensão</p>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">{pending.occurrence?.data_ocorrido ? formatDate(pending.occurrence.data_ocorrido) : "—"}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">{pending.occurrence?.descricao || "Descrição não informada."}</p>
            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">Situação: {pending.occurrence?.tipo || "Ocorrência"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suspensão</p>
            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{numeroSuspensao}ª suspensão</p>
            {resultaraEmExpulsao && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">🚨 Esta é a 3ª suspensão e o aluno será expulso após o registro.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Duração da suspensão</span>
              <div className="relative"><FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="number" min="1" step="1" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div>
              <span className="mt-1 block text-xs text-slate-500">O professor define quantos dias o aluno ficará suspenso.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Início</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              <span className="mt-1 block text-xs text-slate-500">Término calculado: <strong>{formatDate(endDate)}</strong></span>
            </label>
          </div>

          {notice && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">{notice}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={copyText} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><FaCopy /> Copiar texto</button>
            <button type="button" onClick={downloadImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><FaDownload /> Baixar imagem</button>
            <button type="button" onClick={shareImage} disabled={sharing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-100 disabled:opacity-50 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"><FaShareAlt /> Compartilhar</button>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setQueue((current) => current.slice(1))} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900">Decidir depois</button>
            <button type="button" onClick={confirmSuspension} disabled={saving} className="rounded-xl bg-green-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800 disabled:opacity-50">{saving ? "Registrando..." : "Confirmar suspensão"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
