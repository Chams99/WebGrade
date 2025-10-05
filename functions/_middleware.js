// This middleware ensures all API routes are handled properly on Cloudflare Pages
export function onRequest(context) {
  return context.next();
}
