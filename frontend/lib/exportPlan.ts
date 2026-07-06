import type { PlanSpotItem } from "./api";

export interface PlanExportData {
  date: string;
  address: string;
  routeStyle: string;
  totalTime: string;
  totalDistance: string;
  budget: number;
  totalPrice: number;
  items: PlanSpotItem[];
  memo?: string;
}

const STYLE_LABELS: Record<string, string> = {
  relaxed: "のんびり",
  active: "アスレチック",
  stylish: "おしゃれ",
};

export function formatPlanText(data: PlanExportData): string {
  const lines = [
    "【デートプラン】",
    `日付: ${data.date}`,
    `出発地: ${data.address}`,
    `雰囲気: ${STYLE_LABELS[data.routeStyle] || data.routeStyle}`,
    `時間: ${data.totalTime}`,
    `移動距離: ${data.totalDistance}`,
    `予算: ${data.budget.toLocaleString()}円 / 使う見込み: ${data.totalPrice.toLocaleString()}円`,
    "",
  ];
  if (data.memo?.trim()) {
    lines.push("【自分用メモ】", data.memo, "");
  }
  lines.push("【予定】");

  data.items.forEach((item, i) => {
    lines.push(
      `${i + 1}. ${item.time} ${item.name}`,
      `   料金: ${item.budget_est > 0 ? `約${item.budget_est.toLocaleString()}円` : "無料"}`,
      `   評価: ${item.rating > 0 ? item.rating.toFixed(1) : "—"} (${item.review_count || 0}件)`,
      item.address ? `   住所: ${item.address}` : "",
      ""
    );
  });

  return lines.filter(Boolean).join("\n");
}

export function formatPlanHtml(data: PlanExportData): string {
  const rows = data.items
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.time}</td>
        <td>${item.name}</td>
        <td>${item.budget_est > 0 ? `約${item.budget_est.toLocaleString()}円` : "無料"}</td>
        <td>${item.rating > 0 ? item.rating.toFixed(1) : "—"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>デートプラン</title></head>
<body style="font-family: 'Yu Gothic', sans-serif; padding: 24px;">
  <h1>デートプラン</h1>
  <p>日付: ${data.date}</p>
  <p>出発地: ${data.address}</p>
  <p>雰囲気: ${STYLE_LABELS[data.routeStyle] || data.routeStyle}</p>
  <p>時間: ${data.totalTime} / 距離: ${data.totalDistance}</p>
  <p>予算: ${data.budget.toLocaleString()}円 / 使う見込み: ${data.totalPrice.toLocaleString()}円</p>
  ${data.memo?.trim() ? `<h2>自分用メモ</h2><p style="white-space: pre-wrap;">${data.memo.replace(/</g, "&lt;")}</p>` : ""}
  <h2>予定</h2>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <tr style="background: #e8ddd0;">
      <th>#</th><th>時間</th><th>場所</th><th>料金</th><th>評価</th>
    </tr>
    ${rows}
  </table>
</body></html>`;
}

export async function copyPlanToClipboard(data: PlanExportData): Promise<void> {
  await navigator.clipboard.writeText(formatPlanText(data));
}

export function downloadPlanAsWord(data: PlanExportData): void {
  const html = formatPlanHtml(data);
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `デートプラン_${data.date}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPlanAsPdf(data: PlanExportData): void {
  const html = formatPlanHtml(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
