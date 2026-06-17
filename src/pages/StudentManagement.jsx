import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../utils/notify";
import { PageTitle } from "../components/ui/PageTitle";
import { FormInput } from "../components/ui/FormInput";
import { CustomSelect } from "../components/ui/CustomSelect";
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

  const escolaOptions = [
    { value: "", label: "Todas as escolas" },
    ...escolas.map((escola) => ({ value: String(escola.id), label: escola.nome })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const turmaOptions = [
    { value: "", label: "Todas as turmas" },
    ...turmas.map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const origemTurmaOptions = [
    { value: "", label: "Selecione a turma de origem" },
    ...turmas.map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const destinoTurmaOptions = [
    { value: "", label: "Selecione a turma de destino" },
    ...turmas.map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const deleteTurmaOptions = [
    { value: "", label: "Selecione a turma" },
    ...turmas.map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const reportFormatOptions = [
    { value: "pdf", label: "PDF" },
    { value: "csv", label: "Planilha (.csv)" },
  ];

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
      let query = supabase.from("alunos").update({ turma_id: targetTurma }).eq("turma_id", sourceTurma);
      if (user?.role_id !== 1 && user?.escola_id) {
        query = query.eq("escola_id", user.escola_id);
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
      let query = supabase.from("alunos").delete().eq("turma_id", selectedTurma);
      if (user?.role_id !== 1 && user?.escola_id) {
        query = query.eq("escola_id", user.escola_id);
      }
      const { error } = await query;
      if (error) {
        console.error(error);
        notify.error("Não foi possível excluir os alunos.");
        return;
      }

      setAlunos((prev) => prev.filter((aluno) => aluno.turma_id !== selectedTurma));
      setSelectedAlunoIds((prev) => {
        const alunosToDelete = alunos.filter((a) => a.turma_id === selectedTurma).map((a) => a.id);
        return prev.filter((id) => !alunosToDelete.includes(id));
      });
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
        {/* Edit Aluno Modal */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingAluno(null);
            setEditForm(null);
          }}
          title="Editar aluno"
        >
          {editForm && (
            <div ref={modalRef} className="space-y-4">
              <FormInput
                label="Nome"
                value={editForm.nome}
                onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))}
              />

              <FormInput
                label="Matrícula"
                value={editForm.matricula}
                onChange={(e) => setEditForm((p) => ({ ...p, matricula: e.target.value }))}
              />

              <CustomSelect
                label="Escola"
                value={String(editForm.escola_id || "")}
                onChange={(val) => setEditForm((p) => ({ ...p, escola_id: val }))}
                options={escolaOptions}
                placeholder="Selecione a escola"
              />

              <CustomSelect
                label="Turma"
                value={String(editForm.turma_id || "")}
                onChange={(val) => setEditForm((p) => ({ ...p, turma_id: val }))}
                options={turmaOptions}
                placeholder="Selecione a turma"
              />

              <CustomSelect
                label="Status"
                value={editForm.status || ""}
                onChange={(val) => setEditForm((p) => ({ ...p, status: val }))}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "suspenso", label: "Suspenso" },
                  { value: "expulso", label: "Expulso" },
                ]}
                placeholder="Selecione o status"
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditModalOpen(false); setEditingAluno(null); setEditForm(null); }}>
                  Cancelar
                </Button>

                <Button onClick={handleSaveAluno}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Aluno Modal */}
        <Modal
          isOpen={deleteAlunoModalOpen}
          onClose={() => { setDeleteAlunoModalOpen(false); setAlunoToDelete(null); setDeleteAlunoConfirmText(""); }}
          title="Excluir aluno"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Tem certeza que deseja excluir o aluno <strong>{alunoToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </p>

            <div>
              <p className="text-sm text-slate-500">Digite <strong>EXCLUIR</strong> para confirmar.</p>
              <FormInput
                value={deleteAlunoConfirmText}
                onChange={(e) => setDeleteAlunoConfirmText(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteAlunoModalOpen(false); setAlunoToDelete(null); setDeleteAlunoConfirmText(""); }}>
                Cancelar
              </Button>

              <Button variant="destructive" onClick={handleDeleteAluno} disabled={deleteAlunoConfirmText.trim().toUpperCase() !== "EXCLUIR"}>
                Excluir
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Batch Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => { setDeleteModalOpen(false); setConfirmDeleteText(""); }}
          title="Excluir alunos da turma"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Tem certeza que deseja excluir <strong>todos os alunos da turma {turmas.find((t) => t.id === selectedTurma)?.nome}</strong>? Esta ação não pode ser desfeita.
            </p>

            <div>
              <p className="text-sm text-slate-500">Digite <strong>EXCLUIR</strong> para confirmar.</p>
              <FormInput
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setConfirmDeleteText(""); }}>
                Cancelar
              </Button>

              <Button variant="destructive" onClick={handleDeleteCompleted} disabled={confirmDeleteText.trim().toUpperCase() !== "EXCLUIR" || bulkLoading}>
                {bulkLoading ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </Modal>

      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <CustomSelect
              label="Filtrar escola"
              value={selectedEscola}
              onChange={setSelectedEscola}
              options={escolaOptions}
              placeholder="Todas as escolas"
            />

            <CustomSelect
              label="Filtrar turma"
              value={selectedTurma}
              onChange={setSelectedTurma}
              options={turmaOptions}
              placeholder="Todas as turmas"
              className="mb-2 col"
            />
          </div>

          <FormInput
            label="Buscar aluno"
            placeholder="Nome ou matrícula"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <CustomSelect
              label="Turma de origem"
              value={sourceTurma}
              onChange={setSourceTurma}
              options={origemTurmaOptions}
              placeholder="Selecione a turma de origem"
            />

            <CustomSelect
              label="Turma de destino"
              value={targetTurma}
              onChange={setTargetTurma}
              options={destinoTurmaOptions}
              placeholder="Selecione a turma de destino"
            />
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
              Selecione alunos ou use o filtro
              para gerar relatório e excluir
              alunos da turma selecionada.
            </p>

            <div className="grid items-end gap-3 sm:grid-cols-2">
              <CustomSelect
                label="Formato do relatório"
                value={reportFormat}
                onChange={setReportFormat}
                options={reportFormatOptions}
                placeholder="Selecione o formato"
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={
                    handleDownloadFinalReport
                  }
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
              Use o template para carregar
              alunos com nome, matrícula,
              turma_id e escola_id.
            </p>

            <FormInput
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
                  {fileErrors.map(
                    (error, index) => (
                      <li key={index}>
                        {error}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {turmas.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold">IDs das turmas</p>
                <p className="text-sm text-slate-500">Lista de IDs das turmas no formato <span className="font-mono">id — nome</span></p>

                <div className="mt-2 grid gap-2">
                  {turmas.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-mono text-slate-700">{t.id} — {t.nome}</div>
                      <Button size="sm" onClick={() => copyToClipboard(String(t.id))}>
                        Copiar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

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
                  <FormInput
                    type="checkbox"
                    checked={
                      filteredAlunos.length >
                      0 &&
                      selectedAlunoIds.length ===
                      filteredAlunos.length
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
              ) : filteredAlunos.length ===
                0 ? (
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
                      <FormInput
                        type="checkbox"
                        checked={selectedAlunoIds.includes(
                          aluno.id
                        )}
                        onChange={() =>
                          handleToggleAluno(
                            aluno.id
                          )
                        }
                      />
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {aluno.nome}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {aluno.matricula ||
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {getTurmaName(
                        aluno.turma_id
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {getEscolaName(
                        aluno.escola_id
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {aluno.status ||
                        "normal"}
                    </td>

                    <td className="flex flex-wrap gap-2 px-4 py-3">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          openEditAluno(
                            aluno
                          )
                        }
                      >
                        Editar
                      </Button>

                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() =>
                          openDeleteAluno(
                            aluno
                          )
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
  );
};
