
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Board = {
  clinic: string | null;
  serving: number[];
  waiting: number[];
};

function DisplayContent() {
  const { clinicId } = useParams<{ clinicId: string }>();

  const supabase = useMemo(() => createClient(), []);

  const [board, setBoard] = useState<Board | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("display_board", {
      p_clinic_id: clinicId,
    });

    if (data) {
      setBoard(data as Board);
    }
  }, [supabase, clinicId]);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  if (!board) {
    return (
      <main className="min-h-screen bg-[#12303f] p-12 text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#12303f] p-12 text-[#f6f4ee]">
      <h1 className="text-4xl font-bold">
        {board.clinic ?? "Clinic"}
      </h1>

      <section className="mt-12">
        <h2 className="text-3xl text-[#1fa89a]">
          Now serving
        </h2>

        {board.serving.length === 0 ? (
          <p className="mt-4 text-3xl opacity-70">
            Please wait for your number.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-8">
            {board.serving.map((n) => (
              <p
                key={n}
                className="text-[10rem] font-bold leading-none"
              >
                #{n}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-3xl text-[#f08a3c]">
          Next in line
        </h2>

        <div className="mt-4 flex flex-wrap gap-6">
          {board.waiting.length === 0 && (
            <p className="text-3xl opacity-70">
              No one waiting.
            </p>
          )}

          {board.waiting.map((n) => (
            <p
              key={n}
              className="text-6xl font-semibold"
            >
              #{n}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}

// SUSPENSE WRAPPER FOR NEXT.JS PRERENDERING
export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#12303f] text-white">
          <p className="text-xl font-semibold">
            Loading queue display...
          </p>
        </main>
      }
    >
      <DisplayContent />
    </Suspense>
  );
}
