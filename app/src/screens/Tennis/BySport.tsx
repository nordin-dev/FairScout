import type { ReactNode } from 'react';
import { SportSwitch } from '../../components/SportSwitch';
import { useSport } from '../../lib/store';

/** A section that exists for both sports: the sport switch on top, then the screen of the chosen sport. */
export function BySport({ football, tennis }: { football: ReactNode; tennis: ReactNode }) {
  const sport = useSport();
  return (
    <>
      <SportSwitch />
      {sport === 'tennis' ? tennis : football}
    </>
  );
}
