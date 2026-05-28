import React from "react";

export const Table = ({
  columns,
  data,
  loading,
  emptyMessage = "Nenhum dado encontrado.",
  loadingMessage = "Carregando...",
}) => {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
              >
                {loadingMessage}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={item.id || index}
                className="
                  border-b border-slate-200 transition
                  hover:bg-slate-50
                  last:border-none
                  dark:border-slate-800
                  dark:hover:bg-slate-900/60
                "
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-slate-600 dark:text-slate-300"
                  >
                    {col.render
                      ? col.render(item)
                      : item[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};