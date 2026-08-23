import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaBell, FaCalendarAlt, FaCheckCircle, FaClipboardList, FaFileAlt, FaGraduationCap, FaPaperPlane, FaStar, FaUsers } from "react-icons/fa";
import logo from "../assets/images/logo.png";
import { supabase } from "../utils/supabase";

const features = [
  [FaUsers, "Gestão de alunos", "Cadastre alunos, organize por turma e escola, filtre registros e mantenha os cadastros em ordem."],
  [FaClipboardList, "Ocorrências escolares", "Registre ocorrências com motivo, categoria, data e professor responsável e acompanhe o histórico."],
  [FaCalendarAlt, "Montagem de horários", "Organize horários considerando professores, disciplinas, turmas, cargas horárias e regras da escola."],
  [FaGraduationCap, "Professores e turmas", "Vincule professores às turmas e disciplinas e mantenha a estrutura da escola centralizada."],
  [FaFileAlt, "Relatórios", "Gere relatórios e exporte informações para PDF e planilha quando precisar."],
  [FaBell, "Notificações", "Acompanhe avisos e atualizações importantes sem precisar procurar em vários lugares."],
];

const workflow = [
  ["01", "Cadastre e organize", "Mantenha alunos, professores, turmas e disciplinas atualizados."],
  ["02", "Cuide da rotina", "Monte horários, registre ocorrências e acompanhe o dia a dia da escola."],
  ["03", "Consulte e acompanhe", "Use filtros, relatórios e o portal do aluno para encontrar as informações quando precisar."],
];

const demoStats = [["Alunos", "642"], ["Ocorrências", "27"], ["Turmas", "18"]];
const chartHeights = [24, 42, 30, 62, 46, 78, 54, 68, 40, 58, 74, 48];

const initialFeedback = { nome: "", email: "", cargo: "", avaliacao: 0, titulo: "", comentario: "", recomendaria: null, autoriza_publicacao: false };

/* ---------- Motion primitives ----------
   Corporate archetype (default, dashboard/UI): 200-400ms, cubic-bezier(0.2,0,0,1), 0-3% overshoot.
   Playful touch reserved for the feedback success state only, matching the state-feedback pattern. */

const MotionStyles = () => (
  <style>{`
    @keyframes lv-fade-up { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lv-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lv-scale-in { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes lv-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    @keyframes lv-pop { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.08); } 100% { transform: scale(1); } }

    .lv-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.5s cubic-bezier(0.2,0,0,1), transform 0.5s cubic-bezier(0.2,0,0,1); }
    .lv-reveal.lv-in { opacity: 1; transform: translateY(0); }

    @media (prefers-reduced-motion: reduce) {
      .lv-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
    }
  `}</style>
);

/** Scroll-triggered reveal wrapper. Fires once, `delay` staggers siblings. */
const Reveal = ({ children, className = "", delay = 0, as: Tag = "div", ...rest }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`lv-reveal ${visible ? "lv-in" : ""} ${className}`} style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }} {...rest}>
      {children}
    </Tag>
  );
};

/** Mount-triggered entrance (used above the fold, where scroll observation doesn't apply). */
const heroAnim = (delayMs, durationMs = 600, curve = "cubic-bezier(0.2,0,0,1)", name = "lv-fade-up") => ({
  animation: `${name} ${durationMs}ms ${curve} ${delayMs}ms both`,
});

