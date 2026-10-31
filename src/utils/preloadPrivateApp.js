// Pré-carrega apenas o código público dos módulos; nenhum dado privado é consultado.
// Os imports compartilham o mesmo cache de módulos que o React.lazy utiliza.
export function preloadPrivateApp() {
  void import("../Layout").catch(() => {});
  void import("../pages/Home").catch(() => {});
}
