/**
 * Shared sizing for list-page toolbar controls.
 *
 * Search box, filter dropdowns and toolbar buttons sit on the same row, so
 * they must resolve to the same height. They previously set it three
 * different ways — `py-1` on the search wrapper, `py-2` on the buttons and
 * `h-10` on the Radix select trigger — which rendered three slightly
 * different heights. Every control now takes its height from CONTROL_HEIGHT
 * instead of padding, so they line up regardless of their inner content.
 *
 * Matches the Alternative Staff Template list, which is the reference layout.
 */

/** 40px — one height for every toolbar control. */
export const CONTROL_HEIGHT = "h-10";

/** Search box and filter dropdowns: fixed width on desktop, full on mobile. */
export const CONTROL_WIDTH = "w-full sm:w-[320px]";

/** Buttons hug their label rather than taking a fixed width. */
export const CONTROL_BUTTON =
  `inline-flex ${CONTROL_HEIGHT} w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`;
