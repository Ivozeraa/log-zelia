import React from "react";
import { Button } from "./Button";

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const visiblePages = Array.from(
    { length: totalPages },
    (_, i) => i + 1
  ).filter(
    (page) =>
      page === currentPage ||
      page === currentPage - 1 ||
      page === currentPage + 1
  );

  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
      <Button
        size="xs"
        variant="outline"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="
          rounded-full
          border
          border-slate-300
          bg-white
          text-slate-700
          hover:bg-green-50
          dark:border-slate-700
          dark:bg-slate-900
          dark:text-slate-200
          dark:hover:bg-slate-800
        "
      >
        «
      </Button>

      {visiblePages.map((page) => (
        <Button
          key={page}
          size="xs"
          onClick={() => onPageChange(page)}
          className={
            currentPage === page
              ? `
                rounded-full
                bg-green-600
                text-white
                hover:bg-green-700
              `
              : `
                rounded-full
                border
                border-slate-300
                bg-white
                text-slate-700
                hover:bg-green-50
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-200
                dark:hover:bg-slate-800
              `
          }
        >
          {page}
        </Button>
      ))}

      <Button
        size="xs"
        variant="outline"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="
          rounded-full
          border
          border-slate-300
          bg-white
          text-slate-700
          hover:bg-green-50
          dark:border-slate-700
          dark:bg-slate-900
          dark:text-slate-200
          dark:hover:bg-slate-800
        "
      >
        »
      </Button>
    </div>
  );
};