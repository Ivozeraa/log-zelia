import { useEffect, useState } from "react";
import { FaKey, FaSearch, FaShieldAlt } from "react-icons/fa";

import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PageTitle } from "../components/ui/PageTitle";
import { FormInput } from "../components/ui/FormInput";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-600/10 dark:border-slate-700 dark:bg-slate-900";

export const StudentPasswordReset = () => {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadStudents = async (value = "") => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("listar_alunos_senha_admin", {
        p_busca: value.trim(),
      });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Erro ao localizar alunos:", error);
      notify.error("Não foi possível localizar os alunos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const openReset = (student) => {
    setSelectedStudent(student);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const closeReset = () => {
    if (resetting) return;
    setSelectedStudent(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleReset = async (event) => {
    event.preventDefault();

    if (!selectedStudent) return;

    if (newPassword.length < 8) {
      notify.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error("As senhas não coincidem.");
      return;
    }

    try {
      setResetting(true);

      const { data, error } = await supabase.rpc("resetar_senha_aluno_admin", {
        p_aluno_id: selectedStudent.aluno_id,
        p_nova_senha: newPassword,
      });

      if (error) throw error;

      const response = Array.isArray(data) ? data[0] : data;
      if (!response?.sucesso) {
        notify.error(response?.mensagem || "Não foi possível redefinir a senha.");
        return;
      }

      notify.success("Senha redefinida. O aluno deverá criar uma nova senha no próximo acesso.");
      closeReset();
    } catch (error) {
      console.error("Erro ao redefinir senha do aluno:", error);
      notify.error("Não foi possível redefinir a senha agora.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-8 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle
          title="Senhas dos alunos"
          subtitle="Redefina o acesso de alunos que perderam a senha de consulta de ocorrências."
        />
      </div>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-6">
        <div className="flex gap-4">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <FaShieldAlt />
          </div>
          <div>
            <h2 className="font-bold text-amber-900 dark:text-amber-200">Redefinição administrativa</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-100/80">
              A senha atual nunca é exibida. Ao redefinir, o aluno recebe uma nova senha definida pela gestão e será obrigado a criar outra no próximo acesso.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FormInput
              label="Buscar aluno"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou matrícula"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5 text-sm text-slate-500 dark:text-slate-400">
            <FaSearch />
            {loading ? "Buscando..." : `${students.length} resultado(s)`}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {students.map((student) => (
                <tr key={student.aluno_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-4 font-semibold">{student.aluno_nome}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{student.matricula || "—"}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{student.turma_nome || "—"}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{student.escola_nome || "—"}</td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      className="inline-flex items-center gap-2"
                      onClick={() => openReset(student)}
                    >
                      <FaKey size={12} />
                      Redefinir senha
                    </Button>
                  </td>
                </tr>
              ))}

              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!selectedStudent} onClose={closeReset} title="Redefinir senha do aluno">
        <form onSubmit={handleReset} className="space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-sm font-bold">{selectedStudent?.aluno_nome}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Matrícula: {selectedStudent?.matricula || "—"}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Nova senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`${inputClass} pr-20`}
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`${inputClass} pr-20`}
                placeholder="Digite novamente"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeReset} disabled={resetting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={resetting} className="inline-flex items-center justify-center gap-2">
              <FaKey size={12} />
              {resetting ? "Redefinindo..." : "Redefinir senha"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
