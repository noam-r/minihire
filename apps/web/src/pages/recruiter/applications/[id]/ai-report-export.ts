import type { APIRoute } from "astro";

export const prerender = false;

/** @deprecated Use dossier-export for full candidate dossiers; kept for existing links. */
export const GET: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  const format = context.url.searchParams.get("format");
  if (format !== "markdown" && format !== "pdf") {
    return new Response('Query parameter "format" must be "markdown" or "pdf".', { status: 400 });
  }

  const target = new URL(context.url);
  target.pathname = `/recruiter/applications/${id}/dossier-export`;
  target.search = `format=${format}`;

  return context.redirect(target.pathname + target.search, 307);
};
