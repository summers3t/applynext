import * as server from '../entries/pages/(app)/_layout.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/+layout.server.ts";
export const imports = ["_app/immutable/nodes/2.CopYbZ33.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CYsr-paj.js","_app/immutable/chunks/BAKKtip-.js","_app/immutable/chunks/C96VhvSi.js","_app/immutable/chunks/C9sUR3Xw.js","_app/immutable/chunks/B8FQCOyo.js","_app/immutable/chunks/7JXNQEVd.js","_app/immutable/chunks/VeT9vhzU.js","_app/immutable/chunks/DrU4zZF5.js","_app/immutable/chunks/Dew1yWqH.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DIGPD2v9.js"];
export const stylesheets = ["_app/immutable/assets/app.DHT2jc32.css"];
export const fonts = [];
