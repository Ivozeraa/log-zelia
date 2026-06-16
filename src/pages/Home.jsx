import { useEffect, useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";

import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormInput } from "../components/ui/FormInput";
import { CustomSelect } from "../components/ui/CustomSelect";
import { PageTitle } from "../components/ui/PageTitle";
import { SectionTitle } from "../components/ui/SectionTitle";
import { RankingOcorrencias } from "../components/ui/Ranking";

import { notify } from "../utils/notify";

export const Home = () => {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);

  const [escolas, setEscolas] = useState([]);
  const [selectedEscola, setSelectedEscola] = useState("");

  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState("");

  const [alunos, setAlunos] = useState([]);
  // ← array para suportar múltiplos alunos
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

  const [stats, setStats] = useState({
    total: 0,
    mes: 0,
    semana: 0,
  });

  const resetForm = () => {
    setSelectedTurma("");
    setSelectedAlunos([]); // ← limpa array
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
      if (!selectedEscola) return;

      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("escola_id", selectedEscola);

      if (error) {
        console.error("Erro ao carregar dashboard:", error);
        return;
      }

      const total = data.length;

      const hoje = new Date();

      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const inicioSemana = new Date(hoje);

      inicioSemana.setDate(hoje.getDate() - hoje.getDay());

      inicioSemana.setHours(0, 0, 0, 0);

      const mes = data.filter(
        (o) => new Date(o.data_ocorrido) >= inicioMes,
      ).length;

      const semana = data.filter(
        (o) => new Date(o.data_ocorrido) >= inicioSemana,
      ).length;

      setStats({
        total,
        mes,
        semana,
      });

      const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      const dadosSemana = [
        { name: "Dom", ocorrencias: 0 },
        { name: "Seg", ocorrencias: 0 },
        { name: "Ter", ocorrencias: 0 },
        { name: "Qua", ocorrencias: 0 },
        { name: "Qui", ocorrencias: 0 },
        { name: "Sex", ocorrencias: 0 },
        { name: "Sáb", ocorrencias: 0 },
      ];

      data.forEach((ocorrencia) => {
        const [ano, mes, dia] = ocorrencia.data_ocorrido.split("-").map(Number);

        const dataOcorrencia = new Date(ano, mes - 1, dia);

        dataOcorrencia.setHours(0, 0, 0, 0);

        if (dataOcorrencia >= inicioSemana) {
          const diaSemana = diasSemana[dataOcorrencia.getDay()];

          const diaEncontrado = dadosSemana.find(
            (item) => item.name === diaSemana,
          );

          if (diaEncontrado) {
            diaEncontrado.ocorrencias += 1;
          }
        }
      });

      setGraficoData(dadosSemana);
    };

    loadDashboard();
  }, [selectedEscola]);

  useEffect(() => {
    const loadEscolas = async () => {
      if (!user) return;

      let query = supabase.from("escolas").select("id, nome");

      if (Number(user.role_id) === 1) {
        const { data, error } = await query;

        if (error) {
          notify.error("Erro carregando as escolas");
          console.error(error);
          setEscolas([]);
          return;
        }

        setEscolas(data || []);

        if (data?.length > 0) {
          setSelectedEscola(data[0].id);
        }
      } else if (user.escola_id) {
        const { data, error } = await query.eq("id", user.escola_id).single();

        if (error) {
          notify.error("Erro carregando as escolas");
          console.error(error);
          setEscolas([]);
          return;
        }

        setEscolas([data]);
        setSelectedEscola(data?.id || "");
      }
    };

    loadEscolas();
  }, [user]);

  useEffect(() => {
    const loadTurmas = async () => {
      if (!selectedEscola) {
        setTurmas([]);
        setSelectedTurma("");
        return;
      }

      setLoadingTurmas(true);

      const { data: turmasData, error } = await supabase
        .from("turmas")
        .select("id, nome")
        .eq("escola_id", selectedEscola)
        .order("nome", { ascending: true });

      if (error) {
        console.error(error);
        setTurmas([]);
      } else {
        setTurmas(turmasData || []);
      }

      setLoadingTurmas(false);
    };

    loadTurmas();
  }, [selectedEscola]);

  useEffect(() => {
    const loadAlunos = async () => {
      if (!selectedTurma) {
        setAlunos([]);
        setSelectedAlunos([]); // ← limpa array
        return;
      }

      setLoadingAlunos(true);

      const { data: alunosData, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula")
        .eq("turma_id", selectedTurma)
        .order("nome", { ascending: true });

      if (error) {
        console.error(error);
        setAlunos([]);
      } else {
        setAlunos(alunosData || []);
      }

      setLoadingAlunos(false);
    };

    loadAlunos();
  }, [selectedTurma]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setFormMessage("Erro: usuário não autenticado.");
      return;
    }

    if (
      !selectedEscola ||
      !selectedTurma ||
      selectedAlunos.length === 0 || // ← valida array
      !dataOcorrido ||
      !tipoAdvertencia ||
      !tipoSituacao ||
      !descricao ||
      (tipoAdvertencia === "suspensao" && (!dataInicio || !dataTermino))
    ) {
      notify.warning(
        "Preencha todos os campos antes de registrar a ocorrência.",
      );
      setFormMessage(
        "Preencha todos os campos antes de registrar a ocorrência.",
      );
      return;
    }

    setSubmitting(true);
    setFormMessage("");

    // ← itera sobre cada aluno selecionado
    for (const alunoId of selectedAlunos) {
      const payload = {
        escola_id: selectedEscola,
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

      let willSuspend = tipoAdvertencia === "suspensao";

      if (tipoAdvertencia === "ocorrencia") {
        const { count, error: countError } = await supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .eq("aluno_id", alunoId)
          .eq("categoria", "ocorrencia");

        if (countError) {
          console.error(countError);
        } else {
          willSuspend = (count || 0) + 1 >= 3;
        }
      }

      const { error } = await supabase.from("ocorrencias").insert(payload);

      if (error) {
        console.error(error);
        notify.error("Erro ao registrar ocorrência");
        setFormMessage("Ocorreu um erro ao registrar.");
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("alunos")
        .update({ status: willSuspend ? "suspenso" : "normal" })
        .eq("id", alunoId);

      if (updateError) {
        console.error(updateError);
        notify.error("Erro ao atualizar status do aluno");
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);

    notify.success(
      selectedAlunos.length > 1
        ? `Ocorrência registrada para ${selectedAlunos.length} alunos com sucesso!`
        : "Ocorrência registrada com sucesso!",
    );

    setFormMessage("Ocorrência registrada com sucesso!");
    resetForm();
    setOpen(false);
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <PageTitle
          title="Início"
          subtitle={
            <>
              Bem-vindo(a),{" "}
              <span className="font-semibold text-green-700">{user?.nome}</span>
              ! monitore as ocorrências registradas e adicione novas
              advertências.
            </>
          }
        />

        <Button onClick={() => setOpen(true)} className="gap-2">
          <FaExclamationTriangle size={20} className="text-white" />
          <span>Adicionar Advertência</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle text="Visão Geral" />

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Ocorrências totais" content={stats.total} />
          <Card title="Este mês" content={stats.mes} />
          <Card title="Esta semana" content={stats.semana} />
        </div>

        <div className="mt-1 text-sm">
          {stats.semana > stats.mes * 0.4 ? (
            <span className="font-medium text-red-600">
              ⚠️ Alta concentração de ocorrências nesta semana.
            </span>
          ) : (
            <span className="font-medium text-green-600">
              ✔️ Fluxo de ocorrências dentro do normal.
            </span>
          )}
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Fluxo de Ocorrências
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Monitoramento semanal de registros
              </p>
            </div>
            <div className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Últimos 7 dias
            </div>
          </div>

          <div className="w-full h-[250px] sm:h-[300px] md:h-[350px] lg:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={graficoData}
                margin={{
                  top: 0,
                  right: 20,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />

                <Tooltip
                  contentStyle={{
                    borderRadius: "14px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="ocorrencias"
                  stroke="#16a34a"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#16a34a",
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <RankingOcorrencias escolaId={user?.escola_id} />
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Adicionar Advertência"
      >
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          {formMessage && (
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {formMessage}
            </div>
          )}

          <CustomSelect
            label="Escola"
            value={selectedEscola}
            onChange={(val) => {
              setSelectedEscola(val);
              setSelectedTurma("");
              setSelectedAlunos([]);
            }}
            options={[
              { value: "", label: "Selecionar escola" },
              ...escolas
                .map((e) => ({ value: String(e.id), label: e.nome }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            ]}
            placeholder="Selecionar escola"
          />

          <CustomSelect
            label="Turma"
            value={selectedTurma}
            disabled={!selectedEscola || loadingTurmas}
            onChange={(val) => {
              setSelectedTurma(val);
              setSelectedAlunos([]);
            }}
            options={[
              { value: "", label: "Selecionar turma" },
              ...turmas
                .map((t) => ({ value: String(t.id), label: t.nome }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            ]}
            placeholder="Selecionar turma"
          />

          {/* ← multiple={true} aqui */}
          <CustomSelect
            label="Aluno(s)"
            value={selectedAlunos}
            disabled={!selectedTurma || loadingAlunos}
            onChange={(val) => setSelectedAlunos(val)}
            options={alunos
              .map((a) => ({
                value: String(a.id),
                label: `${a.nome} - ${a.matricula || "sem matrícula"}`,
              }))
              .sort((a, b) => a.label.localeCompare(b.label))}
            placeholder="Selecionar aluno(s)"
            showSearch={true}
            multiple={true}
          />

          <CustomSelect
            label="Tipo de advertência"
            value={tipoAdvertencia}
            onChange={(val) => setTipoAdvertencia(val)}
            options={[
              { value: "", label: "Selecionar tipo" },
              { value: "ocorrencia", label: "Ocorrência" },
              { value: "suspensao", label: "Suspensão" },
            ]}
            placeholder="Selecionar tipo"
          />

          <FormInput
            type="date"
            label="Data da ocorrência"
            value={dataOcorrido}
            onChange={(event) => setDataOcorrido(event.target.value)}
          />

          {tipoAdvertencia === "suspensao" && (
            <>
              <FormInput
                type="date"
                label="Data de início"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
              <FormInput
                type="date"
                label="Data de término"
                value={dataTermino}
                onChange={(event) => setDataTermino(event.target.value)}
              />
            </>
          )}

          <CustomSelect
            label="Tipo de situação"
            value={tipoSituacao}
            onChange={(val) => setTipoSituacao(val)}
            options={[
              { value: "", label: "Selecionar situação" },
              { value: "indisciplina", label: "Indisciplina" },
              { value: "infrequencia", label: "Infrequência" },
              { value: "atraso", label: "Atraso" },
              { value: "desrespeito", label: "Desrespeito" },
              { value: "outro", label: "Outro" },
            ]}
            placeholder="Selecionar situação"
          />

          <div className="sm:col-span-2 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
              Descrição
            </label>
            <textarea
              placeholder="Descreva a ocorrência..."
              rows={5}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className="h-36 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
