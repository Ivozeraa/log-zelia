import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaFilePdf, FaUsers } from "react-icons/fa";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/Modal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { PageTitle } from "../components/ui/PageTitle";

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
  const itemsPerPage = 10;

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    nome: "",
    email: "",
    password: "",
    role_id: "",
    escola_id: "",
    pdt: false,
  });
  const [adding, setAdding] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editing, setEditing] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirmSenha, setDeleteConfirmSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    escola_id: "",
    turma_id: "",
    periodo: "todos",
    categoria: "",
    tipo: "",
  });
  const [exporting, setExporting] = useState(false);
  const [turmas, setTurmas] = useState([]);

  useEffect(() => {
    if (user) {
      setIsDiretor(
        user.role_id === 1 || user.role_id === 2 || user.role_id === 3,
      );
    }
  }, [user]);

  useEffect(() => {
    if (!isDiretor) return;
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const usersQuery = supabase
          .from("usuarios")
          .select("id, nome, email, role_id, escola_id, pdt, created_at")
          .order("nome", { ascending: true });

        const schoolsQuery = supabase
          .from("escolas")
          .select("id, nome")
          .order("nome", { ascending: true });

        if (user.role_id !== 1 && user.escola_id) {
          usersQuery.eq("escola_id", user.escola_id);
        }

        const [usersResult, schoolsResult] = await Promise.all([
          usersQuery,
          schoolsQuery,
        ]);

        setUsers(usersResult.data || []);
        setSchools(schoolsResult.data || []);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os dados.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isDiretor, user]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesName = search
        ? u.nome?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesRole = filterRole ? u.role_id === Number(filterRole) : true;
      const matchesSchool = filterSchool ? u.escola_id === filterSchool : true;
      return matchesName && matchesRole && matchesSchool;
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

  async function handleAddUser() {
    const { nome, email, password, role_id, escola_id, pdt } = addForm;

    if (!nome || !email || !password || !role_id) {
      notify.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setAdding(true);

    try {
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

      console.log("STATUS:", response.status);
      console.log("DATA:", data);

      if (!response.ok) {
        notify.error(data.error || "Erro ao criar usuário");
        return;
      }
      notify.success("Usuário criado com sucesso!");

      setAddModalOpen(false);

      setAddForm({
        nome: "",
        email: "",
        password: "",
        role_id: "",
        escola_id: "",
        pdt: false,
      });

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

      setAddModalOpen(false);

      setAddForm({
        nome: "",
        email: "",
        password: "",
        role_id: "",
        escola_id: "",
        pdt: false,
      });
    } catch (err) {
      console.error(err);
      notify.error("Erro inesperado.");
    } finally {
      setAdding(false);
    }
  }

  async function handleEditUser() {
    if (!editForm) return;

    const { id, nome, email, role_id, escola_id, pdt } = editForm;

    setEditing(true);

    if (!canEditUser(editForm)) {
      notify.error("Você não pode editar este usuário.");
      setEditing(false);
      return;
    }

    const allowedRoles = getAllowedRoles().map((r) => r.id);

    if (!allowedRoles.includes(Number(role_id))) {
      notify.error("Você não pode atribuir essa função.");
      setEditing(false);
      return;
    }
    const { error } = await supabase
      .from("usuarios")
      .update({
        nome,
        email,
        role_id: Number(role_id),
        escola_id: escola_id || null,
        pdt,
      })
      .eq("id", id);

    if (error) {
      notify.error("Erro ao atualizar usuário.");
      setEditing(false);
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
            ...u,
            nome,
            email,
            role_id: Number(role_id),
            escola_id: escola_id || null,
            pdt,
          }
          : u,
      ),
    );

    notify.success("Usuário atualizado.");
    setEditModalOpen(false);
    setEditForm(null);
    setEditing(false);
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    if (!deleteConfirmSenha) {
      notify.error("Digite sua senha para confirmar.");
      return;
    }

    setDeleting(true);

    if (!canDeleteUser(selectedUser)) {
      notify.error("Você não pode excluir este usuário.");
      setDeleting(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deleteConfirmSenha,
    });

    if (authError) {
      notify.error("Senha incorreta.");
      setDeleting(false);
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", selectedUser.id);

    console.log("Delete error:", error);

    if (error) {
      notify.error("Erro ao excluir usuário.");
      setDeleting(false);
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
    notify.success("Usuário removido.");
    setDeleteModalOpen(false);
    setSelectedUser(null);
    setDeleteConfirmSenha("");
    setDeleting(false);
  }

  const handleExportOccurrences = async () => {
    setExporting(true);

    try {
      const hoje = new Date();
      let dataInicio = null;
      let dataFim = null;

      switch (exportFilters.periodo) {
        case "dia":
          dataInicio = new Date(hoje);
          dataInicio.setHours(0, 0, 0, 0);
          dataFim = new Date(hoje);
          dataFim.setHours(23, 59, 59, 999);
          break;
        case "semana":
          dataInicio = new Date(hoje);
          dataInicio.setDate(hoje.getDate() - hoje.getDay());
          dataInicio.setHours(0, 0, 0, 0);
          dataFim = new Date(hoje);
          dataFim.setHours(23, 59, 59, 999);
          break;
        case "mes":
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          dataFim = new Date(hoje);
          dataFim.setHours(23, 59, 59, 999);
          break;
        case "todos":
        default:
          // Não aplicar filtro de data
          break;
      }

      // Buscar ocorrências com filtros aplicados
      let query = supabase
        .from("ocorrencias")
        .select(`
          *,
          alunos!inner(nome),
          turmas!inner(nome),
          usuarios!inner(nome)
        `)
        .order("data_ocorrido", { ascending: false });

      // Aplicar filtros
      if (exportFilters.escola_id) {
        query = query.eq("escola_id", exportFilters.escola_id);
      }

      if (exportFilters.turma_id) {
        query = query.eq("turma_id", exportFilters.turma_id);
      }

      if (dataInicio && dataFim) {
        query = query.gte("data_ocorrido", dataInicio.toISOString().split('T')[0]);
        query = query.lte("data_ocorrido", dataFim.toISOString().split('T')[0]);
      }

      if (exportFilters.categoria) {
        query = query.eq("categoria", exportFilters.categoria);
      }

      if (exportFilters.tipo) {
        query = query.eq("tipo", exportFilters.tipo);
      }

      // Aplicar restrições de permissão
      if (user.role_id !== 1 && user.escola_id) {
        query = query.eq("escola_id", user.escola_id);
      }

      const { data: occurrences, error } = await query;

      if (error) {
        console.error("Erro ao buscar ocorrências:", error);
        notify.error("Erro ao buscar ocorrências para exportação");
        setExporting(false);
        return;
      }

      if (!occurrences || occurrences.length === 0) {
        notify.warning("Nenhuma ocorrência encontrada com os filtros aplicados");
        setExporting(false);
        return;
      }

      // Criar PDF
      const doc = new jsPDF();
      const title = `Relatório de Ocorrências - ${new Date().toLocaleDateString('pt-BR')}`;

      // Título
      doc.setFontSize(16);
      doc.text(title, 14, 15);

      // Filtros aplicados
      doc.setFontSize(10);
      let yPos = 25;
      const filtrosAplicados = [];

      if (exportFilters.escola_id) {
        const escola = schools.find(s => s.id === exportFilters.escola_id);
        filtrosAplicados.push(`Escola: ${escola?.nome || 'N/A'}`);
      }

      if (exportFilters.turma_id) {
        const turma = turmas.find(t => t.id === exportFilters.turma_id);
        filtrosAplicados.push(`Turma: ${turma?.nome || 'N/A'}`);
      }

      // Adicionar período ao filtro
      const periodoLabels = {
        dia: "Hoje",
        semana: "Esta semana",
        mes: "Este mês",
        todos: "Todo o período"
      };
      filtrosAplicados.push(`Período: ${periodoLabels[exportFilters.periodo] || 'Todos'}`);

      if (exportFilters.categoria) {
        filtrosAplicados.push(`Categoria: ${exportFilters.categoria}`);
      }

      if (exportFilters.tipo) {
        filtrosAplicados.push(`Tipo: ${exportFilters.tipo}`);
      }

      if (filtrosAplicados.length > 0) {
        doc.text(`Filtros: ${filtrosAplicados.join(' | ')}`, 14, yPos);
        yPos += 10;
      }

      // Preparar dados para a tabela
      const tableData = occurrences.map(ocorrencia => [
        new Date(ocorrencia.data_ocorrido).toLocaleDateString('pt-BR'),
        ocorrencia.alunos?.nome || 'N/A',
        ocorrencia.turmas?.nome || 'N/A',
        ocorrencia.categoria || 'N/A',
        ocorrencia.tipo || 'N/A',
        ocorrencia.descricao?.substring(0, 25) + (ocorrencia.descricao?.length > 25 ? '...' : '') || 'N/A',
        ocorrencia.usuarios?.nome || 'N/A'
      ]);

      // Gerar tabela
      autoTable(doc, {
        head: [['Data', 'Aluno', 'Turma', 'Categoria', 'Tipo', 'Descrição', 'Professor']],
        body: tableData,
        startY: yPos + 5,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [22, 163, 74],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 15 },
          5: { cellWidth: 'auto' },
          6: { cellWidth: 20 },
        },
        margin: { top: yPos + 5, right: 10, bottom: 10, left: 10 },
      });

      // Rodapé com total de ocorrências
      const finalY = (doc.lastAutoTable?.finalY) || (yPos + 5);
      doc.text(`Total de ocorrências: ${occurrences.length}`, 14, finalY + 10);

      // Salvar PDF
      doc.save(`relatorio-ocorrencias-${new Date().toISOString().split('T')[0]}.pdf`);
      notify.success('PDF exportado com sucesso!');

      setExportModalOpen(false);
      setExportFilters({
        escola_id: "",
        turma_id: "",
        periodo: "todos",
        categoria: "",
        tipo: "",
      });

    } catch (err) {
      console.error("Erro na exportação:", err);
      notify.error("Erro inesperado durante a exportação");
    } finally {
      setExporting(false);
    }
  };

  const loadTurmas = async (escolaId) => {
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
        console.error("Erro ao carregar turmas:", error);
        setTurmas([]);
      } else {
        setTurmas(data || []);
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar turmas:", err);
      setTurmas([]);
    }
  };

  const getRoleLabel = (role_id) =>
    ROLES.find((r) => r.id === role_id)?.label || "—";

  const getSchoolName = (escola_id) =>
    schools.find((s) => s.id === escola_id)?.nome || "—";

  if (!isDiretor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="text-4xl">🔒</div>
        <p className="text-slate-600 text-lg font-medium">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  const canEditUser = (targetUser) => {
    const targetRole = Number(targetUser.role_id);

    if (user.role_id !== 1 && user.escola_id !== targetUser.escola_id) {
      return false;
    }

    if (user.role_id === 1) {
      return true;
    }

    if (user.role_id === 2 && (targetRole === 3 || targetRole === 4)) {
      return true;
    }

    if (user.role_id === 3 && targetRole === 4) {
      return true;
    }
    return false;
  };
  const getAllowedRoles = () => {
    if (user.role_id === 1) {
      return ROLES;
    }

    if (user.role_id === 2) {
      return ROLES.filter((r) => r.id === 3 || r.id === 4);
    }

    if (user.role_id === 3) {
      return ROLES.filter((r) => r.id === 4);
    }

    return [];
  };

  const canDeleteUser = (targetUser) => {
    const targetRole = Number(targetUser.role_id);

    if (user.role_id !== 1 && user.escola_id !== targetUser.escola_id) {
      return false;
    }
    if (user.role_id === 1) {
      return true;
    }
    if (user.role_id === 2 && (targetRole === 3 || targetRole === 4)) {
      return true;
    }
    if (user.role_id === 3 && targetRole === 4) {
      return true;
    }

    return false;
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title="Gerenciamento" subtitle="Gerencie usuários, funções e vínculos escolares." />

        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => navigate("/gestao/alunos")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FaUsers size={18} className="text-green-500" />
            <span>Gerenciar Alunos</span>
          </Button>
          <Button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <FaFilePdf size={18} className="text-white" />
            <span>Exportar Ocorrências</span>
          </Button>
          <Button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Novo usuário
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total de usuários</p>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Professores PDT</p>
          <p className="text-2xl font-bold text-slate-900">
            {users.filter((u) => u.pdt).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Escolas</p>
          <p className="text-2xl font-bold text-slate-900">{schools.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Exibidos</p>
          <p className="text-2xl font-bold text-slate-900">
            {filteredUsers.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">
            Buscar usuário
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou e-mail"
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">
            Filtrar função
          </label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">Todas as funções</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">
            Filtrar escola
          </label>
          <select
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">Todas as escolas</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Nome</th>
              <th className="border-b border-slate-200 px-4 py-3">E-mail</th>
              <th className="border-b border-slate-200 px-4 py-3">Função</th>
              <th className="border-b border-slate-200 px-4 py-3">Escola</th>
              <th className="border-b border-slate-200 px-4 py-3">PDT</th>
              <th className="border-b border-slate-200 px-4 py-3">Criado em</th>
              <th className="border-b border-slate-200 px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Carregando usuários...
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-200 last:border-none hover:bg-slate-50 transition"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.nome}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5">
                      {getRoleLabel(u.role_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {getSchoolName(u.escola_id)}
                  </td>
                  <td className="px-4 py-3">
                    {u.pdt ? (
                      <span className="inline-block rounded-full bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5">
                        Sim
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    {canEditUser(u) && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditForm({
                            ...u,
                            nome: u.nome || "",
                            email: u.email || "",
                            role_id: String(u.role_id || ""),
                            escola_id: u.escola_id || "",
                            pdt: !!u.pdt,
                          });
                          setEditModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 border-blue-200"
                      >
                        Editar
                      </Button>
                    )}
                    {canDeleteUser(u) && (
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
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {/* Add User Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddForm({
            nome: "",
            email: "",
            password: "",
            role_id: "",
            escola_id: "",
            pdt: false,
          });
        }}
        title="Adicionar novo usuário"
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Nome *</label>
              <input
                type="text"
                value={addForm.nome}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, nome: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="Nome completo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">E-mail *</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, email: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Senha *</label>
              <input
                type="password"
                value={addForm.password}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, password: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="Senha inicial"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Função *</label>
              <select
                value={addForm.role_id}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, role_id: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              >
                <option value="">Selecione...</option>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium">Escola</label>
              <select
                value={addForm.escola_id}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, escola_id: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              >
                <option value="">Nenhuma / Global</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="add_pdt"
              checked={addForm.pdt}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, pdt: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer"
            />
            <label
              htmlFor="add_pdt"
              className="text-sm text-slate-700 cursor-pointer"
            >
              Professor de Turma (PDT)
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={adding}
              className="px-4 py-2"
            >
              {adding ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
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
                <label className="text-sm font-medium">Nome *</label>
                <input
                  type="text"
                  value={editForm.nome || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">E-mail *</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Função *</label>
                <select
                  value={editForm.role_id || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, role_id: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {getAllowedRoles().map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Escola</label>
                <select
                  value={editForm.escola_id || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, escola_id: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Nenhuma / Global</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_pdt"
                checked={editForm.pdt || false}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, pdt: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer"
              />
              <label
                htmlFor="edit_pdt"
                className="text-sm text-slate-700 cursor-pointer"
              >
                Professor de Turma (PDT)
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditForm(null);
                }}
                className="px-4 py-2"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditUser}
                disabled={editing}
                className="px-4 py-2"
              >
                {editing ? "Salvando..." : "Salvar alterações"}
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Escola</label>
              <select
                value={exportFilters.escola_id}
                onChange={(e) => {
                  setExportFilters((f) => ({
                    ...f,
                    escola_id: e.target.value,
                    turma_id: "", // Resetar turma quando escola muda
                  }));
                  loadTurmas(e.target.value);
                }}
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as escolas</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Turma</label>
              <select
                value={exportFilters.turma_id}
                onChange={(e) =>
                  setExportFilters((f) => ({ ...f, turma_id: e.target.value }))
                }
                disabled={!exportFilters.escola_id}
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Todas as turmas</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Período</label>
              <select
                value={exportFilters.periodo}
                onChange={(e) =>
                  setExportFilters((f) => ({ ...f, periodo: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="todos">Todo o período</option>
                <option value="dia">Hoje</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mês</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Categoria</label>
              <select
                value={exportFilters.categoria}
                onChange={(e) =>
                  setExportFilters((f) => ({ ...f, categoria: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as categorias</option>
                <option value="ocorrencia">Ocorrência</option>
                <option value="suspensao">Suspensão</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Tipo</label>
              <select
                value={exportFilters.tipo}
                onChange={(e) =>
                  setExportFilters((f) => ({ ...f, tipo: e.target.value }))
                }
                className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todos os tipos</option>
                <option value="indisciplina">Indisciplina</option>
                <option value="infrequencia">Infrequência</option>
                <option value="atraso">Atraso</option>
                <option value="desrespeito">Desrespeito</option>
                <option value="outro">Outro</option>
              </select>
            </div>
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
          setDeleteConfirmSenha("");
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
            <input
              type="password"
              value={deleteConfirmSenha}
              onChange={(e) => setDeleteConfirmSenha(e.target.value)}
              className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
              placeholder="Sua senha"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedUser(null);
                setDeleteConfirmSenha("");
              }}
              className="px-4 py-2"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleting}
              className="px-4 py-2"
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
