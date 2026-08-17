import { useEffect, useMemo, useState } from "react";
import { FaCookieBite, FaRegStar, FaShieldAlt, FaStar, FaTimes } from "react-icons/fa";
import { useAuth } from "../../hooks/useAuth";
import { notify } from "../../utils/notify";
import { supabase } from "../../utils/supabase";

const COOKIE_KEY = "logview_cookie_consent_v1";
const FEEDBACK_KEY_PREFIX = "logview_feedback_prompt_seen_v1";

const TERMS = [
  ["1. Apresentação", "O Logview é uma plataforma destinada ao registro, acompanhamento e gerenciamento de ocorrências relacionadas ao ambiente escolar. O sistema apoia a instituição na organização de informações e no acompanhamento de situações, sem substituir a avaliação ou a decisão dos profissionais responsáveis. Ao utilizar a plataforma, o usuário declara estar de acordo com estes Termos de Uso e com as políticas aplicáveis."],
  ["2. Usuários autorizados", "O acesso é destinado exclusivamente a pessoas autorizadas pela instituição, como direção, coordenação, professores, funcionários autorizados, equipe pedagógica e demais profissionais com necessidade legítima de utilização. Cada usuário deve utilizar somente sua própria conta e credenciais."],
  ["3. Finalidade do sistema", "O sistema poderá ser utilizado para registrar e consultar ocorrências autorizadas, acompanhar situações, registrar providências, organizar informações, gerar relatórios e manter histórico das ações realizadas. Os registros devem ter finalidade relacionada à gestão escolar."],
  ["4. Responsabilidade pelos registros", "Quem registra uma ocorrência é responsável pela veracidade, objetividade e adequação das informações inseridas. É vedado inserir informações falsas, acusações sem fundamento, comentários ofensivos, conteúdo desnecessário ou linguagem discriminatória, humilhante ou que exponha indevidamente estudantes, professores ou funcionários. O sistema não deve ser utilizado para perseguição, constrangimento, discriminação ou abuso."],
  ["5. Acesso às informações", "As ocorrências possuem acesso restrito conforme as permissões definidas pela instituição. É proibido compartilhar informações, capturas de tela ou relatórios com pessoas não autorizadas, utilizar dados para fins pessoais, copiar ou distribuir informações da plataforma ou acessar registros desnecessários às atribuições do usuário."],
  ["6. Dados pessoais e privacidade", "O sistema poderá tratar informações relacionadas a estudantes, responsáveis, professores e funcionários. Esses dados devem ser utilizados para finalidades legítimas de gestão escolar e tratados conforme a legislação aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD). O acesso deve ser limitado, sempre que adequado, às pessoas que realmente necessitem das informações."],
  ["7. Segurança das contas", "O usuário é responsável pela proteção de suas credenciais. É proibido compartilhar senha, permitir o uso da conta por terceiros, tentar acessar contas alheias, contornar mecanismos de segurança, explorar vulnerabilidades ou obter acesso não autorizado. Suspeitas de comprometimento devem ser comunicadas à administração responsável."],
  ["8. Registro de atividades", "O sistema poderá registrar atividades como acessos, criação ou alteração de ocorrências e ações administrativas. Esses registros poderão ser utilizados para segurança, auditoria, manutenção e investigação de atividades indevidas."],
  ["9. Uso indevido", "É proibido inserir conteúdo ilegal, ameaçar ou assediar pessoas, praticar discriminação, divulgar informações confidenciais indevidamente, alterar ou apagar informações sem autorização, prejudicar o funcionamento da plataforma, realizar acesso não autorizado ou utilizar dados escolares para finalidade diferente da permitida."],
  ["10. Alteração e correção de registros", "Alterações em ocorrências devem ser realizadas somente por usuários autorizados. Quando aplicável, o sistema poderá manter histórico das alterações, identificando o responsável e a data. A exclusão de registros poderá ser restrita a administradores ou responsáveis definidos pela instituição."],
  ["11. Disponibilidade", "A administração poderá realizar manutenções, atualizações e alterações. São adotadas medidas para manter o serviço disponível, mas não é garantido funcionamento ininterrupto ou livre de erros."],
  ["12. Suspensão ou encerramento", "A instituição poderá suspender ou cancelar o acesso diante de violação destes termos, uso indevido, tentativa de acesso não autorizado, compartilhamento indevido de informações, encerramento da relação com a instituição ou outras situações que justifiquem a restrição."],
  ["13. Responsabilidade da instituição", "Cabe à instituição definir usuários, níveis de acesso, informações permitidas, procedimentos diante de ocorrências e medidas administrativas ou pedagógicas. O Logview é uma ferramenta de apoio à gestão e não substitui a análise dos profissionais responsáveis."],
  ["14. Aceitação", "Ao selecionar que aceita os Termos de Uso ou continuar utilizando o sistema após ter acesso a estes termos, o usuário declara que os leu, compreendeu e concorda em cumprir suas regras. Quem não concordar deverá deixar de utilizar a plataforma e comunicar a administração responsável."],
  ["15. Alterações dos termos", "Estes termos poderão ser atualizados quando necessário. A versão vigente será disponibilizada no próprio sistema, acompanhada da respectiva data de atualização."],
  ["16. Contato", "Para dúvidas, solicitações ou problemas relacionados ao Logview, utilize a área Suporte disponível no sistema. A instituição responsável pelo ambiente também poderá indicar o canal oficial de atendimento aos usuários."]
];

