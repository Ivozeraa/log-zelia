import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { Modal } from "../components/Modal";

const ROLES = [
  { id: 1, label: "Super Admin" },
  { id: 2, label: "Diretor" },
  { id: 3, label: "Coordenador" },
  { id: 4, label: "Professor" },
];

export const Management = () => {
  const { user } = useAuth();

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
    is_pdt: false,
  });
  const [adding, setAdding] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editing, setEditing] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirmSenha, setDeleteConfirmSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          .select("id, nome, email, role_id, escola_id, is_pdt, created_at")
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
    const { nome, email, password, role_id, escola_id, is_pdt } = addForm;

    if (!nome || !email || !password || !role_id) {
      notify.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setAdding(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
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
            role_id,
            escola_id,
            is_pdt,
          }),
        },
      );

      const token = req.headers.get("Authorization")?.replace("Bearer ", "");

      const { data: userData } = await supabase.auth.getUser(token);

      if (!userData.user || ![1, 2, 3].includes(userData.user.role_id)) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403,
        });
      }

      if (!res.ok) {
        notify.error(data.error);
        return;
      }
    } catch (err) {
      console.error(err);
      notify.error("Erro inesperado.");
    } finally {
      setAdding(false);
    }
  }

  async function handleEditUser() {
    if (!editForm) return;
    const { id, nome, email, role_id, escola_id, is_pdt } = editForm;

    if (!nome || !email || !role_id) {
      notify.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setEditing(true);

    const { error } = await supabase
      .from("usuarios")
      .update({
        nome,
        email,
        role_id: Number(role_id),
        escola_id: escola_id || null,
        is_pdt,
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
          ? { ...u, nome, email, role_id: Number(role_id), escola_id, is_pdt }
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

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gerenciamento</h1>
          <p className="text-sm text-slate-500">
            Bem-vindo(a),{" "}
            <span className="text-green-700 font-semibold">{user?.nome}</span>!
            Gerencie usuários, funções e vínculos escolares.
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition shadow-sm"
        >
          <span className="text-lg leading-none">+</span> Novo usuário
        </button>
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
            {users.filter((u) => u.is_pdt).length}
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
                    {u.is_pdt ? (
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
                    <button
                      onClick={() => {
                        setEditForm({ ...u, role_id: String(u.role_id) });
                        setEditModalOpen(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setDeleteModalOpen(true);
                      }}
                      className="text-xs text-red-600 hover:text-red-800 hover:underline transition"
                    >
                      Excluir
                    </button>
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
                className={`px-3 py-1 rounded-full border ${
                  currentPage === page
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
            is_pdt: false,
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
              id="add_is_pdt"
              checked={addForm.is_pdt}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, is_pdt: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer"
            />
            <label
              htmlFor="add_is_pdt"
              className="text-sm text-slate-700 cursor-pointer"
            >
              Professor de Turma (PDT)
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddUser}
              disabled={adding}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {adding ? "Criando..." : "Criar usuário"}
            </button>
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
                  value={editForm.nome}
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
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Função *</label>
                <select
                  value={editForm.role_id}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, role_id: e.target.value }))
                  }
                  className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {ROLES.map((r) => (
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
                id="edit_is_pdt"
                checked={editForm.is_pdt || false}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, is_pdt: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer"
              />
              <label
                htmlFor="edit_is_pdt"
                className="text-sm text-slate-700 cursor-pointer"
              >
                Professor de Turma (PDT)
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditForm(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditUser}
                disabled={editing}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {editing ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
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
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedUser(null);
                setDeleteConfirmSenha("");
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteUser}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition"
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
