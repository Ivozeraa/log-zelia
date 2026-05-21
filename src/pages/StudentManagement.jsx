import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { PageTitle } from "../components/ui/PageTitle";
import { FormInput } from "../components/ui/FormInput";
import { FormSelect } from "../components/ui/FormSelect";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const CSV_HEADERS = ["nome", "matricula", "turma_id", "escola_id"];

const normalizeCsvLine = (text) => text.replace(/\r/g, "");

const parseCsv = (csvText) => {
  const normalized = normalizeCsvLine(csvText).trim();
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { rows: [], errors: ["Arquivo CSV vazio."] };
  }

  const separator = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0]
    .split(separator)
    .map((value) => value.trim().toLowerCase());

  const missingHeader = CSV_HEADERS.find((header) => !headers.includes(header));
  if (missingHeader) {
    return {
      rows: [],
      errors: [
        `Cabeçalho inválido. O arquivo precisa conter: ${CSV_HEADERS.join(", ")}.`,
      ],
    };
  }

  const rows = [];
  const errors = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const values = line.split(separator).map((value) => value.trim());

    if (values.every((value) => value === "")) {
      continue;
    }

    const row = headers.reduce((acc, header, headerIndex) => {
      acc[header] = values[headerIndex] ?? "";
      return acc;
    }, {});

    const missingValue = CSV_HEADERS.find(
      (header) => !row[header] || row[header].toString().trim() === "",
    );

    if (missingValue) {
      errors.push(
        `Linha ${index + 1}: falta o valor de '${missingValue}'.`,
      );
      continue;
    }

    rows.push({
      nome: row.nome,
      matricula: row.matricula,
      turma_id: row.turma_id,
      escola_id: row.escola_id,
    });
  }

  return { rows, errors };
};

const downloadCsv = (content, filename) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.success("Texto copiado para a área de transferência.");
  } catch (err) {
    console.error("Erro ao copiar para clipboard", err);
    notify.error("Não foi possível copiar o texto.");
  }
};

