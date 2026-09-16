import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { useSchool } from "../../hooks/useSchool"
import logo from "../../assets/images/logo.png"
import { UserSidebar } from "../user/UserSidebar"
import { Sidebar } from "./Sidebar"
import { CurrentUserAvatar } from "../user/CurrentUserAvatar"
import { useCurrentUserName } from "../../hooks/useCurrentUserName"
import { useNotificacoes } from "../../hooks/useNotifcations"
import { AppBar, Toolbar, Box, Typography, IconButton, Badge, Menu, MenuItem, Divider, ListItemText } from "@mui/material"
import { FaBell, FaBars, FaComments } from "react-icons/fa"

const formatarTempo = (isoString) => {
  if (!isoString) return ""
  const diff = Date.now() - new Date(isoString).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export function Header() {
  const { user } = useAuth()
  const { school } = useSchool()
  const name = useCurrentUserName()
  const navigate = useNavigate()
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas } = useNotificacoes()
  const [openUser, setOpenUser] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  const sinoRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (sinoRef.current && !sinoRef.current.contains(e.target)) setAnchorEl(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleClickNotificacao = (n) => {
    if (!n.aluno_id) return
    marcarComoLida(n.id)
    setAnchorEl(null)
    navigate("/app/advertencias", { state: { alunoId: n.aluno_id } })
  }

  const schoolName = school?.nome || "LogView"

  return (
    <>
      <AppBar position="fixed" color="default" elevation={0} sx={{ zIndex: 1201, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", backdropFilter: "blur(12px)" }}>
        <Toolbar sx={{ minHeight: "64px !important", px: { xs: 1.5, sm: 2.5, md: 3 }, gap: { xs: 1, sm: 1.5 } }}>
          <IconButton onClick={() => setOpenMenu((v) => !v)} sx={{ display: { xs: "inline-flex", md: "none" } }} aria-label={openMenu ? "Fechar menu" : "Abrir menu"}>
            <FaBars />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flex: 1 }}>
            <Box component="img" src={logo} alt="Logo LogView" sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="p" sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 21, md: 24 }, lineHeight: 1, color: "primary.main", whiteSpace: "nowrap" }}>
                LOG <Box component="span" sx={{ color: "secondary.main" }}>VIEW</Box>
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: { xs: "42vw", sm: 420 } }}>{schoolName}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1.5 } }}>
            {Number(user?.role_id) === 1 && (
              <IconButton onClick={() => navigate("/app/feedbacks")} aria-label="Feedbacks da landing" title="Feedbacks da landing">
                <FaComments />
              </IconButton>
            )}

            <Box ref={sinoRef}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Notificações" aria-expanded={Boolean(anchorEl)}>
                <Badge badgeContent={naoLidas > 9 ? "9+" : naoLidas} color="error" invisible={naoLidas === 0}>
                  <FaBell />
                </Badge>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 360 }, maxWidth: "calc(100vw - 24px)", maxHeight: "70vh", borderRadius: 3, mt: 1 } }}
              >
                <Box sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>Notificações</Typography>
                  {naoLidas > 0 && <Typography component="button" onClick={marcarTodasComoLidas} variant="caption" color="primary" sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", p: 0 }}>Marcar todas como lidas</Typography>}
                </Box>
                <Divider />
                {notificacoes.length === 0 ? (
                  <Box sx={{ py: 5, px: 2, textAlign: "center" }}>
                    <Typography sx={{ fontSize: 28, mb: 1 }}>🔔</Typography>
                    <Typography variant="body2" color="text.secondary">Nenhuma notificação</Typography>
                  </Box>
                ) : notificacoes.map((n) => (
                  <MenuItem key={n.id} onClick={() => handleClickNotificacao(n)} sx={{ alignItems: "flex-start", gap: 1.25, py: 1.25, bgcolor: n.lida ? "transparent" : "warning.50" }}>
                    <Typography sx={{ mt: 0.25 }}>⚠️</Typography>
                    <ListItemText primary={n.mensagem} secondary={formatarTempo(n.criado_em)} primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} secondaryTypographyProps={{ fontSize: 11 }} />
                    {!n.lida && <Box component="button" onClick={(e) => { e.stopPropagation(); marcarComoLida(n.id) }} aria-label="Marcar como lida" sx={{ width: 10, height: 10, minWidth: 10, border: 0, borderRadius: "50%", bgcolor: "warning.main", mt: 1, cursor: "pointer" }} />}
                  </MenuItem>
                ))}
                {notificacoes.length > 0 && <><Divider /><Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1 }}>{naoLidas > 0 ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo em dia ✓"}</Typography></>}
              </Menu>
            </Box>

            <IconButton onClick={() => setOpenUser((v) => !v)} aria-label="Abrir perfil" sx={{ borderRadius: 3, gap: 1, p: 0.5 }}>
              <Typography sx={{ display: { xs: "none", sm: "block" }, maxWidth: { sm: 144, md: 208 }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.nome || name || "Usuário"}</Typography>
              <CurrentUserAvatar />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <UserSidebar open={openUser} setOpen={setOpenUser} />
      <Sidebar open={openMenu} setOpen={setOpenMenu} />
    </>
  )
}
