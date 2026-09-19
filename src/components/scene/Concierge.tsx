import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Sparkles, Square, Loader2, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { CONCIERGE_SUGGESTIONS } from "@/lib/scene-constants";
import { itemImage } from "@/lib/scene-images";
import { formatPrice, track } from "@/lib/track";
import { cn } from "@/lib/utils";

interface ToolItem {
  id: string; type: "venue" | "event" | "experience"; slug: string; name: string; category: string | null; area: string | null;
  priceMin: number | null; priceMax: number | null; imageUrl: string | null; sponsored: boolean; verified: boolean;
}

export function Concierge({ context, initialPrompt, suggestions = CONCIERGE_SUGGESTIONS, className, autoStart = false, placeholder = "Ask the concierge anything about Mumbai…" }: {
  context?: Record<string, unknown>;
  initialPrompt?: string;
  suggestions?: string[];
  className?: string;
  autoStart?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { context } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(context)],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (autoStart && initialPrompt && !started.current) {
      started.current = true;
      track("itinerary_generated", { metadata: context });
      void sendMessage({ text: initialPrompt });
    }
  }, [autoStart, initialPrompt, sendMessage, context]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    track("concierge_message", { metadata: { length: t.length } });
    void sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className={cn("flex min-h-[70dvh] flex-col rounded-[1.75rem] border border-border bg-card/60", className)}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 && !busy && (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-teal/15 text-teal"><Sparkles className="size-5" /></span>
            <h2 className="mt-4 text-2xl font-semibold">Your Mumbai concierge</h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Ask for a plan, a place, or a change. I only suggest listings SceneAI can verify.</p>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading the city…</div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div>
        )}
      </div>

      <div className="border-t border-border p-3 md:p-4">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {suggestions.map((s) => (
            <button key={s} onClick={() => submit(s)} disabled={busy} className="shrink-0 rounded-full border border-teal/30 bg-teal/5 px-3 py-1.5 text-xs text-teal transition hover:bg-teal/15 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
          className="flex items-end gap-2 rounded-2xl border border-input bg-background/60 p-1.5 pl-4 focus-within:ring-2 focus-within:ring-ring/50"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
            rows={1}
            placeholder={placeholder}
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label="Stop"><Square className="size-4" /></Button>
          ) : (
            <Button type="submit" size="icon" variant="ember" aria-label="Send" disabled={!input.trim()}><ArrowUp className="size-4" /></Button>
          )}
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const [showReasoning, setShowReasoning] = useState(false);
  const reasoning = message.parts.filter((p) => p.type === "reasoning").map((p) => (p as { text: string }).text).join("\n");
  const toolItems: ToolItem[] = [];
  for (const p of message.parts) {
    if (p.type === "tool-search_listings" && "output" in p && p.output) {
      const out = p.output as { items?: ToolItem[] };
      toolItems.push(...(out.items ?? []));
    }
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] space-y-3 md:max-w-[80%]", isUser && "rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground")}>
        {!isUser && reasoning && (
          <button onClick={() => setShowReasoning((s) => !s)} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Thinking <ChevronDown className={cn("size-3 transition", showReasoning && "rotate-180")} />
          </button>
        )}
        {!isUser && showReasoning && reasoning && <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{reasoning}</p>}
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return isUser ? (
              <p key={i}>{part.text}</p>
            ) : (
              <div key={i} className="prose-scene text-[15px] leading-relaxed text-foreground/90">
                <ReactMarkdown components={{ a: ({ href, children }) => (href?.startsWith("/") ? <Link to={href as "/"}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a>) }}>
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }
          if (part.type === "tool-search_listings" && !("output" in part && part.output)) {
            return <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Searching Mumbai listings…</p>;
          }
          return null;
        })}
        {!isUser && toolItems.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {toolItems.slice(0, 8).map((it) => (
              <Link
                key={it.id}
                to={it.type === "venue" ? "/v/$slug" : it.type === "event" ? "/e/$slug" : "/x/$slug"}
                params={{ slug: it.slug }}
                className="relative w-36 shrink-0 overflow-hidden rounded-2xl border border-border"
              >
                <img src={itemImage({ imageUrl: it.imageUrl, categorySlug: null })} alt="" loading="lazy" width={512} height={384} className="aspect-[4/3] w-full object-cover" />
                <div className="image-fade absolute inset-0" />
                {it.sponsored && <span className="absolute left-2 top-2 rounded-full bg-saffron px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-saffron-foreground">Sponsored</span>}
                <div className="absolute inset-x-2 bottom-2">
                  <p className="line-clamp-1 font-display text-sm font-semibold">{it.name}</p>
                  <p className="text-[10px] text-foreground/80">{it.area} · {formatPrice(it.priceMin, it.priceMax)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
