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
import { addPdfFooter } from "../utils/pdfFooterPatch";
import logoImg from "../assets/images/logoEEEP.png";

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

const drawFittedPdfText = (doc, text, { x, y, maxWidth, fontSize, minFontSize = 8, align = "left" }) => {
  const value = String(text || "");
  let currentSize = fontSize;

  doc.setFontSize(currentSize);
  while (currentSize > minFontSize && doc.getTextWidth(value) > maxWidth) {
    currentSize -= 0.5;
    doc.setFontSize(currentSize);
  }

  doc.text(value, x, y, { align, maxWidth });
  return currentSize;
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
          aluno_id: aluno.id,
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

  const generatePdfReport = async (rows) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const today = new Date().toLocaleDateString("pt-BR");
    const reportTitle = "FICHA INDIVIDUAL DE OCORRÊNCIAS";
    const students = new Map();

    rows.forEach((row) => {
      if (!students.has(row.aluno_id)) {
        students.set(row.aluno_id, { ...row, ocorrencias: [] });
      }
      if (row.data_ocorrido !== "—" || row.descricao !== "Sem ocorrências") {
        students.get(row.aluno_id).ocorrencias.push(row);
      }
    });

    const studentList = Array.from(students.values());
    const drawHeader = (schoolName, continuation = false) => {
      doc.setFillColor(35, 146, 74);
      doc.rect(0, 0, pageWidth, 8, "F");
      try {
        doc.addImage(logoImg, "PNG", margin, 18, 48, 48);
      } catch (error) {
        console.warn("Logo da escola não pôde ser adicionada ao relatório:", error);
      }
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      drawFittedPdfText(doc, schoolName || "Instituição de ensino", {
        x: margin + 60, y: 32, maxWidth: 250, fontSize: 12, minFontSize: 8,
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("LogView • Gestão escolar", margin + 60, 48);
      doc.text(`Emitido em ${today}`, margin + 60, 62);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(22, 101, 52);
      doc.text(continuation ? "HISTÓRICO DE OCORRÊNCIAS (continuação)" : reportTitle, pageWidth - margin, 34, { align: "right" });
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.line(margin, 78, pageWidth - margin, 78);
    };

    studentList.forEach((student, studentIndex) => {
      if (studentIndex > 0) doc.addPage();
      const schoolName = student.escola || "Instituição de ensino";
      drawHeader(schoolName);

      let y = 100;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("IDENTIFICAÇÃO DO ALUNO", margin, y);
      y += 12;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 92, bottom: 58 },
        theme: "grid",
        head: [],
        body: [
          ["Aluno(a)", student.aluno_nome || "—", "Matrícula", student.matricula || "—"],
          ["Série/Turma", student.turma || "—", "Escola", student.escola || "—"],
          ["Situação atual", String(student.status || "normal").toUpperCase(), "Data do relatório", today],
        ],
        styles: { font: "helvetica", fontSize: 9, cellPadding: 7, lineColor: [148, 163, 184], lineWidth: 0.6, textColor: [30, 41, 59], overflow: "linebreak" },
        columnStyles: { 0: { cellWidth: 78, fontStyle: "bold", fillColor: [241, 245, 249] }, 1: { cellWidth: 175 }, 2: { cellWidth: 78, fontStyle: "bold", fillColor: [241, 245, 249] }, 3: { cellWidth: "auto" } },
      });

      y = doc.lastAutoTable.finalY + 22;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("HISTÓRICO DISCIPLINAR", margin, y);
      y += 8;

      const history = [...student.ocorrencias].sort((a, b) => {
        const dateA = new Date(a.data_ocorrido).getTime() || 0;
        const dateB = new Date(b.data_ocorrido).getTime() || 0;
        return dateA - dateB;
      });

      const historyRows = history.length
        ? history.map((item, index) => [
            String(index + 1),
            item.data_ocorrido && item.data_ocorrido !== "—" ? new Date(item.data_ocorrido).toLocaleDateString("pt-BR") : "—",
            [item.tipo, item.categoria].filter((value) => value && value !== "—").join(" • ") || "Ocorrência",
            item.descricao || "Sem descrição registrada",
          ])
        : [["—", "—", "Sem ocorrências registradas", "Não há ocorrências disponíveis para este aluno no período consultado."]];

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 92, bottom: 58 },
        head: [["Nº", "Data", "Classificação", "Descrição / registro"]],
        body: historyRows,
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, lineColor: [203, 213, 225], lineWidth: 0.5, textColor: [30, 41, 59], overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [35, 146, 74], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 58 }, 2: { cellWidth: 112, fontStyle: "bold" }, 3: { cellWidth: "auto" } },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawHeader(schoolName, true);
        },
      });

      const finalY = doc.lastAutoTable.finalY + 24;
      if (finalY < pageHeight - 80) {
        doc.setDrawColor(148, 163, 184);
        doc.line(margin, finalY, pageWidth - margin, finalY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Documento gerado pelo LogZélia a partir dos registros disponíveis no sistema.", margin, finalY + 14);
      }
    });

    await addPdfFooter(doc);
    doc.save(`fichas-individuais-alunos-${new Date().toISOString().split("T")[0]}.pdf`);
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
    const visibleIds = filteredAlunos.map((aluno) => aluno.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAlunoIds.includes(id));
    if (allVisibleSelected) {
      setSelectedAlunoIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedAlunoIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
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
        await generatePdfReport(reportRows);
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

      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Encontrar alunos</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">Use os filtros para localizar rapidamente os alunos que deseja consultar.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <CustomSelect label="Escola" value={selectedEscola} onChange={(value) => { setSelectedEscola(value); setSelectedTurma(""); setSelectedAlunoIds([]); }} options={escolaOptions} placeholder="Todas as escolas" />
            <CustomSelect label="Turma" value={selectedTurma} onChange={(value) => { setSelectedTurma(value); setSelectedAlunoIds([]); }} options={[{ value: "", label: "Todas as turmas" }, ...turmas.filter((turma) => !selectedEscola || String(turma.escola_id) === String(selectedEscola)).map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label))]} placeholder="Todas as turmas" />
          </div>
          <div className="mt-4"><FormInput label="Buscar por nome ou matrícula" placeholder="Digite o nome ou a matrícula do aluno" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
            <p className="text-sm text-slate-600 dark:text-slate-300">{loading ? "Carregando alunos..." : <><strong className="text-slate-900 dark:text-white">{filteredAlunos.length}</strong> aluno(s) encontrado(s)</>}</p>
            {(search || selectedEscola || selectedTurma) && <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSelectedEscola(""); setSelectedTurma(""); setSelectedAlunoIds([]); }}>Limpar filtros</Button>}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Transferir alunos entre turmas</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">Esta ação transfere todos os alunos da turma de origem para a turma de destino.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <CustomSelect label="Turma de origem" value={sourceTurma} onChange={setSourceTurma} options={[{ value: "", label: "Selecione a turma de origem" }, ...turmas.filter((turma) => !selectedEscola || String(turma.escola_id) === String(selectedEscola)).map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label))]} placeholder="Selecione a turma de origem" />
            <CustomSelect label="Turma de destino" value={targetTurma} onChange={setTargetTurma} options={[{ value: "", label: "Selecione a turma de destino" }, ...turmas.filter((turma) => !selectedEscola || String(turma.escola_id) === String(selectedEscola)).filter((turma) => String(turma.id) !== String(sourceTurma)).map((turma) => ({ value: String(turma.id), label: turma.nome })).sort((a, b) => a.label.localeCompare(b.label))]} placeholder="Selecione a turma de destino" />
          </div>
          {sourceTurma && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Serão transferidos <strong>{alunos.filter((aluno) => String(aluno.turma_id) === String(sourceTurma)).length}</strong> aluno(s) de <strong>{getTurmaName(sourceTurma)}</strong>.</p>}
          <div className="mt-4 flex flex-wrap gap-3"><Button onClick={handleBulkMove} disabled={bulkLoading || !sourceTurma || !targetTurma || sourceTurma === targetTurma}>{bulkLoading ? "Transferindo alunos..." : "Transferir todos os alunos"}</Button>{(sourceTurma || targetTurma) && <Button variant="outline" onClick={() => { setSourceTurma(""); setTargetTurma(""); }} disabled={bulkLoading}>Cancelar seleção</Button>}</div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Relatórios e remoção</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">Selecione alunos na tabela para gerar um relatório individualizado. Sem seleção, o relatório considera os resultados dos filtros.</p>
          <div className="grid gap-4 sm:grid-cols-2"><CustomSelect label="Formato do relatório" value={reportFormat} onChange={setReportFormat} options={reportFormatOptions} placeholder="Selecione o formato" /><div className="flex flex-col justify-end gap-2 sm:flex-row"><Button onClick={handleDownloadFinalReport} disabled={reportLoading || (selectedCount === 0 && filteredAlunos.length === 0)} className="w-full sm:w-auto">{reportLoading ? "Gerando relatório..." : "Gerar relatório"}</Button><Button variant="destructive" onClick={() => { setConfirmDeleteText(""); setDeleteModalOpen(true); }} disabled={!selectedTurma || alunos.filter((aluno) => String(aluno.turma_id) === String(selectedTurma)).length === 0} className="w-full sm:w-auto">Excluir turma selecionada</Button></div></div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A exclusão remove todos os alunos da turma selecionada e exige confirmação. Para excluir apenas uma pessoa, use “Excluir” na tabela.</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Importar alunos por planilha</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">Importe vários alunos de uma vez usando um arquivo CSV. Baixe o modelo e preencha os dados antes de enviar.</p>
          <div className="flex flex-wrap items-center gap-3"><Button onClick={handleDownloadTemplate} disabled={!selectedTurma}>Baixar modelo CSV</Button>{!selectedTurma && <span className="text-xs text-slate-500 dark:text-slate-400">Selecione uma turma nos filtros para preencher o modelo automaticamente.</span>}</div>
          <div className="mt-4"><FormInput label="Arquivo CSV" type="file" accept=".csv" onChange={handleUploadCsv} disabled={uploading} className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-green-700 file:px-4 file:py-2 file:font-semibold file:text-white" /></div>
          {uploading && <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">Validando e importando arquivo...</p>}{fileName && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Arquivo selecionado: {fileName}</p>}
          {fileErrors.length > 0 && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"><p className="font-semibold">Corrija os seguintes erros no CSV:</p><ul className="mt-1 list-disc pl-5">{fileErrors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
          {turmas.length > 0 && <details className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Ver IDs das turmas (opção avançada)</summary><div className="grid gap-2 border-t border-slate-200 p-3 dark:border-slate-700">{turmas.map((turma) => <div key={turma.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800"><span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">{turma.id} — {turma.nome}</span><Button size="sm" variant="outline" onClick={() => copyToClipboard(String(turma.id))}>Copiar ID</Button></div>)}</div></details>}
        </section>
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
                    checked={filteredAlunos.length > 0 && filteredAlunos.every((aluno) => selectedAlunoIds.includes(aluno.id))}
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
