import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { weeklyIndex } from "./mockApi";

// Rule: every chart ships with the equivalent table (same data, same source).
export function WeeklyIndexChart() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t("chart.title")}</h1>
      {/* Fixed size keeps the PoC testable in jsdom; production uses ResponsiveContainer. */}
      <BarChart width={480} height={240} data={weeklyIndex} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" />
        <YAxis />
        <Bar dataKey="value" fill="currentColor" />
      </BarChart>
      <table>
        <caption>{t("chart.title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("chart.week")}</th>
            <th scope="col">{t("chart.value")}</th>
            <th scope="col">{t("chart.denominator")}</th>
          </tr>
        </thead>
        <tbody>
          {weeklyIndex.map((r) => (
            <tr key={r.week}>
              <th scope="row">{r.week}</th>
              <td>{r.value}</td>
              <td>{r.denominator}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
