"use client";

import { useState } from "react";
import {
  copyPlanToClipboard,
  downloadPlanAsPdf,
  downloadPlanAsWord,
  type PlanExportData,
} from "@/lib/exportPlan";

interface PlanExportProps {
  data: PlanExportData;
}

export default function PlanExport({ data }: PlanExportProps) {
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCopy = async () => {
    try {
      await copyPlanToClipboard(data);
      showMessage("プランをコピーしました");
    } catch {
      showMessage("コピーに失敗しました");
    }
  };

  const handleWord = () => {
    downloadPlanAsWord(data);
    showMessage("Wordファイルをダウンロードしました");
  };

  const handlePdf = () => {
    downloadPlanAsPdf(data);
    showMessage("PDFの保存画面を開きました。「PDFに保存」を選んでください");
  };

  return (
    <div className="glass p-5">
      <h3 className="mb-3 text-base font-bold text-[#5c4030]">プランを保存</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-secondary" onClick={handleCopy}>
          テキストをコピー
        </button>
        <button type="button" className="btn-secondary" onClick={handleWord}>
          Wordで保存
        </button>
        <button type="button" className="btn-secondary" onClick={handlePdf}>
          PDFで保存
        </button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-[#5c4030]">
          {message}
        </p>
      )}
    </div>
  );
}
