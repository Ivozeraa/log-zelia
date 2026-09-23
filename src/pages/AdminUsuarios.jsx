import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSearch, FaUsers, FaUserShield, FaBuilding, FaSave } from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";
import { PageTitle } from "../components/ui/PageTitle";

const roleLabels = { 1: "Super Admin", 2: "Diretor", 3: "Coordenador", 4: "Professor" };

export const AdminUsuarios = () => {
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [schoolFilter, setSchoolFilter] = useState("todos");

  const load = async () => {
    setLoading(true);
    const [usersRes, schoolsRes] = await Promise.all([
      supabase.from("usuarios").select("id, nome, email, role_id, escola_id, pdt, created_at").order("nome"),
      supabase.from("escolas").select("id, nome, ativo").order("nome"),
    ]);
    const error = usersRes.error || schoolsRes.error;
    if (error) {
      console.error(error);
      notify.error("Não foi possível carregar os usuários.");
      setLoading(false);
      return;
    }
    setUsers(usersRes.data || []);
    setSchools(schoolsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const schoolMap = useMemo(() => new Map(schools.map((school) => [school.id, school])), [schools]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return users.filter((user) => {
      const haystack = [user.nome, user.email].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      const matchesSearch = !query || haystack.includes(query);
      const matchesRole = roleFilter === "todos" || String(user.role_id) === roleFilter;
      const matchesSchool = schoolFilter === "todos" || (schoolFilter === "global" ? !user.escola_id : user.escola_id === schoolFilter);
      return matchesSearch && matchesRole && matchesSchool;
    });
  }, [users, search, roleFilter, schoolFilter]);

  const updateUser = async (user) => {
    setSavingId(user.id);
    const roleId = Number(user.role_id);
    const schoolId = roleId === 1 ? null : (user.escola_id || null);
    if (roleId !== 1 && !schoolId) {
      notify.error("Usuários de escola precisam estar vinculados a uma escola.");
      setSavingId(null);
      return;
    }

    const previous = users.find((item) => item.id === user.id);
    const { error } = await supabase.from("usuarios").update({
      role_id: roleId,
      escola_id: schoolId,
      pdt: roleId === 4 ? Boolean(user.pdt) : false,
    }).eq("id", user.id);

    if (error) {
      console.error(error);
      notify.error("Não foi possível salvar o usuário.");
      setSavingId(null);
      return;
    }

    await supabase.from("logview_auditoria").insert({
      escola_id: schoolId || previous?.escola_id || null,
      acao: "alterar",
      entidade: "usuario",
      entidade_id: user.id,
      detalhes: {
        role_id_anterior: previous?.role_id ?? null,
        role_id: roleId,
        escola_id_anterior: previous?.escola_id ?? null,
        escola_id: schoolId,
        pdt: roleId === 4 ? Boolean(user.pdt) : false,
      },
    });

    setUsers((current) => current.map((item) => item.id === user.id
      ? { ...item, role_id: roleId, escola_id: schoolId, pdt: roleId === 4 ? Boolean(user.pdt) : false }
      : item));
    notify.success("Usuário atualizado.");
    setSavingId(null);
  };

  const changeUser = (id, patch) => {
    setUsers((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => Number(user.role_id) === 1).length,
    schoolUsers: users.filter((user) => Number(user.role_id) !== 1).length,
  }), [users]);

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <Link to="/app/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
        <FaArrowLeft /> Administração
      </Link>
      <PageTitle title="Usuários da plataforma" subtitle="Consulte e gerencie os usuários vinculados ao LogView." />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          [FaUsers, "Total", counts.total],
          [FaUserShield, "Super Admins", counts.admins],
          [FaBuilding, "Usuários de escolas", counts.schoolUsers],
        ].map(([Icon, label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon /></div><div><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : value}</p></div></div>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="w-full rounded-xl border border-slate-300 bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:text-white" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white lg:w-48">
              <option value="todos">Todos os perfis</option>
              <option value="1">Super Admin</option>
              <option value="2">Diretor</option>
              <option value="3">Coordenador</option>
              <option value="4">Professor</option>
            </select>
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white lg:w-56">
              <option value="todos">Todas as escolas</option>
              <option value="global">Sem escola · global</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
              <th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Escola</th><th className="px-4 py-3">PDT</th><th className="px-4 py-3">Ação</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Carregando usuários...</td></tr>
                : filteredUsers.map((user) => {
                  const school = schoolMap.get(user.escola_id);
                  const isAdmin = Number(user.role_id) === 1;
                  return (
                    <tr key={user.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                      <td className="px-4 py-4"><p className="font-semibold text-slate-800 dark:text-white">{user.nome}</p><p className="mt-1 text-xs text-slate-500">{user.email || "Sem e-mail"}</p></td>
                      <td className="px-4 py-4">
                        <select value={user.role_id} onChange={(e) => changeUser(user.id, { role_id: Number(e.target.value), escola_id: Number(e.target.value) === 1 ? null : user.escola_id })} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                          {Object.entries(roleLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select disabled={isAdmin} value={user.escola_id || ""} onChange={(e) => changeUser(user.id, { escola_id: e.target.value || null })} className="w-52 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                          <option value="">Selecionar escola</option>
                          {schools.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.ativo === false ? " · inativa" : ""}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4"><label className={`inline-flex items-center gap-2 text-xs ${Number(user.role_id) === 4 ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}><input disabled={Number(user.role_id) !== 4} type="checkbox" checked={Boolean(user.pdt)} onChange={(e) => changeUser(user.id, { pdt: e.target.checked })} className="h-4 w-4 accent-green-600" /> PDT</label></td>
                      <td className="px-4 py-4"><button disabled={savingId === user.id} onClick={() => void updateUser(user)} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FaSave />{savingId === user.id ? "Salvando..." : "Salvar"}</button></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!loading && !filteredUsers.length && <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum usuário encontrado com esses filtros.</p>}
        </div>
      </section>
    </main>
  );
};
