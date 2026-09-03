"use client";

import { rotateJoinCode } from "../actions";

export default function RotateCode() {
  return (
    <form
      action={rotateJoinCode}
      className="inline"
      onSubmit={(e) => {
        if (!confirm("Rotate the join code? Anyone with the old code (or old shared form links) will no longer be auto-joined — current members are unaffected.")) e.preventDefault();
      }}
    >
      <button className="text-xs text-slate-500 underline">rotate</button>
    </form>
  );
}
