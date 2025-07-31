import { I as escape_html, D as pop, z as push } from "../../../../chunks/index.js";
import "clsx";
import "../../../../chunks/supabaseClient.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/state.svelte.js";
function _page($$payload, $$props) {
  push();
  let message = "Logging you in…";
  $$payload.out.push(`<p>${escape_html(message)}</p>`);
  pop();
}
export {
  _page as default
};
