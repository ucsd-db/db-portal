"use client";

import { useActionState } from "react";
import { createOrg, joinOrg, type State } from "./actions";

export default function OnboardingForms() {
  const [joinState, joinAction, joining] = useActionState<State, FormData>(joinOrg, {});
  const [createState, createAction, creating] = useActionState<State, FormData>(createOrg, {});
  return (
    <div className="space-y-6">
      <form action={joinAction} className="card space-y-3">
        <h2 className="font-semibold">Join a team</h2>
        <input name="code" placeholder="Join code (e.g. 3F9A1C2B)" className="input uppercase" required />
        {joinState.error && <p className="text-sm text-red-600">{joinState.error}</p>}
        <button disabled={joining} className="btn-primary">Join</button>
      </form>
      <form action={createAction} className="card space-y-3">
        <h2 className="font-semibold">Create a team (you become admin)</h2>
        <input name="name" placeholder="Team name" className="input" required />
        {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
        <button disabled={creating} className="btn-secondary">Create</button>
      </form>
    </div>
  );
}
