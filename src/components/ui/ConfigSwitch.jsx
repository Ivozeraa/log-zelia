export const ConfigSwitch = ({ title, active, onClick }) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-300 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 ">
      <p className="text-black dark:text-white">{title}</p>

      <button
        onClick={onClick}
        className={`w-14 h-8 rounded-full transition-all relative ${
          active ? "bg-green-600" : "bg-zinc-400"
        }`}
      >
        <div
          className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${
            active ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};