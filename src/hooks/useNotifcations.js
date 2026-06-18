import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "./useAuth";

export const useNotificacoes = () => {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  // Carrega notificações iniciais
  const carregar = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const query = supabase
      .from("notificacoes")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(30);

    if (user.role_id !== 1 && user.escola_id) {
      query.eq("escola_id", user.escola_id);
    }

    const { data } = await query;
    setNotificacoes(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Escuta inserções em tempo real
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notificacoes-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          ...(user.role_id !== 1 && user.escola_id
            ? { filter: `escola_id=eq.${user.escola_id}` }
            : {}),
        },
        (payload) => {
          setNotificacoes((prev) => [payload.new, ...prev]);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // Marca uma notificação como lida
  const marcarComoLida = useCallback(async (id) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  }, []);

  // Marca todas como lidas
  const marcarTodasComoLidas = useCallback(async () => {
    if (!user) return;

    const ids = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (ids.length === 0) return;

    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }, [notificacoes, user]);

  return { notificacoes, naoLidas, loading, marcarComoLida, marcarTodasComoLidas };
};