export const StudentManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [fileErrors, setFileErrors] = useState([]);
  const [fileName, setFileName] = useState("");

  const [selectedEscola, setSelectedEscola] = useState("");
  const [selectedTurma, setSelectedTurma] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAlunoIds, setSelectedAlunoIds] = useState([]);
  const [sourceTurma, setSourceTurma] = useState("");
  const [targetTurma, setTargetTurma] = useState("");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [reportLoading, setReportLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editingAluno, setEditingAluno] = useState(null);
  const [deleteAlunoModalOpen, setDeleteAlunoModalOpen] = useState(false);
  const [alunoToDelete, setAlunoToDelete] = useState(null);
  const [deleteAlunoConfirmText, setDeleteAlunoConfirmText] = useState("");
  const [editEscolaOpen, setEditEscolaOpen] = useState(false);
  const [editTurmaOpen, setEditTurmaOpen] = useState(false);
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const modalRef = useRef(null);

  const canEditSchool = user?.role_id === 1;
  const currentSchoolId = selectedEscola || user?.escola_id || "";

  const getTurmaName = (id) => turmas.find((turma) => turma.id === id)?.nome || "—";
  const getEscolaName = (id) => escolas.find((escola) => escola.id === id)?.nome || "—";

  const prepareReportRows = (students, occurrences) => {
    const occurrenceMap = (occurrences || []).reduce((acc, item) => {
      acc[item.aluno_id] = acc[item.aluno_id] || [];
      acc[item.aluno_id].push(item);
      return acc;
    }, {});

    return students.flatMap((aluno) => {
      const alunoOccurrences = occurrenceMap[aluno.id] || [];
      return alunoOccurrences.length > 0
        ? alunoOccurrences.map((occ) => ({
            aluno_nome: aluno.nome,
            matricula: aluno.matricula,
            turma: getTurmaName(aluno.turma_id),
            escola: getEscolaName(aluno.escola_id),
            status: aluno.status || "normal",
            data_ocorrido: occ.data_ocorrido || "—",
            categoria: occ.categoria || "—",
            tipo: occ.tipo || "—",
            descricao: occ.descricao || "—",
          }))
        : [{
            aluno_nome: aluno.nome,
            matricula: aluno.matricula,
            turma: getTurmaName(aluno.turma_id),
            escola: getEscolaName(aluno.escola_id),
            status: aluno.status || "normal",
            data_ocorrido: "—",
            categoria: "—",
            tipo: "—",
            descricao: "Sem ocorrências",
          }];
    });
  };

  const generateCsvReport = (rows) => {
    const header = [
      "aluno_nome",
      "matricula",
      "turma",
      "escola",
      "status",
      "data_ocorrido",
      "categoria",
      "tipo",
      "descricao",
    ];

    const csv = [header.join("\t")]
      .concat(
        rows.map((row) => [
          row.aluno_nome,
          row.matricula,
          row.turma,
          row.escola,
          row.status,
          row.data_ocorrido,
          row.categoria,
          row.tipo,
          row.descricao,
        ].join("\t")),
      )
      .join("\n");

    downloadCsv(csv, `relatorio-ocorrencias-alunos-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const generatePdfReport = (rows) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const title = `Relatório de ocorrências dos alunos - ${new Date().toLocaleDateString("pt-BR")}`;
    doc.setFontSize(16);
    doc.text(title, 40, 40);

    const tableData = rows.map((row) => [
      row.aluno_nome,
      row.matricula,
      row.turma,
      row.escola,
      row.status,
      row.data_ocorrido,
      row.categoria,
      row.tipo,
      row.descricao,
    ]);

    autoTable(doc, {
      head: [[
        "Aluno",
        "Matrícula",
        "Turma",
        "Escola",
        "Status",
        "Data",
        "Categoria",
        "Tipo",
        "Descrição",
      ]],
      body: tableData,
      startY: 60,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 118, 110] },
      columnStyles: {
        8: { cellWidth: 140 },
      },
      bodyStyles: { valign: "top" },
    });

    doc.save(`relatorio-ocorrencias-alunos-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const openEditAluno = (aluno) => {
    setEditingAluno(aluno);
    setEditForm({
      nome: aluno.nome || "",
      matricula: aluno.matricula || "",
      turma_id: aluno.turma_id || "",
      escola_id: aluno.escola_id || "",
      status: aluno.status || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveAluno = async () => {
    if (!editingAluno || !editForm) return;

    const { nome, matricula, turma_id, escola_id, status } = editForm;
    if (!nome || !matricula || !turma_id || !escola_id) {
      notify.error("Preencha nome, matrícula, turma e escola.");
      return;
    }

    try {
      const { error } = await supabase
        .from("alunos")
        .update({ nome, matricula, turma_id, escola_id, status })
        .eq("id", editingAluno.id);

      if (error) {
        console.error(error);
        notify.error("Erro ao salvar dados do aluno.");
        return;
      }

      setAlunos((prev) =>
        prev.map((aluno) =>
          aluno.id === editingAluno.id ? { ...aluno, nome, matricula, turma_id, escola_id, status } : aluno,
        ),
      );
      setEditModalOpen(false);
      setEditingAluno(null);
      notify.success("Aluno atualizado com sucesso.");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao atualizar o aluno.");
    }
  };

  const openDeleteAluno = (aluno) => {
    setAlunoToDelete(aluno);
    setDeleteAlunoConfirmText("");
    setDeleteAlunoModalOpen(true);
  };

  const handleDeleteAluno = async () => {
    if (!alunoToDelete) return;
    if (deleteAlunoConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      notify.error("Digite EXCLUIR para confirmar a exclusão.");
      return;
    }

    try {
      const { error } = await supabase
        .from("alunos")
        .delete()
        .eq("id", alunoToDelete.id);

      if (error) {
        console.error(error);
        notify.error("Erro ao excluir o aluno.");
        return;
      }

      setAlunos((prev) => prev.filter((aluno) => aluno.id !== alunoToDelete.id));
      setSelectedAlunoIds((prev) => prev.filter((id) => id !== alunoToDelete.id));
      setDeleteAlunoModalOpen(false);
      setAlunoToDelete(null);
      notify.success("Aluno excluído com sucesso.");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao excluir o aluno.");
    }
  };

  const filteredAlunos = useMemo(() => {
    return alunos.filter((aluno) => {
      const searchValue = search.trim().toLowerCase();
      const matchesSearch = !searchValue ||
        aluno.nome?.toLowerCase().includes(searchValue) ||
        aluno.matricula?.toLowerCase().includes(searchValue);
      const matchesEscola = !selectedEscola || aluno.escola_id === selectedEscola;
      const matchesTurma = !selectedTurma || aluno.turma_id === selectedTurma;
      return matchesSearch && matchesEscola && matchesTurma;
    });
  }, [alunos, search, selectedEscola, selectedTurma]);

  const selectedCount = selectedAlunoIds.length;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const escolasQuery = supabase.from("escolas").select("id, nome").order("nome", { ascending: true });
        const turmasQuery = supabase.from("turmas").select("id, nome, escola_id").order("nome", { ascending: true });
        const alunosQuery = supabase
          .from("alunos")
          .select("id, nome, matricula, turma_id, escola_id, status")
          .order("nome", { ascending: true });

        if (user?.role_id !== 1 && user?.escola_id) {
          alunosQuery.eq("escola_id", user.escola_id);
          turmasQuery.eq("escola_id", user.escola_id);
          escolasQuery.eq("id", user.escola_id);
        }

        const [escolasResult, turmasResult, alunosResult] = await Promise.all([
          escolasQuery,
          turmasQuery,
          alunosQuery,
        ]);

        setEscolas(escolasResult.data || []);
        setTurmas(turmasResult.data || []);
        setAlunos(alunosResult.data || []);
      } catch (err) {
        console.error(err);
        notify.error("Erro ao carregar dados de alunos.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setEditEscolaOpen(false);
        setEditTurmaOpen(false);
        setEditStatusOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleAluno = (alunoId) => {
    setSelectedAlunoIds((prev) =>
      prev.includes(alunoId)
        ? prev.filter((id) => id !== alunoId)
        : [...prev, alunoId],
    );
  };

  const handleToggleAll = () => {
    if (selectedAlunoIds.length === filteredAlunos.length) {
      setSelectedAlunoIds([]);
      return;
    }
    setSelectedAlunoIds(filteredAlunos.map((aluno) => aluno.id));
  };

  const handleDownloadTemplate = () => {
    const templateSchoolId = currentSchoolId || "UUID_ESCOLA";
    const templateTurmaId = selectedTurma || "UUID_TURMA";
    const csv = `${CSV_HEADERS.join("\t")}\nNome do aluno\t123456\t${templateTurmaId}\t${templateSchoolId}\n`;
    downloadCsv(csv, "alunos-template.csv");
  };

  const handleUploadCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileErrors([]);
    setUploading(true);

    try {
      const text = await file.text();
      const { rows, errors } = parseCsv(text);

      if (errors.length > 0) {
        setFileErrors(errors);
        notify.error("O CSV contém erros. Verifique o arquivo e tente novamente.");
        return;
      }

      if (rows.length === 0) {
        notify.error("O CSV não contém registros válidos.");
        return;
      }

      const { error } = await supabase.from("alunos").insert(rows);
      if (error) {
        console.error(error);
        notify.error("Não foi possível inserir os alunos do CSV.");
        return;
      }

      notify.success(`${rows.length} aluno(s) importado(s) com sucesso.`);
      setSearch("");
      setSelectedEscola("");
      setSelectedTurma("");
      setSelectedAlunoIds([]);
      setFileName("");

      const refreshedQuery = supabase
        .from("alunos")
        .select("id, nome, matricula, turma_id, escola_id")
        .order("nome", { ascending: true });

      if (user?.role_id !== 1 && user?.escola_id) {
        refreshedQuery.eq("escola_id", user.escola_id);
      }

      const { data: refreshedAlunos } = await refreshedQuery;
      setAlunos(refreshedAlunos || []);
    } catch (err) {
      console.error(err);
      notify.error("Erro ao processar o arquivo CSV.");
    } finally {
      setUploading(false);
    }
  };

  const handleBulkMove = async () => {
    if (!sourceTurma || !targetTurma) {
      notify.error("Selecione a turma de origem e de destino.");
      return;
    }

    if (sourceTurma === targetTurma) {
      notify.error("A turma de destino deve ser diferente da turma de origem.");
      return;
    }

    setBulkLoading(true);
    try {
      const query = supabase.from("alunos").update({ turma_id: targetTurma }).eq("turma_id", sourceTurma);
      if (user?.role_id !== 1 && user?.escola_id) {
        query.eq("escola_id", user.escola_id);
      }

      const { error } = await query;
      if (error) {
        console.error(error);
        notify.error("Não foi possível mover os alunos.");
        return;
      }

      setAlunos((prev) =>
        prev.map((aluno) =>
          aluno.turma_id === sourceTurma ? { ...aluno, turma_id: targetTurma } : aluno,
        ),
      );
      notify.success("Alunos movidos com sucesso.");
      setSourceTurma("");
      setTargetTurma("");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao atualizar turmas.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDownloadFinalReport = async () => {
    const rows = selectedCount > 0 ? alunos.filter((aluno) => selectedAlunoIds.includes(aluno.id)) : filteredAlunos;
    if (rows.length === 0) {
      notify.error("Nenhum aluno selecionado para o relatório.");
      return;
    }

    setReportLoading(true);
    try {
      const alunoIds = rows.map((aluno) => aluno.id);
      const { data: occurrences, error } = await supabase
        .from("ocorrencias")
        .select("id, aluno_id, categoria, tipo, descricao, data_ocorrido")
        .in("aluno_id", alunoIds);

      if (error) {
        console.error(error);
        notify.error("Erro ao buscar ocorrências para o relatório.");
        return;
      }

      const reportRows = prepareReportRows(rows, occurrences || []);

      if (reportFormat === "pdf") {
        generatePdfReport(reportRows);
      } else {
        generateCsvReport(reportRows);
      }

      notify.success("Relatório gerado com sucesso.");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao gerar o relatório.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDeleteCompleted = async () => {
    if (!selectedTurma) {
      notify.error("Selecione uma turma para excluir os alunos.");
      return;
    }

    if (confirmDeleteText.trim().toUpperCase() !== "EXCLUIR") {
      notify.error("Digite EXCLUIR para confirmar a exclusão.");
      return;
    }

    setBulkLoading(true);
    try {
      const query = supabase.from("alunos").delete().eq("turma_id", selectedTurma);
      if (user?.role_id !== 1 && user?.escola_id) {
        query.eq("escola_id", user.escola_id);
      }
      const { error } = await query;
      if (error) {
        console.error(error);
        notify.error("Não foi possível excluir os alunos.");
        return;
      }

      setAlunos((prev) => prev.filter((aluno) => aluno.turma_id !== selectedTurma));
      setSelectedAlunoIds((prev) => prev.filter((id) => !alunos.find((aluno) => aluno.id === id && aluno.turma_id === selectedTurma)));
      setDeleteModalOpen(false);
      setConfirmDeleteText("");
      notify.success("Alunos excluídos com sucesso.");
    } catch (err) {
      console.error(err);
      notify.error("Erro ao excluir alunos.");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle
          title="Gestão de Alunos"
          subtitle="Filtre, mova turmas e importe os alunos por planilha CSV." 
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            Voltar
          </Button>
          <Button
            onClick={handleDownloadTemplate}
            className="whitespace-nowrap"
            disabled={!selectedTurma}
          >
            {selectedTurma ? "Baixar template CSV" : "Selecione a turma para baixar"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect
              label="Filtrar escola"
              value={selectedEscola}
              onChange={(event) => setSelectedEscola(event.target.value)}
            >
              <option value="">Todas as escolas</option>
              {escolas.map((escola) => (
                <option key={escola.id} value={escola.id}>
                  {escola.nome}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Filtrar turma"
              value={selectedTurma}
              onChange={(event) => setSelectedTurma(event.target.value)}
              className="mb-2 col"
            >
              <option value="">Todas as turmas</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </FormSelect>
          </div>

          <FormInput
            label="Buscar aluno"
            placeholder="Nome ou matrícula"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className=""
          />

          <div className="grid gap-3 sm:grid-cols-2 mt-2">
            <FormSelect
              label="Turma de origem"
              value={sourceTurma}
              onChange={(event) => setSourceTurma(event.target.value)}
            >
              <option value="">Selecione a turma de origem</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="Turma de destino"
              value={targetTurma}
              onChange={(event) => setTargetTurma(event.target.value)}
            >
              <option value="">Selecione a turma de destino</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </FormSelect>
          </div>

          <Button onClick={handleBulkMove} disabled={bulkLoading} className="mt-4">
            {bulkLoading ? "Movendo alunos..." : "Mover todos da turma"}
          </Button>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 mt-4">
            <p className="text-sm font-semibold text-slate-700">Relatório ou exclusão</p>
            <p className="text-sm text-slate-500">
              Selecione alunos ou use o filtro para gerar relatório e excluir alunos da turma selecionada.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <FormSelect
                label="Formato do relatório"
                value={reportFormat}
                onChange={(event) => setReportFormat(event.target.value)}
              >
                <option value="pdf">PDF</option>
                <option value="csv">Planilha (.csv)</option>
              </FormSelect>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleDownloadFinalReport}
                  variant="outline"
                  disabled={reportLoading}
                >
                  {reportLoading ? "Gerando relatório..." : "Gerar relatório"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteModalOpen(true)}
                >
                  Excluir alunos da turma
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 mt-4">
            <p className="text-sm font-semibold text-slate-700">Importar CSV</p>
            <p className="text-sm text-slate-500">
              Use o template para carregar alunos com nome, matrícula, turma_id e escola_id.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleUploadCsv}
              className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-green-700 file:px-4 file:py-2 file:text-white file:font-semibold"
            />
            {fileName && (
              <p className="mt-2 text-sm text-slate-500">Arquivo: {fileName}</p>
            )}
            {fileErrors.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Erros no CSV:</p>
                <ul className="list-disc pl-5">
                  {fileErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Alunos encontrados</p>
              <p className="text-2xl font-bold text-slate-900">{filteredAlunos.length}</p>
            </div>
            <div className="text-sm text-slate-600">
              {selectedCount > 0
                ? `${selectedCount} aluno(s) selecionado(s)`
                : "Selecione alunos para ações rápidas"}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filteredAlunos.length > 0 && selectedAlunoIds.length === filteredAlunos.length}
                      onChange={handleToggleAll}
                    />
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">Aluno</th>
                  <th className="border-b border-slate-200 px-4 py-3">Matrícula</th>
                  <th className="border-b border-slate-200 px-4 py-3">Turma</th>
                  <th className="border-b border-slate-200 px-4 py-3">Escola</th>
                  <th className="border-b border-slate-200 px-4 py-3">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Carregando alunos...
                    </td>
                  </tr>
                ) : filteredAlunos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAlunos.map((aluno) => (
                    <tr key={aluno.id} className="border-b border-slate-200 last:border-none hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedAlunoIds.includes(aluno.id)}
                          onChange={() => handleToggleAluno(aluno.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{aluno.nome}</td>
                      <td className="px-4 py-3 text-slate-600">{aluno.matricula || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{getTurmaName(aluno.turma_id)}</td>
                      <td className="px-4 py-3 text-slate-600">{getEscolaName(aluno.escola_id)}</td>
                      <td className="px-4 py-3 text-slate-600">{aluno.status || "normal"}</td>
                      <td className="px-4 py-3 flex flex-wrap gap-2">
                        <Button size="xs" variant="outline" onClick={() => openEditAluno(aluno)}>
                          Editar
                        </Button>
                        <Button size="xs" variant="destructive" onClick={() => openDeleteAluno(aluno)}>
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

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConfirmDeleteText("");
        }}
        title="Excluir alunos da turma"
      >
        <div className="space-y-4">
          <p>
            Esta ação excluirá todos os alunos da turma selecionada. Selecione a turma e digite <span className="font-semibold">EXCLUIR</span> para confirmar.
          </p>
          <FormSelect
            label="Turma para exclusão"
            value={selectedTurma}
            onChange={(event) => setSelectedTurma(event.target.value)}
          >
            <option value="">Selecione a turma</option>
            {turmas.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label="Digite EXCLUIR para confirmar"
            value={confirmDeleteText}
            onChange={(event) => setConfirmDeleteText(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteCompleted} disabled={bulkLoading}>
              {bulkLoading ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingAluno(null);
        }}
        title={`Editar aluno${editingAluno ? `: ${editingAluno.nome}` : ""}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveAluno(); }} className="grid gap-4" ref={modalRef}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Nome</label>
              <input
                type="text"
                value={editForm?.nome || ""}
                onChange={(event) => setEditForm((prev) => ({ ...prev, nome: event.target.value }))}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Matrícula</label>
              <input
                type="text"
                value={editForm?.matricula || ""}
                onChange={(event) => setEditForm((prev) => ({ ...prev, matricula: event.target.value }))}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Escola</label>
              <button
                type="button"
                onClick={() => {
                  setEditEscolaOpen((prev) => !prev);
                  setEditTurmaOpen(false);
                  setEditStatusOpen(false);
                }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>{escolas.find(e => e.id === editForm?.escola_id)?.nome || 'Selecione a escola'}</span>
                <span className="text-slate-500">▾</span>
              </button>

              {editEscolaOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {escolas.map((escola) => (
                    <button
                      key={escola.id}
                      type="button"
                      onClick={() => {
                        setEditForm((prev) => ({ ...prev, escola_id: escola.id }));
                        setEditEscolaOpen(false);
                      }}
                      className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                    >
                      {escola.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Turma</label>
              <button
                type="button"
                onClick={() => {
                  setEditTurmaOpen((prev) => !prev);
                  setEditEscolaOpen(false);
                  setEditStatusOpen(false);
                }}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <span>{turmas.find(t => t.id === editForm?.turma_id)?.nome || 'Selecione a turma'}</span>
                <span className="text-slate-500">▾</span>
              </button>

              {editTurmaOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {turmas.map((turma) => (
                    <button
                      key={turma.id}
                      type="button"
                      onClick={() => {
                        setEditForm((prev) => ({ ...prev, turma_id: turma.id }));
                        setEditTurmaOpen(false);
                      }}
                      className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                    >
                      {turma.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="relative flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <button
              type="button"
              onClick={() => {
                setEditStatusOpen((prev) => !prev);
                setEditEscolaOpen(false);
                setEditTurmaOpen(false);
              }}
              className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <span>
                {editForm?.status === 'normal' ? 'Normal' :
                  editForm?.status === 'suspenso' ? 'Suspenso' :
                    editForm?.status === 'expulso' ? 'Expulso' :
                      'Selecione o status'}
              </span>
              <span className="text-slate-500">▾</span>
            </button>

            {editStatusOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditForm((prev) => ({ ...prev, status: 'normal' }));
                    setEditStatusOpen(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm((prev) => ({ ...prev, status: 'suspenso' }));
                    setEditStatusOpen(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                >
                  Suspenso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm((prev) => ({ ...prev, status: 'expulso' }));
                    setEditStatusOpen(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                >
                  Expulso
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteAlunoModalOpen}
        onClose={() => {
          setDeleteAlunoModalOpen(false);
          setAlunoToDelete(null);
          setDeleteAlunoConfirmText("");
        }}
        title={`Excluir aluno${alunoToDelete ? `: ${alunoToDelete.nome}` : ""}`}
      >
        <div className="space-y-4">
          <p>
            Esta ação excluirá o aluno selecionado. Digite <span className="font-semibold">EXCLUIR</span> para confirmar.
          </p>
          <FormInput
            label="Digite EXCLUIR para confirmar"
            value={deleteAlunoConfirmText}
            onChange={(event) => setDeleteAlunoConfirmText(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteAlunoModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAluno}>
              Excluir aluno
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
