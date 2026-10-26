// Build-time guard only; this module is not shipped as a browser dependency.
export function assertOfflineHTML(html) {
  const failures=[];
  if(!html.includes("connect-src 'none'"))failures.push('Missing no-network CSP');
  if(!html.includes("default-src 'none'"))failures.push('Missing deny-by-default CSP');
  if(/<script\b[^>]*\bsrc\s*=/i.test(html))failures.push('External script');
  if(/<link\b[^>]*rel=["'](?:stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload)["']/i.test(html))failures.push('External linked asset');
  if(/<(?:img|iframe|video|audio|source|embed)\b[^>]*(?:src|srcset)=["'](?!data:|blob:|#)/i.test(html))failures.push('Non-inline media');
  if(/<meta\b[^>]*http-equiv=["']refresh/i.test(html))failures.push('Automatic navigation');
  if(failures.length)throw new Error('Offline packaging blocked: '+failures.join(', '));
}