function Modal({ children, onClose, maxWidth = "max-w-xl" }) {
  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`relative flex max-h-[min(88vh,760px)] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950`}>
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><FaTimes size={13} /></button>
        {children}
      </div>
    </div>
  );
}

function TermsModal({ onClose }) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <header className="border-b border-slate-200 bg-slate-50 px-6 py-6 pr-16 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-green-700 dark:bg-green-950/50 dark:text-green-300"><FaShieldAlt /> Documento oficial</div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Termos de Uso — Logview</h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Versão vigente em 17 de agosto de 2026</p>
      </header>
      <div className="overflow-y-auto px-6 py-6"><div className="space-y-6 text-sm leading-7 text-slate-600 dark:text-slate-300">{TERMS.map(([title, text]) => <section key={title}><h3 className="mb-1 font-bold text-slate-900 dark:text-white">{title}</h3><p>{text}</p></section>)}</div></div>
      <footer className="border-t border-slate-200 px-6 py-4 dark:border-slate-800"><button type="button" onClick={onClose} className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-800">Entendi</button></footer>
    </Modal>
  );
}

function CookieBanner({ onTerms }) {
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({ analytics: false });

  const save = (choice) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ essential: true, analytics: choice === "all" || (choice === "custom" && preferences.analytics), updatedAt: new Date().toISOString() }));
    window.dispatchEvent(new Event("logview-cookie-consent"));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1250] p-3 sm:p-5"><div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-3"><div className="mt-0.5 hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-100 text-green-700 sm:grid dark:bg-green-950/60 dark:text-green-300"><FaCookieBite /></div><div><h3 className="font-bold text-slate-900 dark:text-white">Sua privacidade importa</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">Usamos cookies essenciais para manter preferências e o funcionamento do Logview. Cookies opcionais só serão utilizados com sua permissão. Consulte também nossos <button type="button" onClick={onTerms} className="font-semibold text-green-700 underline underline-offset-2 dark:text-green-300">Termos de Uso</button>.</p></div></div>
      {!showSettings ? <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setShowSettings(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">Personalizar</button><button type="button" onClick={() => save("essential")} className="rounded-xl border border-green-200 px-4 py-2.5 text-xs font-bold text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/30">Somente essenciais</button><button type="button" onClick={() => save("all")} className="rounded-xl bg-green-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-green-800">Aceitar todos</button></div> : <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={preferences.analytics} onChange={(e) => setPreferences({ analytics: e.target.checked })} className="accent-green-700" /> Cookies opcionais</label><button type="button" onClick={() => save("custom")} className="rounded-xl bg-green-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-800">Salvar preferências</button></div>}
      </div></div></div>
  );
}

