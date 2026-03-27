import gsap from "gsap";
import Flip from "gsap/Flip.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** @returns {void} */
export function registerGsapPlugins() {
  if (registered) {
    return;
  }
  registered = true;
  gsap.registerPlugin(ScrollTrigger, Flip);
}
