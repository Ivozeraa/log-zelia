import { LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

// Separado do bundle inicial. Gráfico só é solicitado depois da primeira renderização.
export default function OccurrenceChart({ width, data }) {
  return (
    <LineChart width={width} height={350} data={data} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
      <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
      <Tooltip contentStyle={{ borderRadius: "14px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
      <Line type="monotone" dataKey="ocorrencias" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: "#16a34a" }} activeDot={{ r: 6 }} />
    </LineChart>
  );
}
