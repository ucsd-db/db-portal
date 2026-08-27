"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/icon";

/** Search pill in the top app bar. Shown only where a page listens for it (admin Forms). */
export default function HeaderSearch() {
  const path = usePathname();
  if (path !== "/admin/forms") return null;
  return (
    <div className="relative mx-auto w-full max-w-[720px]">
      <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--g-grey-600)" }}><Icon name="search" /></span>
      <input placeholder="Search forms" aria-label="Search forms"
        onChange={(e) => window.dispatchEvent(new CustomEvent("portal-search", { detail: e.target.value }))}
        className="w-full rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:bg-white focus:shadow-md"
        style={{ background: "var(--g-grey-100)" }} />
    </div>
  );
}
