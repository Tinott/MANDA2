// Edge Function « claude-proxy » — permet à TOUS les utilisateurs de
// l'application de profiter de l'IA avec UNE seule clé Anthropic, stockée en
// secret côté serveur (jamais exposée au navigateur).
//
// Déploiement (une fois) :
//   supabase functions deploy claude-proxy
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ou via le dashboard Supabase : Edge Functions → Deploy new function
// (coller ce fichier), puis Settings → Edge Functions → Secrets.
//
// Garde-fous intégrés :
//   - seuls les utilisateurs CONNECTÉS à l'application peuvent appeler la
//     fonction (vérification du jeton Supabase) ;
//   - modèles limités à une liste blanche, max_tokens plafonné, taille de
//     requête plafonnée — personne ne peut faire exploser la facture ;
//   - pensez aussi à définir un plafond de dépense sur console.anthropic.com.

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODELES_AUTORISES = new Set([
  "claude-sonnet-5-5",
  "claude-haiku-4-5-20251001",
  "claude-opus-5-5",
]);
const MAX_TOKENS_PLAFOND = 4096;
const TAILLE_REQUETE_MAX = 400_000; // ~400 Ko de JSON

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: { message: "Méthode non autorisée." } }, 405);
  }

  // --- 1. L'appelant doit être un utilisateur connecté de l'application. ---
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json(
      { error: { message: "Authentification requise pour utiliser l'IA." } },
      401,
    );
  }

  // --- 2. La clé partagée doit être configurée côté serveur. ---
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      {
        error: {
          message:
            "L'IA partagée n'est pas encore configurée : l'administrateur doit définir le secret ANTHROPIC_API_KEY (voir INSTRUCTIONS.md).",
        },
      },
      503,
    );
  }

  // --- 3. Validation stricte de la requête. ---
  const raw = await req.text();
  if (raw.length > TAILLE_REQUETE_MAX) {
    return json({ error: { message: "Requête trop volumineuse." } }, 413);
  }
  let body: {
    model?: string;
    max_tokens?: number;
    system?: string;
    messages?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: { message: "Corps JSON invalide." } }, 400);
  }
  const model = MODELES_AUTORISES.has(body.model || "")
    ? body.model
    : "claude-sonnet-5-5";
  const maxTokens = Math.min(
    Math.max(1, Number(body.max_tokens) || 1024),
    MAX_TOKENS_PLAFOND,
  );
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: { message: "messages manquants." } }, 400);
  }

  // --- 4. Appel Anthropic avec la clé serveur. ---
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: body.system || undefined,
      messages: body.messages,
    }),
  });
  const data = await res.json().catch(() => ({
    error: { message: "Réponse Anthropic illisible." },
  }));
  return json(data, res.status);
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
