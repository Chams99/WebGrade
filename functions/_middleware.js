// Cloudflare Workers middleware for caching and API key rotation
export function onRequest(context) {
  return context.next();
}