// Función gratuita de Supabase que pasa el marcador en vivo de NBA.com a la app
// (por si el navegador no deja leerlo directamente). Solo acepta ids de partido de NBA.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = new URL(req.url).searchParams.get("game") ?? "";
  if (!/^\d{10}$/.test(id)) return new Response("id no válido", { status: 400, headers: cors });
  const r = await fetch(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/" },
  });
  return new Response(await r.text(), {
    status: r.status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=15" },
  });
});
