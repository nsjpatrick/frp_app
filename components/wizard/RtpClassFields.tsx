'use client';

import { useEffect, useState } from 'react';

/**
 * RtpClassFields — the ASME RTP-1 Class + revision inputs.
 *
 * Only renders when the rep has selected "ASME RTP-1 Vessel" as the tank
 * type. For every other product family, RTP-1 isn't on the table, so the
 * controls disappear from the form to reduce noise and prevent the save
 * action from capturing an irrelevant class assignment.
 *
 * Wired to the `tank-type:changed` custom event fired by `TankTypeSelect`.
 * Initial visibility is derived from the server-rendered `initialTankType`
 * so the fields don't flash on mount when a rep reloads a quote that was
 * already set to an RTP-1 product.
 */
export function RtpClassFields({
  initialTankType,
  initialClass,
  initialRevision,
}: {
  initialTankType: string | undefined;
  initialClass: string | '';
  initialRevision: string;
}) {
  const [tankType, setTankType] = useState<string>(initialTankType ?? '');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tankType: string }>).detail;
      if (detail?.tankType) setTankType(detail.tankType);
    };
    window.addEventListener('tank-type:changed', handler);
    return () => window.removeEventListener('tank-type:changed', handler);
  }, []);

  if (tankType !== 'asme_rtp1_vessel') {
    // Keep the hidden fields in the form so save-step submits `null` for
    // asmeRtp1Class rather than silently dropping the field. Revision
    // defaults to its standard string.
    return (
      <>
        <input type="hidden" name="asmeRtp1Class" value="" />
        <input type="hidden" name="asmeRtp1StdRevision" value={initialRevision || 'RTP-1:2019'} />
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 items-start">
      <div>
        <label className="glass-label" htmlFor="asmeRtp1Class">ASME RTP-1 class</label>
        <select
          id="asmeRtp1Class"
          name="asmeRtp1Class"
          defaultValue={initialClass}
          className="glass-input"
        >
          <option value="">— None —</option>
          <option value="I">Class I</option>
          <option value="II">Class II</option>
          <option value="III">Class III</option>
        </select>
      </div>
      <div>
        <label className="glass-label" htmlFor="asmeRtp1StdRevision">RTP-1 revision</label>
        <input
          id="asmeRtp1StdRevision"
          name="asmeRtp1StdRevision"
          defaultValue={initialRevision || 'RTP-1:2019'}
          className="glass-input"
        />
      </div>
    </div>
  );
}
