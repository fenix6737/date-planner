"use client";

import { useEffect, useState } from "react";
import GenderSetup from "@/components/GenderSetup";
import InputForm from "@/components/InputForm";
import DateChecklist from "@/components/DateChecklist";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [gender, setGender] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("userGender");
    setGender(saved);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[#7a6555]">読み込み中...</p>
      </div>
    );
  }

  if (!gender) {
    return <GenderSetup onComplete={() => setGender(localStorage.getItem("userGender"))} />;
  }

  return (
    <section className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#5c4030]">デートプランを作る</h2>
        <p className="mt-2 text-sm text-[#7a6555]">
          出発地と行きたい場所を入れると、ルートと時間の予定を自動で作ります
        </p>
      </div>
      <InputForm />
      <DateChecklist gender={gender} />
    </section>
  );
}