function FeedbackModal({ user, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [recommend, setRecommend] = useState(null);
  const [allowPublication, setAllowPublication] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!rating) return notify.warning("Escolha uma avaliação de 1 a 5 estrelas.");
    setSaving(true);
    const { error } = await supabase.from("feedbacks").insert({ nome: user?.nome || "Usuário do Logview", email: user?.email || null, cargo: null, titulo: rating >= 4 ? "Boa experiência com o Logview" : "Avaliação do Logview", avaliacao: rating, comentario: comment.trim() || null, autoriza_publicacao: allowPublication, publicado: false, recomendaria: recommend });
    setSaving(false);
    if (error) { console.error("Erro ao enviar avaliação:", error); notify.error("Não foi possível enviar sua avaliação agora."); return; }
    notify.success("Obrigado! Sua avaliação foi enviada.");
    onClose();
  };

  return <Modal onClose={onClose}><div className="overflow-y-auto"><div className="bg-gradient-to-br from-green-700 to-emerald-600 px-6 pb-8 pt-7 text-white"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><FaRegStar size={21} /></div><p className="text-xs font-bold uppercase tracking-[0.18em] text-green-100">Sua opinião faz diferença</p><h2 className="mt-2 text-2xl font-black tracking-tight">Como está sendo sua experiência?</h2><p className="mt-2 max-w-md text-sm leading-6 text-green-50">Leva menos de um minuto. Seu feedback ajuda a tornar o Logview mais rápido, simples e útil para a escola.</p></div>
    <div className="space-y-6 px-6 py-6"><div><p className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Como você avalia o sistema?</p><div className="flex gap-2" onMouseLeave={() => setHover(0)}>{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} estrelas`} onMouseEnter={() => setHover(value)} onClick={() => setRating(value)} className="rounded-xl p-2 transition hover:bg-amber-50 dark:hover:bg-amber-950/20"><FaStar size={28} className={(hover || rating) >= value ? "text-amber-400" : "text-slate-200 dark:text-slate-700"} /></button>)}</div><p className="mt-2 text-xs text-slate-400">{rating ? ["Muito ruim", "Pode melhorar", "Razoável", "Muito bom", "Excelente"][rating - 1] : "Selecione uma nota"}</p></div>
      <div><label className="mb-2 block text-sm font-bold text-slate-800 dark:text-white">O que você gostaria de contar?</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={600} placeholder="Conte o que funcionou bem ou o que podemos melhorar..." className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><div className="mt-1 text-right text-[11px] text-slate-400">{comment.length}/600</div></div>
      <div><p className="mb-2 text-sm font-bold text-slate-800 dark:text-white">Você recomendaria o Logview?</p><div className="flex gap-2"><button type="button" onClick={() => setRecommend(true)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${recommend === true ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>Sim</button><button type="button" onClick={() => setRecommend(false)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${recommend === false ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/30" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>Ainda não</button></div></div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={allowPublication} onChange={(e) => setAllowPublication(e.target.checked)} className="mt-0.5 accent-green-700" /><span className="text-xs leading-5 text-slate-500 dark:text-slate-400">Autorizo o Logview a publicar meu comentário na página inicial, sem expor dados de contato.</span></label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Agora não</button><button type="button" onClick={submit} disabled={saving} className="rounded-xl bg-green-700 px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enviando..." : "Enviar avaliação"}</button></div></div></div></Modal>;
}

export function LegalAndFeedback() {
  const { user } = useAuth();
  const [cookieVisible, setCookieVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const feedbackKey = useMemo(() => `${FEEDBACK_KEY_PREFIX}_${user?.id || "guest"}`, [user?.id]);

  useEffect(() => {
    const check = () => setCookieVisible(!localStorage.getItem(COOKIE_KEY));
    check();
    window.addEventListener("logview-cookie-consent", check);
    return () => window.removeEventListener("logview-cookie-consent", check);
  }, []);

  useEffect(() => {
    if (!user || cookieVisible || localStorage.getItem(feedbackKey)) return undefined;
    const timer = window.setTimeout(() => { localStorage.setItem(feedbackKey, new Date().toISOString()); setFeedbackVisible(true); }, 1100);
    return () => window.clearTimeout(timer);
  }, [user, cookieVisible, feedbackKey]);

  return <>{cookieVisible && <CookieBanner onTerms={() => setTermsVisible(true)} />}{termsVisible && <TermsModal onClose={() => setTermsVisible(false)} />}{feedbackVisible && <FeedbackModal user={user} onClose={() => setFeedbackVisible(false)} />}</>;
}
