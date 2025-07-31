import { E as store_get, J as slot, K as unsubscribe_stores, D as pop, z as push } from "../../../chunks/index.js";
import "../../../chunks/supabaseClient.js";
import { s as session } from "../../../chunks/session.js";
/* empty css                  */
function _layout($$payload, $$props) {
  push();
  var $$store_subs;
  $$payload.out.push(`<nav>`);
  if (store_get($$store_subs ??= {}, "$session", session)) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<button>Sign out</button>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<button>Sign in with Google</button>`);
  }
  $$payload.out.push(`<!--]--></nav> <!---->`);
  slot($$payload, $$props, "default", {});
  $$payload.out.push(`<!---->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _layout as default
};
