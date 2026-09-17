/**
 * One set of tool-button styles for the designer chrome.
 *
 * DesignerToolbar, RouteColorButton and FormationMenu used to each carry a
 * private copy of `btnBase/inactive/active`, so restyling the active state in
 * one place shipped two different "pressed" looks in the same 208px column.
 *
 * Active state is a 2px primary bar down the left edge plus a tint under
 * CHALK text — deliberately not `text-primary`: green text reads as a link,
 * not as a pressed tool. Destructive modes (Remove Route / Remove Zone) get
 * the same shape in amber, and ONLY while armed; at rest they look like any
 * other tool. `stadium` amber is reserved for ambient use by the token rules,
 * so warning states use Tailwind's amber, as they already did.
 */
export function toolbarClasses(vertical: boolean) {
  const btnBase = `relative flex items-center rounded-lg transition-colors duration-150 motion-reduce:transition-none shrink-0${
    vertical ? '' : ' tap-target'
  }`;
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/5';
  // The left indicator bar. `relative` lives in btnBase so the pseudo-element
  // anchors to the button.
  const bar = 'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full';
  const active = vertical ? `bg-primary/15 text-chalk ${bar} before:bg-primary` : 'bg-primary/15 text-chalk';
  const activeWarn = vertical
    ? `bg-amber-500/15 text-amber-200 ${bar} before:bg-amber-400`
    : 'bg-amber-500/15 text-amber-200';
  // Full-width labeled rows in the sidebar (extra left padding clears the
  // indicator bar), compact chips in the mobile bar.
  const tool = vertical
    ? `${btnBase} w-full justify-start gap-2 pl-3 pr-2.5 py-2 text-xs font-medium`
    : `${btnBase} justify-center px-2.5 py-2 gap-1.5 text-xs font-medium`;
  const iconOnly = `${btnBase} justify-center p-2 min-w-[36px]`;
  // Section eyebrow — the sidebar's tool groups are real families (Draw /
  // Route / Edit / Players), so they get a label rather than a hairline.
  const eyebrow = 'font-label text-[10px] uppercase tracking-[0.18em] text-chalk/40 px-3 pt-3 pb-1 select-none';
  return { btnBase, inactive, active, activeWarn, tool, iconOnly, eyebrow };
}
