import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaFilePdf, FaUsers } from "react-icons/fa";

import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { Button } from "../components/ui/Button";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Modal } from "../components/ui/Modal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { PageTitle } from "../components/ui/PageTitle";
import { FormInput } from "../components/ui/FormInput";
import { FormSelect } from "../components/ui/FormSelect";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";

const ROLES = [
  { id: 1, label: "Super Admin" },
  { id: 2, label: "Diretor" },
  { id: 3, label: "Coordenador" },
  { id: 4, label: "Professor" },
];

export const Management = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isDiretor, setIsDiretor] = useState(false);

  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterSchool, setFilterSchool] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmSenha, setDeleteConfirmSenha] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [turmas, setTurmas] = useState([]);
  const [exportFilters, setExportFilters] = useState({
    escola_id: "",
    turma_id: "",
    periodo: "todos",
    categoria: "",
    tipo: "",
  });
  const [exporting, setExporting] = useState(false);

  const [addForm, setAddForm] = useState({
    nome: "",
    email: "",
    password: "",
    role_id: "",
    escola_id: "",
    pdt: false,
  });

  const [editForm, setEditForm] = useState(null);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      setIsDiretor(
        user.role_id === 1 || user.role_id === 2 || user.role_id === 3,
      );
    }
  }, [user]);

  useEffect(() => {
    if (!isDiretor) return;
    loadData();
  }, [isDiretor]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      let usersQuery = supabase
        .from("usuarios")
        .select("*")
        .order("nome", { ascending: true });

      if (user.role_id !== 1 && user.escola_id) {
        usersQuery = usersQuery.eq("escola_id", user.escola_id);
      }

      const schoolsQuery = supabase
        .from("escolas")
        .select("*")
        .order("nome", { ascending: true });

      const [usersResult, schoolsResult] = await Promise.all([
        usersQuery,
        schoolsQuery,
      ]);

      setUsers(usersResult.data || []);
      setSchools(schoolsResult.data || []);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = search
        ? u.nome?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
        : true;

      const matchesRole = filterRole
        ? Number(u.role_id) === Number(filterRole)
        : true;

      const matchesSchool = filterSchool ? u.escola_id === filterSchool : true;

      return matchesSearch && matchesRole && matchesSchool;
    });
  }, [users, search, filterRole, filterSchool]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterSchool]);

  const getRoleLabel = (roleId) => {
    return ROLES.find((r) => r.id === Number(roleId))?.label || "—";
  };

  const getSchoolName = (schoolId) => {
    return schools.find((s) => s.id === schoolId)?.nome || "—";
  };

  async function handleAddUser() {
    const { nome, email, password, role_id, escola_id, pdt } = addForm;

    if (!nome || !email || !password || !role_id) {
      notify.error("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setAdding(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        notify.error("Usuário não autenticado.");
        return;
      }

      const response = await fetch(
        "https://dwhpidekvgsxjqhiqetd.functions.supabase.co/create-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nome,
            email,
            password,
            role_id: Number(role_id),
            escola_id: escola_id || null,
            pdt,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        notify.error(data.error || "Erro ao criar usuário.");
        return;
      }

      notify.success("Usuário criado com sucesso.");

      setUsers((prev) => [
        ...prev,
        {
          id: data.user.id,
          nome,
          email,
          role_id: Number(role_id),
          escola_id: escola_id || null,
          pdt,
          created_at: new Date().toISOString(),
        },
      ]);

      setAddForm({
        nome: "",
        email: "",
        password: "",
        role_id: "",
        escola_id: "",
        pdt: false,
      });

      setAddModalOpen(false);
    } catch (err) {
      console.error(err);
      notify.error("Erro inesperado.");
    } finally {
      setAdding(false);
    }
  }

  async function handleEditUser() {
    if (!editForm) return;

    try {
      setEditing(true);

      const { error } = await supabase
        .from("usuarios")
        .update({
          nome: editForm.nome,
          email: editForm.email,
          role_id: Number(editForm.role_id),
          escola_id: editForm.escola_id || null,
          pdt: editForm.pdt,
        })
        .eq("id", editForm.id);

      if (error) {
        notify.error("Erro ao atualizar usuário.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editForm.id
            ? {
              ...u,
              ...editForm,
              role_id: Number(editForm.role_id),
            }
            : u,
        ),
      );

      notify.success("Usuário atualizado.");

      setEditModalOpen(false);
      setEditForm(null);
    } catch (err) {
      console.error(err);
      notify.error("Erro inesperado.");
    } finally {
      setEditing(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;

    try {
      setDeleting(true);

      const { error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", selectedUser.id);

      if (error) {
        notify.error("Erro ao excluir usuário.");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));

      notify.success("Usuário excluído.");

      setDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      notify.error("Erro inesperado.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExportPDF() {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("Relatório de Usuários", 14, 20);

      const rows = filteredUsers.map((u) => [
        u.nome,
        u.email,
        getRoleLabel(u.role_id),
        getSchoolName(u.escola_id),
        u.pdt ? "Sim" : "Não",
      ]);

      autoTable(doc, {
        startY: 30,
        head: [["Nome", "E-mail", "Função", "Escola", "PDT"]],
        body: rows,
      });

      doc.save("usuarios.pdf");

      notify.success("PDF exportado.");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao exportar PDF.");
    }
  }

  async function loadTurmas(escolaId) {
    if (!escolaId) {
      setTurmas([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });

      if (error) {
        throw error;
      }

      setTurmas(data || []);
    } catch (err) {
      console.error(err);
      notify.error("Erro ao carregar turmas.");
    }
  }

  async function handleExportOccurrences() {
    try {
      setExporting(true);
      await handleExportPDF();
    } catch (err) {
      console.error(err);
      notify.error("Erro ao exportar ocorrências.");
    } finally {
      setExporting(false);
    }
  }

  const columns = [
    {
      key: "nome",
      title: "Nome",
      render: (u) => (
        <span className="font-medium text-slate-900 dark:text-white">
          {u.nome}
        </span>
      ),
    },

    {
      key: "email",
      title: "E-mail",
    },

    {
      key: "role",
      title: "Função",
      render: (u) => (
        <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
          {getRoleLabel(u.role_id)}
        </span>
      ),
    },

    {
      key: "school",
      title: "Escola",
      render: (u) => getSchoolName(u.escola_id),
    },

    {
      key: "pdt",
      title: "PDT",
      render: (u) =>
        u.pdt ? (
          <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900 px-2 py-1 text-xs font-semibold text-green-700 dark:text-green-200">
            Sim
          </span>
        ) : (
          "—"
        ),
    },

    {
      key: "created_at",
      title: "Criado em",
      render: (u) =>
        u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—",
    },

    {
      key: "actions",
      title: "Ações",

      render: (u) => (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => {
              setEditForm({
                ...u,
                role_id: String(u.role_id),
              });

              setEditModalOpen(true);
            }}
          >
            Editar
          </Button>

          <Button
            size="xs"
            variant="destructive"
            onClick={() => {
              setSelectedUser(u);
              setDeleteModalOpen(true);
            }}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  if (!isDiretor) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="text-4xl">🔒</div>

        <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  return (
  <div className="flex flex-col gap-8 w-full dark:bg-slate-950">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <PageTitle
        title="Gestão de Alunos"
        subtitle="Filtre, mova turmas e importe os alunos por planilha CSV."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
        >
          Voltar
        </Button>

        <Button
          onClick={handleDownloadTemplate}
          className="whitespace-nowrap"
          disabled={!selectedTurma}
        >
          {selectedTurma
            ? "Baixar template CSV"
            : "Selecione a turma para baixar"}
        </Button>
      </div>
    </div>

    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormSelect
            label="Filtrar escola"
            value={selectedEscola}
            onChange={(e) => setSelectedEscola(e.target.value)}
          >
            {escolaOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </FormSelect>

          <FormSelect
            label="Filtrar turma"
            value={selectedTurma}
            onChange={(e) => setSelectedTurma(e.target.value)}
          >
            {turmaOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="mt-4">
          <FormInput
            label="Buscar aluno"
            placeholder="Nome ou matrícula"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FormSelect
            label="Turma de origem"
            value={sourceTurma}
            onChange={(e) =>
              setSourceTurma(e.target.value)
            }
          >
            {origemTurmaOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </FormSelect>

          <FormSelect
            label="Turma de destino"
            value={targetTurma}
            onChange={(e) =>
              setTargetTurma(e.target.value)
            }
          >
            {destinoTurmaOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </FormSelect>
        </div>

        <Button
          onClick={handleBulkMove}
          disabled={bulkLoading}
          className="mt-4"
        >
          {bulkLoading
            ? "Movendo alunos..."
            : "Mover todos da turma"}
        </Button>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Relatório ou exclusão
          </p>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Selecione alunos ou use o filtro para gerar relatório e excluir
            alunos da turma selecionada.
          </p>

          <div className="mt-4 grid items-end gap-3 sm:grid-cols-2">
            <FormSelect
              label="Formato do relatório"
              value={reportFormat}
              onChange={(e) =>
                setReportFormat(e.target.value)
              }
            >
              {reportFormatOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </FormSelect>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleDownloadFinalReport}
                variant="outline"
                disabled={reportLoading}
              >
                {reportLoading
                  ? "Gerando relatório..."
                  : "Gerar relatório"}
              </Button>

              <Button
                variant="destructive"
                onClick={() =>
                  setDeleteModalOpen(true)
                }
              >
                Excluir alunos da turma
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Importar CSV
          </p>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use o template para carregar alunos com nome, matrícula,
            turma_id e escola_id.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleUploadCsv}
            className="mt-3 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-green-700 file:px-4 file:py-2 file:font-semibold file:text-white"
          />

          {fileName && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Arquivo: {fileName}
            </p>
          )}

          {fileErrors.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <p className="font-semibold">
                Erros no CSV:
              </p>

              <ul className="list-disc pl-5">
                {fileErrors.map((error, index) => (
                  <li key={index}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Alunos encontrados
            </p>

            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {filteredAlunos.length}
            </p>
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300">
            {selectedCount > 0
              ? `${selectedCount} aluno(s) selecionado(s)`
              : "Selecione alunos para ações rápidas"}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      filteredAlunos.length > 0 &&
                      selectedAlunoIds.length === filteredAlunos.length
                    }
                    onChange={handleToggleAll}
                  />
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Aluno
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Matrícula
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Turma
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Escola
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Status
                </th>

                <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    Carregando alunos...
                  </td>
                </tr>
              ) : filteredAlunos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                filteredAlunos.map((aluno) => (
                  <tr
                    key={aluno.id}
                    className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedAlunoIds.includes(aluno.id)}
                        onChange={() =>
                          handleToggleAluno(aluno.id)
                        }
                      />
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {aluno.nome}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {aluno.matricula || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {getTurmaName(aluno.turma_id)}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {getEscolaName(aluno.escola_id)}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {aluno.status || "normal"}
                    </td>

                    <td className="flex flex-wrap gap-2 px-4 py-3">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          openEditAluno(aluno)
                        }
                      >
                        Editar
                      </Button>

                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() =>
                          openDeleteAluno(aluno)
                        }
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);
};
