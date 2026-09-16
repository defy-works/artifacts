/**
 * Prepare a published page for the viewer frame: inject the runtime as
 * the first script (so `window.claude` exists before page code) and, when
 * the artifact has supporting files, a `<base>` pointing at them.
 */
export function prepareHtml(
  html: string,
  opts: { origin: string; artifactId: string; hasFiles: boolean },
) {
  const tags =
    (opts.hasFiles ? `<base href="${opts.origin}/_files/${opts.artifactId}/">` : "") +
    `<script src="${opts.origin}/claude-runtime.js"></script>`;
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + tags + html.slice(at);
  }
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, at) + `<head>${tags}</head>` + html.slice(at);
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype[0].length : 0;
  return html.slice(0, at) + `<head>${tags}</head>` + html.slice(at);
}

/** Sandbox flags for the viewer iframe. No `allow-same-origin`: the page
 * runs on an opaque origin and can never touch the host's cookies. */
export const SANDBOX =
  "allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock";
