/* single-file builds have no service worker */
export function registerSW(){ return () => {}; }
