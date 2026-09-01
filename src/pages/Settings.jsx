import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";

import { PageTitle } from "../components/ui/PageTitle";
import { ConfigSwitch } from "../components/ui/ConfigSwitch";

const getAnimationsDisabled = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("animationsDisabled") === "true";
};

export const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const [animationsDisabled, setAnimationsDisabled] = useState(getAnimationsDisabled);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", animationsDisabled);
    localStorage.setItem("animationsDisabled", String(animationsDisabled));
  }, [animationsDisabled]);

  const toggleAnimations = () => {
    setAnimationsDisabled((current) => !current);
  };

  return (
    <div>
      <PageTitle
        title="Configurações"
        subtitle="Personalize sua experiência, ajuste preferências e gerencie as configurações da plataforma com facilidade."
      />

      <div className="mt-6 flex flex-col gap-5">
        <ConfigSwitch
          title="Modo Escuro"
          active={theme === "dark"}
          onClick={toggleTheme}
        />

        <ConfigSwitch
          title="Desativar Animações"
          active={animationsDisabled}
          onClick={toggleAnimations}
        />
      </div>
    </div>
  );
};
