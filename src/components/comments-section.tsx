"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/lib/actions/comments";
import { formatZurich } from "@/lib/dates";

interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  user: { name: string };
}

export function CommentsSection({
  betId,
  comments,
}: {
  betId: string;
  comments: Comment[];
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addComment(betId, body);
      if (!result.ok) {
        setError(result.errors?.[0] ?? "Couldn't post that.");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-lees">Comments</h2>

      <div className="flex flex-col gap-2">
        {comments.map((c) => (
          <div key={c.id} className="bg-rack rounded-sm px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-craie text-sm font-medium">{c.user.name}</span>
              <span className="font-utility text-xs text-lees">
                {formatZurich(c.createdAt)}
              </span>
            </div>
            <p className="text-craie text-sm whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
          rows={2}
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie text-sm placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
        {error && <p className="text-marc text-xs">{error}</p>}
        <button
          disabled={pending || !body.trim()}
          onClick={submit}
          className="self-start bg-verre text-cave rounded-sm px-4 py-2 text-sm font-medium hover:brightness-110 transition-colors disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </section>
  );
}
