import { useTheme } from "../hooks/useTheme";

export const Settings = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Personalize sua experiência, ajuste preferências e gerencie as configurações da plataforma com facilidade.
      </p>

      <button
        onClick={toggleTheme}
        className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-800 dark:text-white"
      >
        {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
      </button>
    </div>
  )
}