import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { Modal } from "../components/ui/Modal";

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

  const [senha, setSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [deleting, setDeleting] = useState(false);

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
        setOccurrences(occurrenceResult.data || []);

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

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 sm:w-auto">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Buscar aluno
              </label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do aluno"
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Filtrar turma
              </label>
              <select
                value={selectedTurma}
                onChange={(event) => setSelectedTurma(event.target.value)}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as turmas</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apenasComOcorrencia"
            checked={apenasComOcorrencia}
            onChange={(e) => setApenasComOcorrencia(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer"
          />
          <label
            htmlFor="apenasComOcorrencia"
            className="text-sm text-slate-700 cursor-pointer"
          >
            Exibir somente alunos com ocorrência
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Alunos exibidos</p>
            <p className="text-2xl font-bold text-slate-900">
              {filteredAlunos.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Alunos com ocorrência</p>
            <p className="text-2xl font-bold text-slate-900">
              {Object.keys(alunoSummary).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Turmas</p>
            <p className="text-2xl font-bold text-slate-900">{turmas.length}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Carregando ocorrências...
                </td>
              </tr>
            ) : paginatedAlunos.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-slate-500"
                >
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
                      {aluno.nome}
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
                        <button
                          onClick={() => {
                            setSelectedOccurrence(latest);
                            setDeleteModalOpen(true);
                          }}
                          className="text-xs text-red-600 hover:text-red-800 hover:underline transition"
                        >
                          Excluir
                        </button>
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
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-full border bg-white text-slate-700 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50"
          >
            →
          </button>
        </div>
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
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg border"
            >
              Cancelar
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50"
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
