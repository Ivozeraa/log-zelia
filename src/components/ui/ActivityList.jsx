import { SectionTitle } from "./SectionTitle";

export const ActivityList = ({
  title = "Histórico de atividades",
  data = [],
  emptyMessage = "Nenhuma atividade registrada.",
  renderItem,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle text={title} />

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950">
        {data.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          data.map((item, index) => (
            <div
              key={index}
              className="px-4 py-3"
            >
              {renderItem(item, index)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}