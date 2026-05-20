import { useTheme } from "../hooks/useTheme";

import { PageTitle } from "../components/ui/PageTitle";
import { ConfigSwitch } from "../components/ui/ConfigSwitch";

export const Settings = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <PageTitle
        title="Configurações"
        subtitle="Personalize sua experiência, ajuste preferências e gerencie as configurações da plataforma com facilidade."
      />

      <div className="flex flex-col gap-5 mt-6">
        <ConfigSwitch
          title="Modo Escuro"
          active={theme === "dark"}
          onClick={toggleTheme}
        />

        <ConfigSwitch
          title="Desativar Animações"
        />
      </div>
    </div>
  );
};