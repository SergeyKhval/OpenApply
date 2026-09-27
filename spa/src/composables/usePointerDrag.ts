import { onBeforeUnmount, ref, shallowRef } from "vue";

// Pixels the pointer must travel before a press becomes a drag, so a plain click still opens the job
const DRAG_THRESHOLD = 5;
// Auto-scroll kicks in within this many pixels of a scroll container's edge
const SCROLL_EDGE = 56;
const MAX_SCROLL_SPEED = 18;
// Presses on these start no drag (the card's own link is fine to drag from)
const NO_DRAG_SELECTOR = "button, input, textarea, select, [role='menuitem']";

export type LiftedItem<T> = { item: T; width: number; height: number; offsetX: number; offsetY: number };

type PendingPress<T> = { item: T; element: HTMLElement; startX: number; startY: number };

const isScrollable = (overflow: string) => overflow === "auto" || overflow === "scroll";

function findScrollParent(element: HTMLElement, axis: "x" | "y"): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (axis === "x" && isScrollable(style.overflowX) && parent.scrollWidth > parent.clientWidth) return parent;
    if (axis === "y" && isScrollable(style.overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

function edgeSpeed(position: number, start: number, end: number) {
  const speed = (distanceIntoEdge: number) =>
    Math.ceil(Math.min(distanceIntoEdge / SCROLL_EDGE, 1) * MAX_SCROLL_SPEED);
  if (position < start + SCROLL_EDGE) return -speed(start + SCROLL_EDGE - position);
  if (position > end - SCROLL_EDGE) return speed(position - (end - SCROLL_EDGE));
  return 0;
}

/**
 * Pointer-events drag: the pressed element is lifted once the pointer moves past a small
 * threshold, `lifted` + `pointer` let the caller render it under the cursor, `overTarget`
 * is whatever `hitTest` finds under the pointer. Escape, pointercancel and window blur cancel.
 */
export function usePointerDrag<T, Target extends string>({
  hitTest,
  onDrop,
}: {
  hitTest: (x: number, y: number) => Target | null;
  onDrop: (item: T, target: Target) => void;
}) {
  const lifted = shallowRef<LiftedItem<T> | null>(null);
  const pointer = ref({ x: 0, y: 0 });
  const overTarget = ref<Target | null>(null);

  let pending: PendingPress<T> | null = null;
  let horizontalScroller: HTMLElement | null = null;
  let verticalScroller: HTMLElement | null = null;
  let scrollFrame = 0;
  let bodyStyleBefore = { userSelect: "", cursor: "" };

  function onPointerDown(event: PointerEvent, item: T) {
    if (event.button !== 0 || event.pointerType === "touch" || pending || lifted.value) return;
    if ((event.target as Element | null)?.closest(NO_DRAG_SELECTOR)) return;
    pending = {
      item,
      element: event.currentTarget as HTMLElement,
      startX: event.clientX,
      startY: event.clientY,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", cancel);
  }

  function lift(press: PendingPress<T>) {
    const rect = press.element.getBoundingClientRect();
    lifted.value = {
      item: press.item,
      width: rect.width,
      height: rect.height,
      offsetX: press.startX - rect.left,
      offsetY: press.startY - rect.top,
    };
    horizontalScroller = findScrollParent(press.element, "x");
    verticalScroller = findScrollParent(press.element, "y");
    bodyStyleBefore = { userSelect: document.body.style.userSelect, cursor: document.body.style.cursor };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.getSelection()?.removeAllRanges();
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function onPointerMove(event: PointerEvent) {
    pointer.value = { x: event.clientX, y: event.clientY };
    if (!pending) return;
    if (!lifted.value) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < DRAG_THRESHOLD) return;
      lift(pending);
    }
    overTarget.value = hitTest(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent) {
    const liftedItem = lifted.value;
    const target = liftedItem ? (hitTest(event.clientX, event.clientY) ?? overTarget.value) : null;
    cancel();
    if (!liftedItem) return;
    suppressNextClick();
    if (target) onDrop(liftedItem.item, target);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (lifted.value) {
      event.preventDefault();
      event.stopPropagation();
    }
    cancel();
  }

  // The release after a drag would otherwise land as a click on whatever is under it (e.g. a card link)
  function suppressNextClick() {
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
  }

  function autoScroll() {
    const { x, y } = pointer.value;
    let scrolled = false;
    if (horizontalScroller) {
      const rect = horizontalScroller.getBoundingClientRect();
      const delta = edgeSpeed(x, rect.left, rect.right);
      if (delta) {
        horizontalScroller.scrollLeft += delta;
        scrolled = true;
      }
    }
    const verticalRect = verticalScroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    const verticalDelta = edgeSpeed(y, verticalRect.top, verticalRect.bottom);
    if (verticalDelta) {
      if (verticalScroller) verticalScroller.scrollTop += verticalDelta;
      else window.scrollBy(0, verticalDelta);
      scrolled = true;
    }
    // Lanes moved under a still pointer
    if (scrolled) overTarget.value = hitTest(x, y);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function cancel() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("blur", cancel);
    if (lifted.value) {
      cancelAnimationFrame(scrollFrame);
      document.body.style.userSelect = bodyStyleBefore.userSelect;
      document.body.style.cursor = bodyStyleBefore.cursor;
    }
    pending = null;
    lifted.value = null;
    overTarget.value = null;
    horizontalScroller = null;
    verticalScroller = null;
  }

  onBeforeUnmount(cancel);

  return { lifted, pointer, overTarget, onPointerDown, cancel };
}
