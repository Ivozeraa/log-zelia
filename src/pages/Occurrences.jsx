import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";

import { Modal } from "../components/ui/Modal";
import { PageTitle } from "../components/ui/PageTitle"
import { Card } from "../components/ui/Card";
import { FormInput } from "../components/ui/FormInput";
import { FormSelect } from "../components/ui/FormSelect";
import { Button } from "../components/ui/button";

export const Occurrences = () => {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedTurma, setSelectedTurma] = useState("");
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

  const alunoSummary = useMemo(() => {
    return occurrences.reduce((acc, occurrence) => {
      const existing = acc[occurrence.aluno_id] || {
        count: 0,
        latest: null,
      };

      const currentDate = occurrence.data_ocorrido || "";
      const latestDate = existing.latest?.data_ocorrido || "";

      const latest =
        !existing.latest || currentDate > latestDate
          ? occurrence
          : existing.latest;

      acc[occurrence.aluno_id] = {
        count: existing.count + 1,
        latest,
      };

      return acc;
    }, {});
  }, [occurrences]);

  const filteredAlunos = useMemo(() => {
    return alunos.filter((aluno) => {
      const matchesName = search
        ? aluno.nome.toLowerCase().includes(search.toLowerCase())
        : true;

      const matchesTurma = selectedTurma
        ? aluno.turma_id === selectedTurma
        : true;

      const matchesOcorrencia = apenasComOcorrencia
        ? !!alunoSummary[aluno.id]
        : true;

      return matchesName && matchesTurma && matchesOcorrencia;
    });
  }, [alunos, search, selectedTurma, apenasComOcorrencia, alunoSummary]);

  const totalPages = Math.ceil(filteredAlunos.length / itemsPerPage);

  const paginatedAlunos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAlunos.slice(start, end);
  }, [filteredAlunos, currentPage]);

  const selectedAlunoOccurrencesSorted = useMemo(() => {
    return [...selectedAlunoOccurrences].sort((a, b) =>
      (b.data_ocorrido || "").localeCompare(a.data_ocorrido || ""),
    );
  }, [selectedAlunoOccurrences]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedTurma, apenasComOcorrencia]);

  async function handleDelete() {
    if (!selectedOccurrence) return;

    if (!senha) {
      notify.error("Digite sua senha.");
      return;
    }

    if (!motivo || motivo.trim().length < 3) {
      notify.error("Motivo inválido.");
      return;
    }

    setDeleting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senha,
    });

    if (authError) {
      notify.error("Senha incorreta.");
      setDeleting(false);
      return;
    }

    const occurrenceToDelete = selectedOccurrence;

    const alunoData = alunos.find(
      (aluno) => aluno.id === occurrenceToDelete.aluno_id,
    );

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

    if (historyError) {
      notify.error("Erro ao salvar histórico.");
      setDeleting(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("ocorrencias")
      .delete()
      .eq("id", occurrenceToDelete.id);

    if (deleteError) {
      notify.error("Erro ao excluir ocorrência.");
      setDeleting(false);
      return;
    }

    setOccurrences((prev) =>
      prev.filter((item) => item.id !== occurrenceToDelete.id),
    );

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

        const alunoQuery = supabase
          .from("alunos")
          .select("id, nome, status, turma_id");

        const occurrenceQuery = supabase
          .from("ocorrencias")
          .select("*")
          .order("data_ocorrido", {
            ascending: false,
          });

        const historyQuery = supabase
          .from("ocorrencias_excluidas")
          .select("*")
          .order("excluido_em", {
            ascending: false,
          });

        if (user.role_id !== 1 && user.escola_id) {
          turmaQuery.eq("escola_id", user.escola_id);
          alunoQuery.eq("escola_id", user.escola_id);
          occurrenceQuery.eq("escola_id", user.escola_id);
          historyQuery.eq("escola_id", user.escola_id);
        }

        const [turmaResult, alunoResult, occurrenceResult, historyResult] =
          await Promise.all([
            turmaQuery,
            alunoQuery,
            occurrenceQuery,
            historyQuery,
          ]);

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
            const names = Object.fromEntries(users.map((user) => [user.id, user.nome]));
            enrichedOccurrences = occurrencesData.map((item) => ({
              ...item,
              professor_nome:
                item.professor_nome || names[item.professor_id] || item.professor_nome,
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
                  <span className="font-semibold text-slate-900">{selectedAluno.nome}</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900">{selectedAluno.nome}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Detalhes completos das ocorrências registradas para este aluno.
                </p>
              </>
            ) : (
              <PageTitle title="Advertências" subtitle="Centralize informações, acompanhe ocorrências e acesse recursos rapidamente." />
            )}
          </div>
        </div>
      </div>

      {!studentDetailsOpen && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-2 sm:w-auto">
              <FormInput
                label="Buscar Aluno"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do aluno"
              />
              <FormSelect
                label="Filtrar por Turma"
                value={selectedTurma}
                onChange={(event) => setSelectedTurma(event.target.value)}
              >
                <option value="">Todas as turmas</option>

                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}
                  </option>
                ))}
              </FormSelect>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
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
            <Card
              title="Alunos exibidos"
              content={filteredAlunos.length}
            />

            <Card
              title="Alunos com ocorrência"
              content={Object.keys(alunoSummary).length}
            />

            <Card
              title="Turmas"
              content={turmas.length}
            />
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
          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Ocorrências Totais</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {selectedAlunoOccurrencesSorted.length}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Turma</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {turmas.find((t) => t.id === selectedAluno.turma_id)?.nome || "—"}
              </p>
            </div>
            <div className={`rounded-3xl border border-slate-200 p-4 ${selectedAluno.status?.toLowerCase() === "normal"
              ? "bg-linear-to-br from-green-50 to-green-100"
              : selectedAluno.status?.toLowerCase().includes("suspenso")
                ? "bg-linear-to-br from-amber-50 to-amber-100"
                : "bg-linear-to-br from-red-50 to-red-100"
              }`}>
              <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Status</p>
              <p className={`mt-3 text-lg font-semibold capitalize ${selectedAluno.status?.toLowerCase() === "normal"
                ? "text-green-700"
                : selectedAluno.status?.toLowerCase().includes("suspenso")
                  ? "text-amber-700"
                  : "text-red-700"
                }`}>
                {selectedAluno.status || "Normal"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Última</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {selectedAlunoOccurrencesSorted[0]?.data_ocorrido || "—"}
              </p>
            </div>
          </div>

          {/* Occurrences List */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-linear-to-r from-slate-100 to-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Histórico de Ocorrências
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {selectedAlunoOccurrencesSorted.length}{" "}
                {selectedAlunoOccurrencesSorted.length === 1 ? "ocorrência" : "ocorrências"} registradas
              </p>
            </div>

            {selectedAlunoOccurrencesSorted.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500">
                <p>Nenhuma ocorrência encontrada para este aluno.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {selectedAlunoOccurrencesSorted.map((occ, idx) => (
                  <div key={occ.id} className="p-6 hover:bg-slate-50 transition">
                    <div className="flex flex-col gap-4">
                      {/* Header da ocorrência */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 font-semibold text-sm">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {occ.data_ocorrido || "Data não informada"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {occ.categoria || "—"}
                          </span>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                            {occ.tipo || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Descrição */}
                      {occ.descricao && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-sm text-slate-700">{occ.descricao}</p>
                        </div>
                      )}

                      {/* Grid de informações */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Professor</p>
                          <p className="mt-1 text-sm text-slate-900">{occ.professor_nome || "—"}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Aplicação</p>
                          <p className="mt-1 text-sm text-slate-900">{occ.data_aplicacao || "—"}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Início</p>
                          <p className="mt-1 text-sm text-slate-900">{occ.data_inicio || "—"}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Fim</p>
                          <p className="mt-1 text-sm text-slate-900">{occ.data_fim || "—"}</p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEditOccurrence(occ)}
                          className="text-blue-600 border-blue-200 hover:text-blue-800 hover:border-blue-300"
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão Voltar */}
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
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">Aluno</th>
                  <th className="border-b border-slate-200 px-4 py-3">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3">Turma</th>
                  <th className="border-b border-slate-200 px-4 py-3">Categoria</th>
                  <th className="border-b border-slate-200 px-4 py-3">Tipo</th>
                  <th className="border-b border-slate-200 px-4 py-3">Data</th>
                  <th className="border-b border-slate-200 px-4 py-3">Total</th>
                  <th className="border-b border-slate-200 px-4 py-3">Descrição</th>
                  <th className="border-b border-slate-200 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      Carregando ocorrências...
                    </td>
                  </tr>
                ) : paginatedAlunos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedAlunos.map((aluno) => {
                    const turma = turmas.find((t) => t.id === aluno.turma_id);
                    const summary = alunoSummary[aluno.id] || {
                      count: 0,
                      latest: null,
                    };
                    const latest = summary.latest;
                    const status = aluno.status?.toLowerCase() || "normal";
                    const rowClass =
                      status === "normal"
                        ? ""
                        : status.includes("suspenso")
                          ? "bg-amber-50"
                          : status.includes("expulso")
                            ? "bg-red-50"
                            : "bg-slate-50";

                    return (
                      <tr
                        key={aluno.id}
                        className={`${rowClass} border-b border-slate-200 last:border-none`}
                      >
                        <td className="px-4 py-4 font-medium text-slate-900">
                          <button
                            onClick={() => {
                              setSelectedAluno(aluno);
                              setSelectedAlunoOccurrences(
                                occurrences.filter((item) => item.aluno_id === aluno.id),
                              );
                              setStudentDetailsOpen(true);
                            }}
                            data-cy="student-name-button"
                            className="text-left text-slate-900 transition hover:text-blue-600 hover:underline"
                          >
                            {aluno.nome}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-slate-700 capitalize">
                          {aluno.status || "normal"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {turma?.nome || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {latest?.categoria || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {latest?.tipo || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {latest?.data_ocorrido || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {summary.count}
                        </td>
                        <td className="px-4 py-4 text-slate-700 max-w-[320px] truncate">
                          {latest?.descricao || "—"}
                        </td>
                        <td className="px-4 py-4">
                          {latest && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => openEditOccurrence(latest)}
                                className="text-blue-600 hover:text-blue-800 border-blue-200"
                              >
                                Editar
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedOccurrence(latest);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                Excluir
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-1 flex-wrap">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-full border bg-white text-slate-700 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50"
              >
                ←
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === currentPage ||
                    page === currentPage - 1 ||
                    page === currentPage + 1,
                )
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-full border ${currentPage === page
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-green-50"
                      }`}
                  >
                    {page}
                  </button>
                ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-full border bg-white text-slate-700 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50"
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Histórico de atividades
        </h2>

        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
          {activityLog.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">
              Nenhuma atividade registrada.
            </div>
          ) : (
            activityLog.map((entry, index) => (
              <div key={index} className="px-4 py-3">
                <div className="text-sm text-slate-800">
                  <strong>{entry.aplicadoPor}</strong> removeu a ocorrência de
                  <strong> {entry.aluno} </strong>({entry.categoria} —{" "}
                  {entry.tipo})
                </div>
                <div className="text-xs text-slate-500">
                  Motivo: {entry.motivo}
                </div>
                <div className="text-xs text-slate-400">
                  {entry.timestamp.toLocaleString("pt-BR")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSenha("");
          setMotivo("");
        }}
        title="Excluir ocorrência"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir essa ocorrência? Essa ação não pode
            ser desfeita.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-11 rounded-lg border px-3"
              placeholder="Digite sua senha"
            />
          </div>

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
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2"
            >
              Cancelar
            </Button>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2"
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingOccurrence(null);
        }}
        title="Editar ocorrência"
      >
        <form onSubmit={handleSaveEdit} className="grid gap-4" ref={modalRef}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de advertência</label>
              <button
                type="button"
                onClick={() => {
                  setEditCategoriaOpen((prev) => !prev);
                  setEditTipoOpen(false);
                }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>
                  {editCategoria === 'ocorrencia' ? 'Ocorrência' :
                    editCategoria === 'suspensao' ? 'Suspensão' :
                      'Selecionar tipo'}
                </span>
                <span className="text-slate-500">▾</span>
              </button>

              {editCategoriaOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setEditCategoria('ocorrencia');
                      setEditDataInicio('');
                      setEditDataFim('');
                      setEditCategoriaOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Ocorrência
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCategoria('suspensao');
                      setEditCategoriaOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Suspensão
                  </button>
                </div>
              )}
            </div>

            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de situação</label>
              <button
                type="button"
                onClick={() => {
                  setEditTipoOpen((prev) => !prev);
                  setEditCategoriaOpen(false);
                }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>
                  {editTipo === 'indisciplina' ? 'Indisciplina' :
                    editTipo === 'infrequencia' ? 'Infrequência' :
                      editTipo === 'atraso' ? 'Atraso' :
                        editTipo === 'desrespeito' ? 'Desrespeito' :
                          editTipo === 'outro' ? 'Outro' :
                            'Selecionar situação'}
                </span>
                <span className="text-slate-500">▾</span>
              </button>

              {editTipoOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('indisciplina');
                      setEditTipoOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Indisciplina
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('infrequencia');
                      setEditTipoOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Infrequência
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('atraso');
                      setEditTipoOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Atraso
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('desrespeito');
                      setEditTipoOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Desrespeito
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('outro');
                      setEditTipoOpen(false);
                    }}
                    className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    Outro
                  </button>
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
              onClick={() => {
                setEditModalOpen(false);
                setEditingOccurrence(null);
              }}
              className="px-4 py-3"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-3"
            >
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
