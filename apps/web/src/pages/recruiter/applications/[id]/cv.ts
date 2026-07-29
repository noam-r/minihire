import type { APIRoute } from "astro";

import { getRecruiterPocketBase } from "../../../../lib/recruiter-auth/session";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  const session = context.locals.recruiter ?? (await getRecruiterPocketBase(context));
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { pb } = session;

  let record: { id: string; collectionId: string; cv_file: string };
  try {
    record = await pb.collection("applications").getOne(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const cv = record.cv_file;
  if (!cv) {
    return new Response("No CV on file", { status: 404 });
  }

  const fileUrl = pb.files.getURL(record, String(cv));
  const upstream = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${pb.authStore.token}`,
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Could not load file", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const disposition = `inline; filename="${String(cv).replace(/"/g, "")}"`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
};