export const Landing = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [form, setForm] = useState(initialFeedback);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc("listar_feedbacks_publicos").then(({ data }) => setFeedbacks(data || []));
  }, []);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || !form.avaliacao) return;
    setSending(true);
    const { error } = await supabase.from("feedbacks").insert({
      nome: form.nome.trim(), email: form.email.trim(), cargo: form.cargo.trim() || null,
      avaliacao: form.avaliacao, titulo: form.titulo.trim() || null, comentario: form.comentario.trim() || null,
      recomendaria: form.recomendaria, autoriza_publicacao: form.autoriza_publicacao, usuario_id: null, escola_id: null,
    });
    setSending(false);
    if (!error) { setSent(true); setForm(initialFeedback); }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <MotionStyles />

      <header style={heroAnim(0, 500, "ease-out", "lv-fade-in")} className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex min-w-0 items-center gap-2.5"><img src={logo} alt="LogView" width="40" height="40" className="h-9 w-9 rounded-xl object-contain sm:h-10 sm:w-10" /><span className="truncate font-montserrat text-base font-extrabold sm:text-lg">LOG <span className="text-orange-500">VIEW</span></span></a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300"><a href="#recursos" className="transition-colors duration-200 hover:text-green-700">Funcionalidades</a><a href="#como-funciona" className="transition-colors duration-200 hover:text-green-700">Como funciona</a><a href="#feedback" className="transition-colors duration-200 hover:text-green-700">Avaliações</a><a href="#portal" className="transition-colors duration-200 hover:text-green-700">Portal do aluno</a></nav>
          <div className="flex items-center gap-2"><Link to="/consultar-ocorrencias" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-100 sm:inline-flex dark:text-slate-300 dark:hover:bg-slate-900">Consultar ocorrência</Link><Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-md active:scale-[0.97] active:duration-100">Entrar <FaArrowRight className="text-xs" /></Link></div>
        </div>
      </header>

      <section id="inicio" className="relative isolate overflow-hidden"><div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(22,163,74,0.13),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(249,115,22,0.10),transparent_30%)]" /><div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div style={heroAnim(0, 550)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300"><FaGraduationCap /> Sistema de gestão escolar</div>
          <h1 style={heroAnim(90, 650)} className="max-w-3xl pb-3 text-4xl font-black leading-[1.16] tracking-tight sm:text-5xl lg:text-6xl">A escola organizada começa com <span className="inline-block bg-gradient-to-r from-green-700 via-green-600 to-emerald-500 bg-clip-text pb-1 text-transparent">LogView.</span></h1>
          <p style={heroAnim(190, 600)} className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">O LogView reúne a rotina da escola em um só sistema: alunos, professores, turmas, ocorrências, horários, relatórios e comunicação.</p>
          <div style={heroAnim(290, 550)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-xl active:scale-[0.97] active:duration-100">Acessar o sistema <FaArrowRight className="text-xs" /></Link>
            <Link to="/consultar-ocorrencias" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-green-300 hover:text-green-700 active:scale-[0.97] active:duration-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Consultar ocorrência</Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3 dark:text-slate-300">{["Gestão de alunos", "Horários e turmas", "Ocorrências e relatórios"].map((item, i) => <div key={item} style={heroAnim(380 + i * 40, 450)} className="flex items-center gap-2"><FaCheckCircle className="shrink-0 text-green-600" /><span>{item}</span></div>)}</div>
        </div>
        <div style={heroAnim(240, 700, "cubic-bezier(0.2,0,0,1)", "lv-scale-in")} className="relative mx-auto w-full max-w-xl lg:max-w-none"><div className="absolute -inset-6 rounded-[2rem] bg-green-500/10 blur-3xl" /><div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900"><div className="rounded-[1.5rem] bg-slate-950 p-4 text-white sm:p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visão geral</p><h2 className="mt-1 text-lg font-bold sm:text-xl">Painel escolar</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/15 text-green-400"><FaGraduationCap /></div></div><div className="grid grid-cols-3 gap-2.5">{demoStats.map(([label, value], i) => <div key={label} style={heroAnim(650 + i * 60, 400)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div><div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-300">Fluxo de ocorrências</span><span className="rounded-full bg-green-500/15 px-2 py-1 font-semibold text-green-300">Últimos 7 dias</span></div><div className="mt-5 flex h-32 items-end gap-2">{chartHeights.map((height, index) => <div key={index} className="flex-1 origin-bottom rounded-t-lg bg-gradient-to-t from-green-700 to-emerald-300/80" style={{ height: `${height}%`, animation: `lv-grow-y 500ms cubic-bezier(0.2,0,0,1) ${820 + index * 35}ms both` }} />)}</div></div></div></div></div>
      </div></section>

      <section id="recursos" className="border-t border-slate-100 bg-slate-50/70 py-20 dark:border-slate-900 dark:bg-slate-900/40 sm:py-24"><div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Funcionalidades</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tudo o que a escola usa no dia a dia.</h2><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">O sistema foi pensado para as tarefas que realmente ocupam o tempo da equipe: organizar cadastros, montar horários, registrar ocorrências, acompanhar professores e gerar informações para a gestão.</p></Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([Icon, title, description], i) => <Reveal as="article" key={title} delay={(i % 3) * 70} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700 transition-transform duration-300 ease-out group-hover:scale-110 dark:bg-green-950/40 dark:text-green-300"><Icon /></div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p></Reveal>)}</div>
      </div></section>

      <section id="como-funciona" className="py-20 sm:py-24"><div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
        <Reveal><p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Na prática</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A rotina da escola em um fluxo só.</h2><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">Cada parte do sistema conversa com a outra. O que é cadastrado em um lugar pode ser usado no outro, reduzindo retrabalho e deixando as informações mais fáceis de encontrar.</p></Reveal>
        <div className="space-y-3">{workflow.map(([number, title, description], i) => <Reveal key={number} delay={i * 90} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-700 text-sm font-black text-white">{number}</div><div><p className="font-semibold leading-6">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div></Reveal>)}</div>
      </div></section>

      <section id="portal" className="border-t border-slate-100 bg-slate-950 py-20 text-white dark:border-slate-900 sm:py-24"><div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <Reveal><p className="text-sm font-bold uppercase tracking-[0.18em] text-green-400">Portal do aluno</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">O aluno também tem um espaço para consultar suas informações.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Com a matrícula e a senha do portal, o aluno pode consultar suas próprias ocorrências sem entrar no ambiente usado pela gestão e pelos professores.</p><Link to="/consultar-ocorrencias" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3.5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-500 active:scale-[0.97] active:duration-100">Acessar consulta <FaArrowRight className="text-xs" /></Link></Reveal>
        <div className="grid gap-3 sm:grid-cols-2">{["Histórico de ocorrências", "Professor responsável", "Data e motivo do registro", "Troca da senha no primeiro acesso"].map((item, i) => <Reveal key={item} delay={i * 50} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-200"><FaCheckCircle className="mb-2 text-green-400" />{item}</Reveal>)}</div>
      </div></section>

      <section id="feedback" className="border-t border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/50"><div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
        <Reveal><p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Avaliações</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Quem usa o LogView pode contar como foi.</h2><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">Envie uma avaliação. A equipe analisa os comentários e decide quais poderão aparecer aqui.</p>
          {feedbacks.length > 0 && <div className="mt-8 space-y-3">{feedbacks.slice(0, 3).map((feedback, i) => <Reveal key={feedback.id} delay={i * 70} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2 text-amber-400">{[1, 2, 3, 4, 5].map((star) => <FaStar key={star} size={12} className={star <= feedback.avaliacao ? "" : "text-slate-300 dark:text-slate-700"} />)}</div>{feedback.comentario && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">“{feedback.comentario}”</p>}<p className="mt-2 text-xs font-semibold text-slate-400">{feedback.nome}{feedback.cargo ? ` · ${feedback.cargo}` : ""}</p></Reveal>)}</div>}
        </Reveal>
        <Reveal delay={80} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">{sent ? <div className="flex min-h-80 flex-col items-center justify-center text-center"><div style={{ animation: "lv-pop 500ms cubic-bezier(0.175,0.885,0.32,1.275) both" }} className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"><FaCheckCircle size={30} /></div><h3 className="mt-5 text-xl font-bold">Feedback enviado.</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Obrigado por avaliar o LogView. A avaliação será considerada para publicação após a verificação da avaliação.</p><button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-bold text-green-700 transition-colors duration-200 hover:underline">Enviar outro feedback</button></div> : <form onSubmit={submitFeedback} className="flex flex-col gap-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Nome<input required value={form.nome} onChange={(e) => update("nome", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition-colors duration-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-semibold">E-mail<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition-colors duration-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></label></div><label className="text-sm font-semibold">Cargo<input value={form.cargo} onChange={(e) => update("cargo", e.target.value)} placeholder="Professor, gestor, coordenador..." className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition-colors duration-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></label><div><p className="text-sm font-semibold">Como você avalia o sistema?</p><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} onClick={() => update("avaliacao", star)} aria-label={`${star} estrelas`} className="transition-transform duration-150 ease-out hover:scale-110 active:scale-95"><FaStar size={28} className={star <= form.avaliacao ? "text-amber-400" : "text-slate-300 dark:text-slate-700"} /></button>)}</div></div><label className="text-sm font-semibold">Título<input value={form.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="O que você achou?" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition-colors duration-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-semibold">Comentário<textarea rows={5} value={form.comentario} onChange={(e) => update("comentario", e.target.value)} placeholder="Conte o que funcionou bem ou o que poderia melhorar..." className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition-colors duration-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => update("recomendaria", form.recomendaria === true ? null : true)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${form.recomendaria === true ? "border-green-700 bg-green-700 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>Recomendaria</button><button type="button" onClick={() => update("recomendaria", form.recomendaria === false ? null : false)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${form.recomendaria === false ? "border-red-500 bg-red-500 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>Não recomendaria</button></div><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 transition-colors duration-200 hover:border-green-300 hover:bg-green-50/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-green-900 dark:hover:bg-green-950/20"><input type="checkbox" checked={form.autoriza_publicacao} onChange={(e) => update("autoriza_publicacao", e.target.checked)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-green-700" /><span>Autorizo que meu nome, cargo e comentário sejam publicados na página inicial <strong className="font-semibold text-slate-700 dark:text-slate-200">após a verificação da avaliação.</strong></span></label><button disabled={sending || !form.avaliacao} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-6 py-3.5 text-base font-bold text-white shadow-md transition-all duration-200 hover:bg-green-800 hover:shadow-lg active:scale-[0.97] active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:w-auto sm:self-start"><FaPaperPlane />{sending ? "Enviando..." : "Enviar feedback"}</button></form>}
        </Reveal>
      </div></section>

      <section className="border-t border-slate-200 py-16 dark:border-slate-800"><Reveal as="div" className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 lg:flex-row lg:text-left"><div><h2 className="text-2xl font-black sm:text-3xl">Quer conhecer o LogView por dentro?</h2><p className="mt-2 text-slate-600 dark:text-slate-400">Entre no sistema ou consulte uma ocorrência do portal do aluno.</p></div><div className="flex flex-col gap-2 sm:flex-row"><Link to="/consultar-ocorrencias" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-green-300 hover:text-green-700 active:scale-[0.97] active:duration-100 dark:border-slate-700 dark:text-slate-200">Consultar ocorrência</Link><Link to="/login" className="rounded-2xl bg-green-700 px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-800 active:scale-[0.97] active:duration-100">Entrar no sistema</Link></div></Reveal></section>

      <footer className="border-t border-slate-200 bg-slate-50 py-8 dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 dark:text-slate-400"><span>© {new Date().getFullYear()} LogView. Sistema de gestão escolar.</span><div className="flex gap-4"><a href="#feedback" className="transition-colors duration-200 hover:text-green-700">Enviar feedback</a><Link to="/consultar-ocorrencias" className="transition-colors duration-200 hover:text-green-700">Consultar ocorrência</Link><Link to="/login" className="transition-colors duration-200 hover:text-green-700">Entrar</Link></div></div></footer>
    </main>
  );
};
