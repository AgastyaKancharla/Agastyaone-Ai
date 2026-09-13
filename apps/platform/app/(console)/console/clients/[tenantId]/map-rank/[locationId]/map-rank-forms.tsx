'use client';

import { useActionState } from 'react';
import {
  addKeyword,
  runMapScans,
  setCoordinatesManually,
  syncCoordinates,
  type MapRankState,
} from './actions';

function Feedback({ state }: { state: MapRankState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}
    </>
  );
}

export function RunScanButton({
  tenantId,
  locationId,
  disabled,
}: {
  tenantId: string;
  locationId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(runMapScans, {} as MapRankState);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <button type="submit" disabled={pending || disabled} className="btn-accent">
        {pending ? 'Queueing…' : 'Run scan'}
      </button>
      <div className="max-w-xs text-right">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function CoordinateForms({
  tenantId,
  locationId,
  latitude,
  longitude,
}: {
  tenantId: string;
  locationId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const [syncState, syncAction, syncPending] = useActionState(syncCoordinates, {} as MapRankState);
  const [manualState, manualAction, manualPending] = useActionState(
    setCoordinatesManually,
    {} as MapRankState,
  );

  return (
    <div className="space-y-4">
      <form action={syncAction} className="flex items-center gap-3 flex-wrap">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="location_id" value={locationId} />
        <button type="submit" disabled={syncPending} className="btn-secondary">
          {syncPending ? 'Asking Google…' : 'Take centre from the Google place'}
        </button>
        <Feedback state={syncState} />
      </form>

      <form action={manualAction} className="flex items-end gap-3 flex-wrap">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="location_id" value={locationId} />
        <div>
          <label htmlFor="latitude" className="label">Latitude</label>
          <input
            id="latitude"
            name="latitude"
            type="number"
            step="0.000001"
            required
            defaultValue={latitude ?? ''}
            placeholder="12.935200"
            className="input w-40"
          />
        </div>
        <div>
          <label htmlFor="longitude" className="label">Longitude</label>
          <input
            id="longitude"
            name="longitude"
            type="number"
            step="0.000001"
            required
            defaultValue={longitude ?? ''}
            placeholder="77.624500"
            className="input w-40"
          />
        </div>
        <button type="submit" disabled={manualPending} className="btn-ghost">
          {manualPending ? 'Saving…' : 'Set by hand'}
        </button>
        <Feedback state={manualState} />
      </form>
    </div>
  );
}

export function AddKeywordForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(addKeyword, {} as MapRankState);

  return (
    <form action={action} className="flex items-end gap-3 flex-wrap">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <div className="flex-1 min-w-[16rem]">
        <label htmlFor="phrase" className="label">Search phrase</label>
        <input
          id="phrase"
          name="phrase"
          type="text"
          required
          // Deliberately not "dentist near me": a "near me" query leans hardest
          // on the searcher's real GPS position, which a coordinate-anchored
          // scan reproduces least faithfully of all query types.
          placeholder="dental clinic in koramangala"
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Adding…' : 'Track phrase'}
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
