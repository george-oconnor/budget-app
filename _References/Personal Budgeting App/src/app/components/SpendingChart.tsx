import { Transaction } from "./AddTransactionSheet";
import { Card } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface SpendingChartProps {
  transactions: Transaction[];
}

const COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // green
  "#06b6d4", // cyan
  "#6366f1", // indigo
];

export function SpendingChart({ transactions }: SpendingChartProps) {
  const expenses = transactions.filter((t) => t.type === "expense");

  const categoryTotals = expenses.reduce((acc, transaction) => {
    const category = transaction.category;
    acc[category] = (acc[category] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Spending by Category</h3>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No expense data yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => `${value}: $${entry.payload.value}`}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
