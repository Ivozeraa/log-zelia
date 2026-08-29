import { FaChevronDown } from "react-icons/fa";
import { useSchool } from "../../hooks/useSchool";

export function SchoolSwitcher({ compact = false }) {
  const {
    school,
    schools,
    selectedSchoolId,
    isGlobalAdmin,
    canSwitchSchool,
    switchSchool,
  } = useSchool();

  if (!isGlobalAdmin || !canSwitchSchool || !schools.length) return null;

  return (
    <label
      className={`relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${compact ? "max-w-56" : "max-w-72"}`}
      title="Alternar escola"
    >
      <span className="sr-only">Selecionar escola</span>
      <select
        value={selectedSchoolId ?? ""}
        onChange={(event) => void switchSchool(event.target.value)}
        className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-slate-700 outline-none dark:text-slate-200"
        aria-label="Selecionar escola"
      >
        {schools.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
      <FaChevronDown
        className="pointer-events-none absolute right-3 text-[10px] text-slate-400"
        aria-hidden="true"
      />
      {school?.cidade && (
        <span className="hidden text-[10px] text-slate-400 xl:inline">
          {school.cidade}
        </span>
      )}
    </label>
  );
}
