import { I as escape_html, D as pop, z as push } from "../../chunks/index.js";
import "clsx";
import { p as page } from "../../chunks/index3.js";
function Error($$payload, $$props) {
  push();
  $$payload.out.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
  pop();
}
export {
  Error as default
};
