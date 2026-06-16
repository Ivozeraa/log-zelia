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
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";

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
    <div className="flex w-full flex-col gap-8 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle
          title="Gerenciamento"
          subtitle="Gerencie usuários e permissões."
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => navigate("/gestao/alunos")}
          >
            <FaUsers size={16} />
            Gerenciar alunos
          </Button>

          <Button className="flex items-center gap-2" onClick={handleExportPDF}>
            <FaFilePdf size={16} />
            Exportar PDF
          </Button>

          <Button onClick={() => setAddModalOpen(true)}>+ Novo usuário</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card title="Total de usuários" content={users.length} />

        <Card
          title="Professores PDT"
          content={users.filter((u) => u.pdt).length}
        />

        <Card title="Escolas" content={schools.length} />

        <Card title="Exibidos" content={filteredUsers.length} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            label="Buscar usuário"
            placeholder="Nome ou e-mail"
            className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
          />
        </div>
        <CustomSelect
          label="Filtrar função"
          value={filterRole}
          onChange={setFilterRole}
          placeholder="Todas as funções"
          options={[
            { value: "", label: "Todas as funções" },
            ...ROLES.map((r) => ({ value: r.id, label: r.label })),
          ]}
          className="flex flex-col gap-1"
        />
        <CustomSelect
          label="Filtrar escola"
          value={filterSchool}
          onChange={setFilterSchool}
          placeholder="Todas as escolas"
          options={[
            { value: "", label: "Todas as escolas" },
            ...schools.map((s) => ({ value: s.id, label: s.nome })).sort((a, b) => a.label.localeCompare(b.label)),
          ]}
          className="flex flex-col gap-1"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <Table columns={columns} data={paginatedUsers} loading={loading} />

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="xs"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            ←
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              size="xs"
              variant={currentPage === page ? "default" : "outline"}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}

          <Button
            variant="outline"
            size="xs"
            disabled={currentPage === totalPages}
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
          >
            →
          </Button>
        </div>
      )}

      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Adicionar usuário"
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <FormInput
                label="Nome *"
                value={addForm.nome}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, nome: e.target.value }))
                }
                placeholder="Nome completo"
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <FormInput
                type="email"
                label="E-mail *"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="email@exemplo.com"
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <FormInput
                type="password"
                label="Senha *"
                value={addForm.password}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Senha inicial"
                className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
              />
            </div>
            <CustomSelect
              label="Função *"
              value={addForm.role_id}
              onChange={(value) =>
                setAddForm((f) => ({ ...f, role_id: value }))
              }
              placeholder="Selecione..."
              options={[
                { value: "", label: "Selecione..." },
                ...ROLES.map((r) => ({ value: r.id, label: r.label })),
              ]}
              className="flex flex-col gap-1"
            />
            <CustomSelect
              label="Escola"
              value={addForm.escola_id}
              onChange={(value) =>
                setAddForm((f) => ({ ...f, escola_id: value }))
              }
              placeholder="Nenhuma / Global"
              options={[
                { value: "", label: "Nenhuma / Global" },
                ...schools.map((s) => ({ value: s.id, label: s.nome })).sort((a, b) => a.label.localeCompare(b.label)),
              ]}
              className="flex flex-col gap-1 sm:col-span-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <FormInput
              type="checkbox"
              checked={addForm.pdt}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  pdt: e.target.checked,
                }))
              }
              className="h-4 w-4 accent-green-700"
            />

            <span className="text-sm text-slate-700 dark:text-slate-300">
              Professor PDT
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancelar
            </Button>

            <Button onClick={handleAddUser} disabled={adding}>
              {adding ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditForm(null);
        }}
        title="Editar usuário"
      >
        {editForm && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <FormInput
                  label="Nome *"
                  value={editForm.nome || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <FormInput
                  type="email"
                  label="E-mail *"
                  value={editForm.email || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
                />
              </div>
              <CustomSelect
                label="Função *"
                value={editForm.role_id || ""}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, role_id: value }))
                }
                placeholder="Selecione..."
                options={ROLES.map((r) => ({
                  value: r.id,
                  label: r.label,
                }))}
                className="flex flex-col gap-1"
              />
              <CustomSelect
                label="Escola"
                value={editForm.escola_id || ""}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, escola_id: value }))
                }
                placeholder="Nenhuma / Global"
                options={[
                  { value: "", label: "Nenhuma / Global" },
                  ...schools.map((s) => ({ value: s.id, label: s.nome })).sort((a, b) => a.label.localeCompare(b.label)),
                ]}
                className="flex flex-col gap-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <FormInput
                type="checkbox"
                checked={editForm.pdt}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    pdt: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-green-700"
              />

              <span className="text-sm text-slate-700 dark:text-slate-300">
                Professor PDT
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditModalOpen(false);

                  setEditForm(null);
                }}
              >
                Cancelar
              </Button>

              <Button onClick={handleEditUser} disabled={editing}>
                {editing ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Export Occurrences Modal */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportFilters({
            escola_id: "",
            turma_id: "",
            periodo: "todos",
            categoria: "",
            tipo: "",
          });
          setTurmas([]);
        }}
        title="Exportar Relatório de Ocorrências"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Configure os filtros para gerar o relatório de ocorrências em PDF.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <CustomSelect
              label="Escola"
              value={exportFilters.escola_id}
              onChange={(value) => {
                setExportFilters((f) => ({
                  ...f,
                  escola_id: value,
                  turma_id: "",
                }));
                loadTurmas(value);
              }}
              placeholder="Todas as escolas"
              options={[
                { value: "", label: "Todas as escolas" },
                ...schools.map((s) => ({ value: s.id, label: s.nome })).sort((a, b) => a.label.localeCompare(b.label)),
              ]}
              className="flex flex-col gap-1"
            />

            <CustomSelect
              label="Turma"
              value={exportFilters.turma_id}
              onChange={(value) =>
                setExportFilters((f) => ({ ...f, turma_id: value }))
              }
              placeholder="Todas as turmas"
              options={[
                { value: "", label: "Todas as turmas" },
                ...turmas.map((t) => ({ value: t.id, label: t.nome })).sort((a, b) => a.label.localeCompare(b.label)),
              ]}
              disabled={!exportFilters.escola_id}
              className="flex flex-col gap-1"
              emptyLabel="Nenhuma turma disponível"
            />

            <CustomSelect
              label="Período"
              value={exportFilters.periodo}
              onChange={(value) =>
                setExportFilters((f) => ({ ...f, periodo: value }))
              }
              placeholder="Todo o período"
              options={[
                { value: "todos", label: "Todo o período" },
                { value: "dia", label: "Hoje" },
                { value: "semana", label: "Esta semana" },
                { value: "mes", label: "Este mês" },
              ]}
              className="flex flex-col gap-1"
            />

            <CustomSelect
              label="Categoria"
              value={exportFilters.categoria}
              onChange={(value) =>
                setExportFilters((f) => ({ ...f, categoria: value }))
              }
              placeholder="Todas as categorias"
              options={[
                { value: "", label: "Todas as categorias" },
                { value: "ocorrencia", label: "Ocorrência" },
                { value: "suspensao", label: "Suspensão" },
              ]}
              className="flex flex-col gap-1"
            />

            <CustomSelect
              label="Tipo"
              value={exportFilters.tipo}
              onChange={(value) =>
                setExportFilters((f) => ({ ...f, tipo: value }))
              }
              placeholder="Todos os tipos"
              options={[
                { value: "", label: "Todos os tipos" },
                { value: "indisciplina", label: "Indisciplina" },
                { value: "infrequencia", label: "Infrequência" },
                { value: "atraso", label: "Atraso" },
                { value: "desrespeito", label: "Desrespeito" },
                { value: "outro", label: "Outro" },
              ]}
              className="flex flex-col gap-1"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setExportModalOpen(false);
                setExportFilters({
                  escola_id: "",
                  turma_id: "",
                  periodo: "todos",
                  categoria: "",
                  tipo: "",
                });
                setTurmas([]);
              }}
              className="px-4 py-2"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportOccurrences}
              disabled={exporting}
              className="px-4 py-2"
            >
              {exporting ? "Exportando..." : "Exportar PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedUser(null);
        }}
        title="Excluir usuário"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir o usuário{" "}
            <strong>{selectedUser?.nome}</strong>? Essa ação não pode ser
            desfeita.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              Confirme com sua senha
            </label>
            <FormInput
              type="password"
              value={deleteConfirmSenha}
              onChange={(e) => setDeleteConfirmSenha(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0"
              placeholder="Sua senha"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);

                setSelectedUser(null);
              }}
            >
              Cancelar
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
