import { useEffect, useState } from "react";
import { FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSchool } from "../hooks/useSchool";
import { scopePayload } from "../utils/schoolScope";
import { consolidarOcorrencias } from "../utils/disciplinaryMetrics";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormInput } from "../components/ui/FormInput";
import { CustomSelect } from "../components/ui/CustomSelect";
import { PageTitle } from "../components/ui/PageTitle";
import { SectionTitle } from "../components/ui/SectionTitle";
import { RankingOcorrencias } from "../components/ui/Ranking";
import { SuspensionDecisionPopup } from "../components/ui/SuspensionDecisionPopup";
import { notify } from "../utils/notify";

export const Home = () => {
  const { user } = useAuth();
  const { schoolId, isGlobalAdmin } = useSchool();
  const [open, setOpen] = useState(false);
  const [escolas, setEscolas] = useState([]);
  const [selectedEscola, setSelectedEscola] = useState("");
  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [alunos, setAlunos] = useState([]);
  const [selectedAlunos, setSelectedAlunos] = useState([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [dataOcorrido, setDataOcorrido] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");
  const [tipoAdvertencia, setTipoAdvertencia] = useState("");
  const [tipoSituacao, setTipoSituacao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [graficoData, setGraficoData] = useState([]);
  const [stats, setStats] = useState({ total: 0, mes: 0, semana: 0 });
  const [suspensionQueue, setSuspensionQueue] = useState([]);

  const activeSchoolId = isGlobalAdmin ? selectedEscola : schoolId || "";

  const resetForm = () => {
    setSelectedTurma("");
    setSelectedAlunos([]);
    setDataOcorrido("");
    setDataInicio("");
    setDataTermino("");
    setTipoAdvertencia("");
    setTipoSituacao("");
    setDescricao("");
    setFormMessage("");
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!activeSchoolId) {
        setStats({ total: 0, mes: 0, semana: 0 });
        setGraficoData([]);
        return;
      }

      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("escola_id", activeSchoolId);

      if (error) {
        console.error("Erro ao carregar dashboard:", error);
        return;
      }

      // Uma suspensão automática aponta para a ocorrência que atingiu o limite.
      // Para os indicadores, essa ocorrência de origem não é contada novamente:
      // o evento passa a ser representado pela suspensão uma única vez.
      const registros = consolidarOcorrencias(data || []);
      const total = registros.length;
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      const mes = registros.filter((o) => new Date(o.data_ocorrido) >= inicioMes).length;
      const semana = registros.filter((o) => new Date(o.data_ocorrido) >= inicioSemana).length;

      setStats({ total, mes, semana });

      const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const dadosSemana = diasSemana.map((name) => ({ name, ocorrencias: 0 }));
      registros.forEach((ocorrencia) => {
        if (!ocorrencia.data_ocorrido) return;
        const [ano, mesOcorrencia, dia] = ocorrencia.data_ocorrido.split("-").map(Number);
        const dataOcorrencia = new Date(ano, mesOcorrencia - 1, dia);
        dataOcorrencia.setHours(0, 0, 0, 0);
        if (dataOcorrencia >= inicioSemana) {
          dadosSemana[dataOcorrencia.getDay()].ocorrencias += 1;
        }
      });
      setGraficoData(dadosSemana);
    };

    loadDashboard();
  }, [activeSchoolId]);

  useEffect(() => {
    const loadEscolas = async () => {
      if (!user) return;
      const query = supabase.from("escolas").select("id, nome").order("nome", { ascending: true });

      if (isGlobalAdmin) {
        const { data, error } = await query;
        if (error) {
          notify.error("Erro carregando as escolas");
          console.error(error);
          setEscolas([]);
          return;
        }
        setEscolas(data || []);
        if (data?.length > 0 && !selectedEscola) setSelectedEscola(data[0].id);
        return;
      }

      if (!schoolId) {
        setEscolas([]);
        setSelectedEscola("");
        return;
      }

      const { data, error } = await query.eq("id", schoolId).maybeSingle();
      if (error) {
        notify.error("Erro carregando a escola");
        console.error(error);
        setEscolas([]);
        return;
      }
      setEscolas(data ? [data] : []);
      setSelectedEscola(schoolId);
    };
    loadEscolas();
  }, [user, schoolId, isGlobalAdmin, selectedEscola]);

  useEffect(() => {
    const loadTurmas = async () => {
      if (!activeSchoolId) {
        setTurmas([]);
        setSelectedTurma("");
        setAlunos([]);
        setSelectedAlunos([]);
        return;
      }
      setLoadingTurmas(true);
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome")
        .eq("escola_id", activeSchoolId)
        .order("nome", { ascending: true });
      if (error) {
        console.error(error);
        setTurmas([]);
      } else {
        setTurmas(data || []);
      }
      setLoadingTurmas(false);
    };
    loadTurmas();
  }, [activeSchoolId]);

  useEffect(() => {
    const loadAlunos = async () => {
      if (!selectedTurma) {
        setAlunos([]);
        setSelectedAlunos([]);
        return;
      }
      setLoadingAlunos(true);
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula")
        .eq("turma_id", selectedTurma)
        .order("nome", { ascending: true });
      if (error) {
        console.error(error);
        setAlunos([]);
      } else {
        setAlunos(data || []);
      }
      setLoadingAlunos(false);
    };
    loadAlunos();
  }, [selectedTurma]);

  useEffect(() => {
    if (!isGlobalAdmin && selectedEscola !== schoolId) setSelectedEscola(schoolId || "");
  }, [isGlobalAdmin, schoolId, selectedEscola]);

  const handleConfirmSuspension = async (pending, details) => {
    const { days, startDate, endDate } = details;
    const occurrence = pending.occurrence;

    const { error } = await supabase.from("ocorrencias").insert({
      escola_id: occurrence.escola_id || activeSchoolId,
      aluno_id: occurrence.aluno_id,
      professor_id: user.id,
      professor_nome: user.nome,
      turma_id: occurrence.turma_id || selectedTurma,
      data_ocorrido: occurrence.data_ocorrido,
      data_aplicacao: new Date().toISOString(),
      data_inicio: startDate,
      data_fim: endDate,
      tipo: occurrence.tipo,
      categoria: "suspensao",
      descricao: `Suspensão decorrente da ocorrência: ${occurrence.descricao || "Não informado"}`,
      ocorrencia_origem_id: occurrence.id,
    });

    if (error) {
      console.error(error);
      notify.error("Não foi possível registrar a suspensão.");
      throw error;
    }

    notify.success(`${pending.aluno?.nome || "Aluno"} foi suspenso por ${days} ${days === 1 ? "dia" : "dias"}.`);
  };

  const handleDismissSuspension = (occurrenceId) => {
    if (!occurrenceId) {
      setSuspensionQueue([]);
      return;
    }
    setSuspensionQueue((current) => current.filter((item) => item.occurrence.id !== occurrenceId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setFormMessage("Erro: usuário não autenticado.");
      return;
    }

    if (!activeSchoolId || !selectedTurma || selectedAlunos.length === 0 || !dataOcorrido || !tipoAdvertencia || !tipoSituacao || !descricao || (tipoAdvertencia === "suspensao" && (!dataInicio || !dataTermino))) {
      notify.warning("Preencha todos os campos antes de registrar a ocorrência.");
      setFormMessage("Preencha todos os campos antes de registrar a ocorrência.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");
    const suspensoesPendentes = [];

    for (const alunoId of selectedAlunos) {
      let totalOcorrenciasAntes = 0;
      let totalSuspensoes = 0;

      if (tipoAdvertencia === "ocorrencia") {
        const [ocorrenciasResult, suspensoesResult] = await Promise.all([
          supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("aluno_id", alunoId).eq("categoria", "ocorrencia"),
          supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("aluno_id", alunoId).eq("categoria", "suspensao"),
        ]);
        if (ocorrenciasResult.error) console.error(ocorrenciasResult.error);
        if (suspensoesResult.error) console.error(suspensoesResult.error);
        totalOcorrenciasAntes = ocorrenciasResult.count || 0;
        totalSuspensoes = suspensoesResult.count || 0;
      }

      let payload = {
        escola_id: activeSchoolId,
        aluno_id: alunoId,
        professor_id: user.id,
        professor_nome: user.nome,
        turma_id: selectedTurma,
        data_ocorrido: dataOcorrido,
        tipo: tipoSituacao,
        categoria: tipoAdvertencia,
        descricao,
      };

      if (tipoAdvertencia === "suspensao") {
        payload.data_inicio = dataInicio;
        payload.data_fim = dataTermino;
      }

      payload = scopePayload(payload, { schoolId, isGlobalAdmin });

      const { data: insertedOccurrence, error } = await supabase
        .from("ocorrencias")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error(error);
        notify.error("Erro ao registrar ocorrência");
        setFormMessage("Ocorreu um erro ao registrar.");
        setSubmitting(false);
        return;
      }

      if (tipoAdvertencia === "ocorrencia") {
        const totalDepois = totalOcorrenciasAntes + 1;
        const deveAbrirSuspensao = totalDepois >= 3 && totalDepois % 3 === 0 && totalSuspensoes < 3;
        if (deveAbrirSuspensao) {
          const aluno = alunos.find((item) => String(item.id) === String(alunoId));
          const turma = turmas.find((item) => String(item.id) === String(selectedTurma));
          suspensoesPendentes.push({
            occurrence: insertedOccurrence,
            aluno: aluno || { id: alunoId, nome: "Aluno" },
            turma: turma || { id: selectedTurma, nome: "—" },
            suspensoes: totalSuspensoes,
          });
        }
      }
    }

    setSubmitting(false);
    notify.success(
      selectedAlunos.length > 1
        ? `Ocorrência registrada para ${selectedAlunos.length} alunos com sucesso!`
        : "Ocorrência registrada com sucesso!",
    );
    resetForm();
    setOpen(false);
    if (suspensoesPendentes.length > 0) setSuspensionQueue(suspensoesPendentes);
  };

  const fluxoAlto = stats.semana > stats.mes * 0.4;

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <PageTitle
          title="Início"
          subtitle={<>Bem-vindo(a), <span className="font-semibold text-green-700">{user?.nome}</span>! monitore as ocorrências registradas e adicione novas advertências.</>}
        />
        <Button onClick={() => setOpen(true)} className="gap-2">
          <FaExclamationTriangle size={20} className="text-white" />
          <span>Adicionar Advertência</span>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle text="Visão Geral" />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Ocorrências totais" content={stats.total} />
          <Card title="Este mês" content={stats.mes} />
          <Card title="Esta semana" content={stats.semana} />
        </div>

        <div className={`relative mt-1 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm ${fluxoAlto ? "border-red-200 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/20" : "border-green-200 bg-green-50/80 dark:border-green-900/60 dark:bg-green-950/20"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${fluxoAlto ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400" : "bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400"}`}>
              {fluxoAlto ? <FaExclamationTriangle className="text-sm" /> : <FaCheckCircle className="text-sm" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm font-extrabold ${fluxoAlto ? "text-red-800 dark:text-red-300" : "text-green-800 dark:text-green-300"}`}>
                  {fluxoAlto ? "Atenção ao fluxo de ocorrências" : "Fluxo de ocorrências dentro do normal"}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${fluxoAlto ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"}`}>
                  {fluxoAlto ? "Atenção" : "Normal"}
                </span>
              </div>
              <p className={`mt-0.5 text-xs leading-5 ${fluxoAlto ? "text-red-700/75 dark:text-red-300/70" : "text-green-700/75 dark:text-green-300/70"}`}>
                {fluxoAlto ? "Houve uma concentração acima do esperado nos últimos dias." : "Os registros recentes permanecem em um nível estável."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Fluxo de Ocorrências</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Monitoramento semanal de registros</p>
            </div>
            <div className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Últimos 7 dias</div>
          </div>
          <div className="h-62.5 w-full sm:h-75 md:h-87.5 lg:h-100">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graficoData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: "14px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="ocorrencias" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: "#16a34a" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div><RankingOcorrencias escolaId={activeSchoolId} /></div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Adicionar Advertência">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          {formMessage && <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{formMessage}</div>}
          {isGlobalAdmin ? (
            <CustomSelect
              label="Escola"
              value={selectedEscola}
              onChange={(val) => {
                setSelectedEscola(val);
                setSelectedTurma("");
                setSelectedAlunos([]);
              }}
              options={[{ value: "", label: "Selecionar escola" }, ...escolas.map((e) => ({ value: String(e.id), label: e.nome })).sort((a, b) => a.label.localeCompare(b.label))]}
              placeholder="Selecionar escola"
            />
          ) : (
            <div className="sm:col-span-1 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-400">Escola</span>
              <div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Ambiente da escola atual</div>
            </div>
          )}
          <CustomSelect label="Turma" value={selectedTurma} disabled={!activeSchoolId || loadingTurmas} onChange={(val) => { setSelectedTurma(val); setSelectedAlunos([]); }} options={[{ value: "", label: "Selecionar turma" }, ...turmas.map((t) => ({ value: String(t.id), label: t.nome })).sort((a, b) => a.label.localeCompare(b.label))]} placeholder="Selecionar turma" />
          <CustomSelect label="Aluno(s)" value={selectedAlunos} disabled={!selectedTurma || loadingAlunos} onChange={(val) => setSelectedAlunos(val)} options={alunos.map((a) => ({ value: String(a.id), label: `${a.nome} - ${a.matricula || "sem matrícula"}` })).sort((a, b) => a.label.localeCompare(b.label))} placeholder="Selecionar aluno(s)" showSearch={true} multiple={true} showSelectedValues={false} />
          <CustomSelect label="Tipo de advertência" value={tipoAdvertencia} onChange={(val) => setTipoAdvertencia(val)} options={[{ value: "", label: "Selecionar tipo" }, { value: "ocorrencia", label: "Ocorrência" }, { value: "suspensao", label: "Suspensão" }]} placeholder="Selecionar tipo" />
          <FormInput type="date" label="Data da ocorrência" value={dataOcorrido} onChange={(event) => setDataOcorrido(event.target.value)} />
          {tipoAdvertencia === "suspensao" && <><FormInput type="date" label="Data de início" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} /><FormInput type="date" label="Data de término" value={dataTermino} onChange={(event) => setDataTermino(event.target.value)} /></>}
          <CustomSelect label="Tipo de situação" value={tipoSituacao} onChange={(val) => setTipoSituacao(val)} options={[{ value: "", label: "Selecionar situação" }, { value: "indisciplina", label: "Indisciplina" }, { value: "infrequencia", label: "Infrequência" }, { value: "atraso", label: "Atraso" }, { value: "desrespeito", label: "Desrespeito" }, { value: "outro", label: "Outro" }]} placeholder="Selecionar situação" />
          <div className="sm:col-span-2 flex flex-col gap-2"><label className="text-sm font-semibold text-slate-700 dark:text-slate-400">Descrição</label><textarea placeholder="Descreva a ocorrência..." rows={5} value={descricao} onChange={(event) => setDescricao(event.target.value)} className="h-36 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>{submitting ? "Registrando..." : "Registrar"}</Button>
          </div>
        </form>
      </Modal>

      <SuspensionDecisionPopup
        items={suspensionQueue}
        onConfirm={handleConfirmSuspension}
        onDismiss={handleDismissSuspension}
      />
    </div>
  );
};
