import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";

import { Modal } from "../components/ui/Modal";
import { PageTitle } from "../components/ui/PageTitle";
import { Card } from "../components/ui/Card";
import { FormInput } from "../components/ui/FormInput";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";
import { SectionTitle } from "../components/ui/SectionTitle";
import { ActivityList } from "../components/ui/ActivityList";

const PERIODO_OPTIONS = [
  { value: "", label: "Todos os períodos" },
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Essa Semana" },
  { value: "mes", label: "Esse Mês" },
  { value: "ano", label: "Esse Ano" },
];

const parseDataOcorrido = (data) => {
  if (!data) return null;
  const partes = String(data).split("T")[0].split("-");
  if (partes.length !== 3) {
    const fallback = new Date(data);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [ano, mes, dia] = partes.map(Number);
  return new Date(ano, mes - 1, dia);
};

const formatData = (data) => {
  if (!data) return "—";
  const parsed = parseDataOcorrido(data);
  if (!parsed) return String(data);
  const dia = String(parsed.getDate()).padStart(2, "0");
  const mes = String(parsed.getMonth() + 1).padStart(2, "0");
  const ano = parsed.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

const formatDataComHora = (data) => {
  if (!data) return "—";
  try {
    const date = new Date(data);
    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const ano = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, "0");
    const minuto = String(date.getMinutes()).padStart(2, "0");
    const segundo = String(date.getSeconds()).padStart(2, "0");
    return `${dia}/${mes}/${ano} - ${hora}:${minuto}:${segundo}`;
  } catch {
    return data;
  }
};

const dataDentroDoPeriodo = (data, periodo) => {
  if (!periodo) return true;
  const dataOcorrido = parseDataOcorrido(data);
  if (!dataOcorrido) return false;
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (periodo === "hoje") return dataOcorrido.getTime() === inicioHoje.getTime();
  if (periodo === "semana") {
    const inicioSemana = new Date(inicioHoje);
    inicioSemana.setDate(inicioHoje.getDate() - inicioHoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    return dataOcorrido >= inicioSemana && dataOcorrido <= fimSemana;
  }
  if (periodo === "mes") {
    return (
      dataOcorrido.getFullYear() === hoje.getFullYear() &&
      dataOcorrido.getMonth() === hoje.getMonth()
    );
  }
  if (periodo === "ano") return dataOcorrido.getFullYear() === hoje.getFullYear();
  return true;
};

const contarSuspensoes = (ocorrenciasDoAluno) => {
  if (!ocorrenciasDoAluno || ocorrenciasDoAluno.length === 0) return 0;
  const suspensoesDiretas = ocorrenciasDoAluno.filter(
    (item) => item.categoria === "suspensao",
  ).length;
  const totalSimples = ocorrenciasDoAluno.filter(
    (item) => item.categoria === "ocorrencia",
  ).length;
  return suspensoesDiretas + Math.floor(totalSimples / 3);
};

const ordenarESinalizarSuspensoes = (lista) => {
  const ascendente = [...lista].sort((a, b) =>
    (a.data_ocorrido || "").localeCompare(b.data_ocorrido || ""),
  );
  let contadorSimples = 0;
  let numeroSuspensao = 0;
  const sinalizadas = ascendente.map((occ) => {
    if (occ.categoria === "suspensao") {
      numeroSuspensao += 1;
      return { ...occ, suspensaoGerada: { numero: numeroSuspensao, origem: "direta" } };
    }
    contadorSimples += 1;
    if (contadorSimples % 3 === 0) {
      numeroSuspensao += 1;
      return { ...occ, suspensaoGerada: { numero: numeroSuspensao, origem: "acumulo" } };
    }
    return { ...occ, suspensaoGerada: null };
  });
  return sinalizadas.sort((a, b) =>
    (b.data_ocorrido || "").localeCompare(a.data_ocorrido || ""),
  );
};

const resolverEstiloStatus = (status) => {
  const st = (status || "normal").toLowerCase();
  if (st.includes("suspenso")) {
    return {
      badge: "inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800",
      bannerBg: "bg-amber-50 border-amber-200",
      bannerText: "text-amber-800",
      bannerIcon: "⚠️",
      bannerLabel: "Este aluno está atualmente suspenso",
      rowClass: "bg-amber-50",
    };
  }
  if (st.includes("expulso")) {
    return {
      badge: "inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800",
      bannerBg: "bg-red-50 border-red-200",
      bannerText: "text-red-800",
      bannerIcon: "🚫",
      bannerLabel: "Este aluno foi expulso",
      rowClass: "bg-red-50",
    };
  }
  return {
    badge: "inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700",
    bannerBg: null,
    bannerText: null,
    bannerIcon: null,
    bannerLabel: null,
    rowClass: "",
  };
};

const criarNotificacaoSuspensao = async ({ alunoNome, escolaId, alunoId, dataInicio, dataFim }) => {
  const periodoTexto =
    dataInicio && dataFim
      ? ` (${formatData(dataInicio)} até ${formatData(dataFim)})`
      : "";
  const mensagem = `${alunoNome} foi suspenso${periodoTexto}.`;
  await supabase.from("notificacoes").insert({
    escola_id: escolaId,
    aluno_id: alunoId,
    aluno_nome: alunoNome,
    mensagem,
  });
};

export const Occurrences = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [selectedTurma, setSelectedTurma] = useState("");
  const [selectedPeriodo, setSelectedPeriodo] = useState("");
  const [apenasComOcorrencia, setApenasComOcorrencia] = useState(false);

  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [occurrences, setOccurrences] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activityLog, setActivityLog] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [editCategoria, setEditCategoria] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editDataOcorrido, setEditDataOcorrido] = useState("");
  const [editDataInicio, setEditDataInicio] = useState("");
  const [editDataFim, setEditDataFim] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCategoriaOpen, setEditCategoriaOpen] = useState(false);
  const [editTipoOpen, setEditTipoOpen] = useState(false);
  const modalRef = useRef(null);

  const [senha, setSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [studentDetailsOpen, setStudentDetailsOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState(null);
  const [selectedAlunoOccurrences, setSelectedAlunoOccurrences] = useState([]);

  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) =>
      dataDentroDoPeriodo(occ.data_ocorrido, selectedPeriodo),
    );
  }, [occurrences, selectedPeriodo]);

  const alunoSummary = useMemo(() => {
    return filteredOccurrences.reduce((acc, occurrence) => {
      const existing = acc[occurrence.aluno_id] || { count: 0, latest: null };
      const currentDate = occurrence.data_ocorrido || "";
      const latestDate = existing.latest?.data_ocorrido || "";
      const latest =
        !existing.latest || currentDate > latestDate ? occurrence : existing.latest;
      acc[occurrence.aluno_id] = { count: existing.count + 1, latest };
      return acc;
    }, {});
  }, [filteredOccurrences]);

  const suspensoesPorAluno = useMemo(() => {
    const agrupado = filteredOccurrences.reduce((acc, occ) => {
      if (!acc[occ.aluno_id]) acc[occ.aluno_id] = [];
      acc[occ.aluno_id].push(occ);
      return acc;
    }, {});
    return Object.fromEntries(
      Object.entries(agrupado).map(([alunoId, lista]) => [
        alunoId,
        contarSuspensoes(lista),
      ]),
    );
  }, [filteredOccurrences]);

  const filteredAlunos = useMemo(() => {
    return alunos.filter((aluno) => {
      const matchesName = search
        ? aluno.nome.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesTurma = selectedTurma ? aluno.turma_id === selectedTurma : true;
      const matchesOcorrencia = apenasComOcorrencia ? !!alunoSummary[aluno.id] : true;
      return matchesName && matchesTurma && matchesOcorrencia;
    });
  }, [alunos, search, selectedTurma, apenasComOcorrencia, alunoSummary]);

  const totalPages = Math.ceil(filteredAlunos.length / itemsPerPage);

  const paginatedAlunos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAlunos.slice(start, start + itemsPerPage);
  }, [filteredAlunos, currentPage]);

  const selectedAlunoOccurrencesSorted = useMemo(
    () => ordenarESinalizarSuspensoes(selectedAlunoOccurrences),
    [selectedAlunoOccurrences],
  );

  const suspensoesDoAlunoSelecionado = useMemo(
    () => contarSuspensoes(selectedAlunoOccurrences),
    [selectedAlunoOccurrences],
  );

  const turmaOptions = [
    { value: "", label: "Todas as turmas" },
    ...turmas
      .map((turma) => ({ value: String(turma.id), label: turma.nome }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedTurma, selectedPeriodo, apenasComOcorrencia]);

  useEffect(() => {
    if (!location.state?.alunoId || alunos.length === 0 || occurrences.length === 0) return;

    const aluno = alunos.find((a) => a.id === location.state.alunoId);
    if (!aluno) return;

    setSelectedAluno(aluno);
    setSelectedAlunoOccurrences(occurrences.filter((o) => o.aluno_id === aluno.id));
    setStudentDetailsOpen(true);

    window.history.replaceState({}, "");
  }, [location.state, alunos, occurrences]);

  async function handleDelete() {
    if (!selectedOccurrence) return;
    if (!senha) { notify.error("Digite sua senha."); return; }
    if (!motivo || motivo.trim().length < 3) { notify.error("Motivo inválido."); return; }

    setDeleting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senha,
    });
    if (authError) { notify.error("Senha incorreta."); setDeleting(false); return; }

    const occurrenceToDelete = selectedOccurrence;
    const alunoData = alunos.find((aluno) => aluno.id === occurrenceToDelete.aluno_id);

    const payload = {
      ocorrencia_id: occurrenceToDelete.id,
      aluno_id: occurrenceToDelete.aluno_id,
      aluno_nome: alunoData?.nome || "Aluno não encontrado",
      professor_id: occurrenceToDelete.professor_id,
      professor_nome: occurrenceToDelete.professor_nome || "Não informado",
      escola_id: occurrenceToDelete.escola_id,
      turma_id: occurrenceToDelete.turma_id,
      descricao: occurrenceToDelete.descricao,
      categoria: occurrenceToDelete.categoria,
      tipo: occurrenceToDelete.tipo,
      data_ocorrido: occurrenceToDelete.data_ocorrido,
      data_aplicacao: occurrenceToDelete.data_aplicacao,
      data_inicio: occurrenceToDelete.data_inicio,
      data_fim: occurrenceToDelete.data_fim,
      criado_em: occurrenceToDelete.created_at,
      excluido_por: user.id,
      excluido_por_nome: user.nome,
      motivo_exclusao: motivo.trim(),
    };

    const { error: historyError } = await supabase
      .from("ocorrencias_excluidas")
      .insert(payload);
    if (historyError) { notify.error("Erro ao salvar histórico."); setDeleting(false); return; }

    const { error: deleteError } = await supabase
      .from("ocorrencias")
      .delete()
      .eq("id", occurrenceToDelete.id);
    if (deleteError) { notify.error("Erro ao excluir ocorrência."); setDeleting(false); return; }

    setOccurrences((prev) => prev.filter((item) => item.id !== occurrenceToDelete.id));
    setActivityLog((prev) => [
      {
        aluno: alunoData?.nome,
        categoria: occurrenceToDelete.categoria,
        tipo: occurrenceToDelete.tipo,
        aplicadoPor: user.nome,
        motivo,
        timestamp: new Date(),
      },
      ...prev,
    ]);

    notify.success("Ocorrência removida.");
    setDeleteModalOpen(false);
    setSelectedOccurrence(null);
    setSenha("");
    setMotivo("");
    setDeleting(false);
  }

  function openEditOccurrence(occurrence) {
    setEditingOccurrence(occurrence);
    setEditCategoria(occurrence.categoria || "");
    setEditTipo(occurrence.tipo || "");
    setEditDescricao(occurrence.descricao || "");
    setEditDataOcorrido(occurrence.data_ocorrido || "");
    setEditDataInicio(occurrence.data_inicio || "");
    setEditDataFim(occurrence.data_fim || "");
    setEditModalOpen(true);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editingOccurrence) return;

    if (!editCategoria || !editTipo || !editDataOcorrido) {
      notify.warning("Preencha a categoria, tipo e data da ocorrência.");
      return;
    }
    if (editCategoria === "suspensao" && (!editDataInicio || !editDataFim)) {
      notify.warning("Preencha as datas de início e término para suspensão.");
      return;
    }

    setSavingEdit(true);

    const payload = {
      categoria: editCategoria,
      tipo: editTipo,
      descricao: editDescricao,
      data_ocorrido: editDataOcorrido,
      professor_nome: editingOccurrence.professor_nome || user?.nome,
    };

    if (editCategoria === "suspensao") {
      payload.data_inicio = editDataInicio;
      payload.data_fim = editDataFim;
    } else {
      payload.data_inicio = null;
      payload.data_fim = null;
    }

    const { data: updatedData, error: updateError } = await supabase
      .from("ocorrencias")
      .update(payload)
      .eq("id", editingOccurrence.id)
      .select();

    if (updateError || !updatedData || updatedData.length === 0) {
      notify.error("Erro ao atualizar ocorrência no banco.");
      setSavingEdit(false);
      return;
    }

    const updatedOccurrence = updatedData[0];

    if (
      editCategoria === "suspensao" &&
      editingOccurrence.categoria !== "suspensao"
    ) {
      const alunoData = alunos.find((a) => a.id === editingOccurrence.aluno_id);
      if (alunoData) {
        await criarNotificacaoSuspensao({
          alunoNome: alunoData.nome,
          escolaId: editingOccurrence.escola_id || user.escola_id,
          alunoId: alunoData.id,
          dataInicio: editDataInicio,
          dataFim: editDataFim,
        });
      }
    }

    setOccurrences((prev) =>
      prev.map((item) =>
        item.id === editingOccurrence.id ? { ...item, ...updatedOccurrence } : item,
      ),
    );
    setSelectedAlunoOccurrences((prev) =>
      prev.map((item) =>
        item.id === editingOccurrence.id ? { ...item, ...updatedOccurrence } : item,
      ),
    );

    setSavingEdit(false);
    setEditModalOpen(false);
    setEditingOccurrence(null);
    notify.success("Ocorrência atualizada com sucesso.");
  }

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      setError("");
      try {
        const turmaQuery = supabase.from("turmas").select("id, nome");
        const alunoQuery = supabase.from("alunos").select("id, nome, status, turma_id");
        const occurrenceQuery = supabase
          .from("ocorrencias")
          .select("*")
          .order("data_ocorrido", { ascending: false });
        const historyQuery = supabase
          .from("ocorrencias_excluidas")
          .select("*")
          .order("excluido_em", { ascending: false });

        if (user.role_id !== 1 && user.escola_id) {
          turmaQuery.eq("escola_id", user.escola_id);
          alunoQuery.eq("escola_id", user.escola_id);
          occurrenceQuery.eq("escola_id", user.escola_id);
          historyQuery.eq("escola_id", user.escola_id);
        }

        const [turmaResult, alunoResult, occurrenceResult, historyResult] =
          await Promise.all([turmaQuery, alunoQuery, occurrenceQuery, historyQuery]);

        setTurmas(turmaResult.data || []);
        setAlunos(alunoResult.data || []);

        const occurrencesData = occurrenceResult.data || [];
        const professorIds = [
          ...new Set(
            occurrencesData
              .filter((item) => !item.professor_nome && item.professor_id)
              .map((item) => item.professor_id),
          ),
        ];

        let enrichedOccurrences = occurrencesData;
        if (professorIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from("usuarios")
            .select("id, nome")
            .in("id", professorIds);
          if (!usersError) {
            const names = Object.fromEntries(users.map((u) => [u.id, u.nome]));
            enrichedOccurrences = occurrencesData.map((item) => ({
              ...item,
              professor_nome: item.professor_nome || names[item.professor_id] || item.professor_nome,
            }));
          }
        }

        setOccurrences(enrichedOccurrences);

        const formattedLog =
          historyResult.data?.map((item) => ({
            type: "removed",
            aluno: item.aluno_nome,
            categoria: item.categoria,
            tipo: item.tipo,
            aplicadoPor: item.excluido_por_nome,
            motivo: item.motivo_exclusao,
            timestamp: new Date(item.excluido_em),
          })) || [];
        setActivityLog(formattedLog);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setEditCategoriaOpen(false);
        setEditTipoOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {studentDetailsOpen && selectedAluno ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                  <button
                    onClick={() => setStudentDetailsOpen(false)}
                    className="text-slate-600 hover:text-slate-900 transition"
                  >
                    Advertências
                  </button>
                  <span className="text-slate-400 mx-1">›</span>
                  <span className="font-semibold text-slate-900">
                    {selectedAluno.nome}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {selectedAluno.nome}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Detalhes completos das ocorrências registradas para este aluno.
                </p>
              </>
            ) : (
              <PageTitle
                title="Advertências"
                subtitle="Centralize informações, acompanhe ocorrências e acesse recursos rapidamente."
              />
            )}
          </div>
        </div>
      </div>

      {!studentDetailsOpen && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-3 sm:w-auto">
              <FormInput
                label="Buscar Aluno"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do aluno"
              />
              <CustomSelect
                label="Filtrar por Turma"
                value={selectedTurma}
                onChange={setSelectedTurma}
                options={turmaOptions}
                placeholder="Todas as turmas"
              />
              <CustomSelect
                label="Período"
                value={selectedPeriodo}
                onChange={setSelectedPeriodo}
                options={PERIODO_OPTIONS}
                placeholder="Todos os períodos"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FormInput
              type="checkbox"
              id="apenasComOcorrencia"
              checked={apenasComOcorrencia}
              onChange={(e) => setApenasComOcorrencia(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-green-700 cursor-pointer"
            />
            <label
              htmlFor="apenasComOcorrencia"
              className="text-sm text-slate-700 dark:text-slate-400 cursor-pointer"
            >
              Exibir somente alunos com ocorrência
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Alunos exibidos" content={filteredAlunos.length} />
            <Card
              title="Alunos com ocorrência"
              content={Object.keys(alunoSummary).length}
            />
            <Card title="Turmas" content={turmas.length} />
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {studentDetailsOpen && selectedAluno ? (
        <div className="flex flex-col gap-6">
          {(() => {
            const estilos = resolverEstiloStatus(selectedAluno.status);
            if (!estilos.bannerBg) return null;
            const isSuspenso = (selectedAluno.status || "").toLowerCase().includes("suspenso");
            return (
              <div
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${estilos.bannerBg}`}
              >
                <span className="text-2xl leading-none shrink-0" aria-hidden="true">
                  {estilos.bannerIcon}
                </span>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className={`text-sm font-semibold ${estilos.bannerText}`}>
                    {estilos.bannerLabel}
                  </span>
                  {isSuspenso && (
                    <span className={`text-xs ${estilos.bannerText} opacity-75`}>
                      {suspensoesDoAlunoSelecionado}{" "}
                      {suspensoesDoAlunoSelecionado === 1
                        ? "suspensão acumulada"
                        : "suspensões acumuladas"}{" "}
                      no histórico completo
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-5">
            <Card
              title="Ocorrências Totais"
              content={selectedAlunoOccurrencesSorted.length}
            />
            <Card
              title="Turma"
              content={
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {turmas.find((t) => t.id === selectedAluno.turma_id)?.nome || "—"}
                </span>
              }
            />
            <Card
              title="Status"
              content={(() => {
                const estilos = resolverEstiloStatus(selectedAluno.status);
                const st = (selectedAluno.status || "normal").toLowerCase();
                const badgeLg = estilos.badge.replace("text-xs", "text-base");
                return <span className={`${badgeLg} capitalize`}>{st}</span>;
              })()}
            />
            <Card
              title="Suspensões"
              content={
                <span
                  className={
                    suspensoesDoAlunoSelecionado > 0
                      ? "inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-lg font-semibold text-red-700"
                      : "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-lg font-semibold text-slate-700"
                  }
                >
                  {suspensoesDoAlunoSelecionado}
                </span>
              }
            />
            <Card
              title="Última"
              content={
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatData(selectedAlunoOccurrencesSorted[0]?.data_ocorrido)}
                </span>
              }
            />
          </div>

          <Card
            title="Histórico de Ocorrências"
            content={
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedAlunoOccurrencesSorted.length}{" "}
                  {selectedAlunoOccurrencesSorted.length === 1 ? "ocorrência" : "ocorrências"}{" "}
                  registradas
                </p>

                {selectedAlunoOccurrencesSorted.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma ocorrência encontrada para este aluno.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {selectedAlunoOccurrencesSorted.map((occ, idx) => {
                      const ehSuspensao = occ.categoria === "suspensao";
                      const cardExtraClass = ehSuspensao
                        ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                        : "";

                      return (
                        <div
                          key={occ.id}
                          className={`rounded-2xl border p-4 flex flex-col gap-3 ${cardExtraClass || "border-slate-200 dark:border-slate-700"}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  ehSuspensao
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {formatData(occ.data_ocorrido)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  ehSuspensao
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {occ.categoria || "—"}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                {occ.tipo || "—"}
                              </span>
                              {occ.suspensaoGerada && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                                  🔴{" "}
                                  {occ.suspensaoGerada.origem === "direta"
                                    ? `Suspensão #${occ.suspensaoGerada.numero}`
                                    : `Gerou suspensão #${occ.suspensaoGerada.numero}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {ehSuspensao && (occ.data_inicio || occ.data_fim) && (
                            <div className="flex items-center gap-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                              <span>📅</span>
                              <span>
                                Período:{" "}
                                <strong>{formatData(occ.data_inicio)}</strong>
                                {" "}até{" "}
                                <strong>{formatData(occ.data_fim)}</strong>
                              </span>
                            </div>
                          )}

                          {occ.descricao && (
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Descrição
                              </p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {occ.descricao}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">
                                Professor
                              </p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {occ.professor_nome || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">
                                Aplicação
                              </p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {formatDataComHora(occ.data_aplicacao)}
                              </p>
                            </div>
                            {!ehSuspensao && (
                              <div className="col-span-2 sm:col-span-1" />
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => openEditOccurrence(occ)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="xs"
                              variant="destructive"
                              onClick={() => {
                                setSelectedOccurrence(occ);
                                setDeleteModalOpen(true);
                              }}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            }
          />

          <div className="flex justify-center">
            <Button
              variant="outline"
              className="px-6 py-3"
              onClick={() => setStudentDetailsOpen(false)}
            >
              ← Voltar para lista
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SectionTitle text="Lista de alunos" />
          <Table
            loading={loading}
            data={paginatedAlunos.map((aluno) => {
              const turma = turmas.find((t) => t.id === aluno.turma_id);
              const summary = alunoSummary[aluno.id] || { count: 0, latest: null };
              const estilos = resolverEstiloStatus(aluno.status);
              return {
                ...aluno,
                turmaNome: turma?.nome || "—",
                latest: summary.latest,
                summary,
                rowClass: estilos.rowClass,
              };
            })}
            loadingMessage="Carregando ocorrências..."
            emptyMessage="Nenhum aluno encontrado."
            columns={[
              {
                key: "nome",
                title: "Aluno",
                render: (aluno) => (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSelectedAluno(aluno);
                      setSelectedAlunoOccurrences(
                        occurrences.filter((item) => item.aluno_id === aluno.id),
                      );
                      setStudentDetailsOpen(true);
                    }}
                    data-cy="student-name-button"
                    className="text-left font-medium text-slate-900 dark:text-slate-100 transition hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                  >
                    {aluno.nome}
                  </Button>
                ),
              },
              {
                key: "status",
                title: "Status",
                render: (aluno) => {
                  const estilos = resolverEstiloStatus(aluno.status);
                  const st = (aluno.status || "normal").toLowerCase();
                  return <span className={`${estilos.badge} capitalize`}>{st}</span>;
                },
              },
              { key: "turmaNome", title: "Turma" },
              {
                key: "total",
                title: "Total",
                render: (aluno) => aluno.summary.count,
              },
              {
                key: "suspensoes",
                title: "Suspensões",
                render: (aluno) => {
                  const total = suspensoesPorAluno[aluno.id] || 0;
                  const badgeClasses =
                    total > 0
                      ? "inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                      : "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500";
                  return <span className={badgeClasses}>{total}</span>;
                },
              },
            ]}
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      <ActivityList
        data={activityLog}
        renderItem={(entry) => (
          <>
            <div className="text-sm text-slate-800 dark:text-slate-200">
              <strong>{entry.aplicadoPor}</strong> removeu a ocorrência de
              <strong> {entry.aluno} </strong>({entry.categoria} — {entry.tipo})
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Motivo: {entry.motivo}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {entry.timestamp.toLocaleString("pt-BR")}
            </div>
          </>
        )}
      />

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setSenha(""); setMotivo(""); }}
        title="Excluir ocorrência"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir essa ocorrência? Essa ação não pode ser desfeita.
          </p>
          <FormInput
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite sua senha"
            className="h-11 rounded-lg border px-3"
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Motivo</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="rounded-lg border px-3 py-2"
              placeholder="Informe o motivo da exclusão"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="px-4 py-2">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="px-4 py-2">
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingOccurrence(null); }}
        title="Editar ocorrência"
      >
        <form onSubmit={handleSaveEdit} className="grid gap-4" ref={modalRef}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de advertência</label>
              <button
                type="button"
                onClick={() => { setEditCategoriaOpen((prev) => !prev); setEditTipoOpen(false); }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>
                  {editCategoria === "ocorrencia" ? "Ocorrência" : editCategoria === "suspensao" ? "Suspensão" : "Selecionar tipo"}
                </span>
                <span className="text-slate-500">▾</span>
              </button>
              {editCategoriaOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setEditCategoria("ocorrencia"); setEditDataInicio(""); setEditDataFim(""); setEditCategoriaOpen(false); }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >Ocorrência</button>
                  <button
                    type="button"
                    onClick={() => { setEditCategoria("suspensao"); setEditCategoriaOpen(false); }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >Suspensão</button>
                </div>
              )}
            </div>

            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de situação</label>
              <button
                type="button"
                onClick={() => { setEditTipoOpen((prev) => !prev); setEditCategoriaOpen(false); }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>
                  {editTipo === "indisciplina" ? "Indisciplina"
                    : editTipo === "infrequencia" ? "Infrequência"
                    : editTipo === "atraso" ? "Atraso"
                    : editTipo === "desrespeito" ? "Desrespeito"
                    : editTipo === "outro" ? "Outro"
                    : "Selecionar situação"}
                </span>
                <span className="text-slate-500">▾</span>
              </button>
              {editTipoOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {[
                    { value: "indisciplina", label: "Indisciplina" },
                    { value: "infrequencia", label: "Infrequência" },
                    { value: "atraso", label: "Atraso" },
                    { value: "desrespeito", label: "Desrespeito" },
                    { value: "outro", label: "Outro" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setEditTipo(opt.value); setEditTipoOpen(false); }}
                      className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Data da ocorrência</label>
              <input
                type="date"
                value={editDataOcorrido}
                onChange={(e) => setEditDataOcorrido(e.target.value)}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            {editCategoria === "suspensao" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">Data de início</label>
                  <input
                    type="date"
                    value={editDataInicio}
                    onChange={(e) => setEditDataInicio(e.target.value)}
                    className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">Data de término</label>
                  <input
                    type="date"
                    value={editDataFim}
                    onChange={(e) => setEditDataFim(e.target.value)}
                    className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Descrição</label>
            <textarea
              value={editDescricao}
              onChange={(e) => setEditDescricao(e.target.value)}
              className="h-32 rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setEditModalOpen(false); setEditingOccurrence(null); }}
              className="px-4 py-3"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={savingEdit} className="px-4 py-3">
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};