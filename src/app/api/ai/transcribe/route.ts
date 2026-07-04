import { auth } from "@/server/auth";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Optional paid server-side transcription (Vercel AI Gateway multimodal).
 * Disabled by default — the web app uses the free browser Web Speech API instead.
 */
export async function POST(req: Request) {
  if (!env.VOICE_SERVER_TRANSCRIBE) {
    return Response.json(
      {
        error:
          "Server transcription is disabled. Use browser voice input (Web Speech API) or enable VOICE_SERVER_TRANSCRIBE.",
      },
      { status: 503 },
    );
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "Transcription is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return Response.json({ error: "Empty audio" }, { status: 400 });
  }

  const locale = (form.get("locale") as string) || "ru";
  const langHint = locale === "en" ? "English" : "Russian";
  const base64 = bytes.toString("base64");

  const { AI_GATEWAY_CHAT_URL } = await import("@/server/ai/gateway");

  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_GATEWAY_TRANSCRIBE_MODEL,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Transcribe this voice message verbatim. It is most likely in ${langHint}. ` +
                  "Return ONLY the transcription text — no quotes, no labels, no commentary.",
              },
              {
                type: "input_audio",
                input_audio: { data: base64, format: "wav" },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return Response.json(
      { error: "Could not reach the transcription service." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json(
      { error: `Transcription failed (${res.status})`, detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  type ContentPart = { text?: string };
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | ContentPart[] } }[];
  } | null;
  const raw = data?.choices?.[0]?.message?.content;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((p) => p.text ?? "").join("")
        : "";

  return Response.json({ text: text.trim() });
}
