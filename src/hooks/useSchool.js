import { useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContextImpl";

export function useSchool() {
  const context = useContext(SchoolContext);

  if (!context) {
    throw new Error("useSchool deve ser usado dentro de SchoolProvider");
  }

  return context;
}
