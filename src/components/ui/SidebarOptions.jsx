import { NavLink } from "react-router-dom"
import { ListItemButton, ListItemIcon, ListItemText } from "@mui/material"

export const SidebarOptions = ({ to, icon, text, onClick }) => {
  const IconComponent = icon

  return (
    <NavLink to={to} onClick={onClick} style={{ textDecoration: "none", color: "inherit" }}>
      {({ isActive }) => (
        <ListItemButton
          selected={isActive}
          sx={{
            minHeight: 44,
            borderRadius: 3,
            px: 1.5,
            color: isActive ? "primary.contrastText" : "text.secondary",
            bgcolor: isActive ? "primary.main" : "transparent",
            "&:hover": { bgcolor: isActive ? "primary.dark" : "action.hover", color: isActive ? "primary.contrastText" : "primary.main" },
            "&.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText" },
            "&.Mui-selected:hover": { bgcolor: "primary.dark" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}><IconComponent /></ListItemIcon>
          <ListItemText primary={text} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
        </ListItemButton>
      )}
    </NavLink>
  )
}