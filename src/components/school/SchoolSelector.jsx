import { CustomSelect } from "../ui/CustomSelect";
import { useSchool } from "../../hooks/useSchool";

export function SchoolSelector({
  value,
  onChange,
  schools = [],
  label = "Escola",
  placeholder = "Selecionar escola",
  allowAll = false,
  ...props
}) {
  const { schoolId, isGlobalAdmin, canSwitchSchool } = useSchool();

  const options = [
    ...(allowAll && isGlobalAdmin
      ? [{ value: "", label: "Todas as escolas" }]
      : []),
    ...schools.map((school) => ({
      value: String(school.id),
      label: school.nome,
    })),
  ];

  const effectiveValue = isGlobalAdmin && canSwitchSchool
    ? String(value ?? "")
    : String(schoolId ?? "");

  const handleChange = (nextValue) => {
    if (!isGlobalAdmin || !canSwitchSchool) return;
    onChange?.(nextValue);
  };

  return (
    <CustomSelect
      {...props}
      label={label}
      value={effectiveValue}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      disabled={!isGlobalAdmin || !canSwitchSchool || props.disabled}
    />
  );
}
