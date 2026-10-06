const appRoot = () => `${location.origin}${import.meta.env.BASE_URL}`;

// Links use a query parameter instead of the #hash so they survive in-app browser hand-offs.
export const employeeLink = (token: string) => `${appRoot()}?go=/e/${token}`;
export const adminLink = (token: string) => `${appRoot()}?go=/a/${token}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// Turn ?go=/e/xxx into #/e/xxx before the router starts.
export function applyGoParam() {
  const params = new URLSearchParams(location.search);
  const go = params.get('go');
  if (!go || !/^\/[ae]\/[a-z0-9]+$/i.test(go)) return;
  params.delete('go');
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}#${go}`);
}
