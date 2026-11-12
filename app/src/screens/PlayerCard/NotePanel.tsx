import { DetailBlock } from '../../components/DetailBlock';
import { Sheet } from '../../components/Sheet';
import { shortNote } from '../../lib/similar';
import { player as t } from '../../lib/text.en';
import type { Player } from '../../lib/types';

/** The note of the card: at most two sentences, labelled by who wrote it. Not drawn without a note. */
export function NotePanel({ p }: { p: Player }) {
  const text = shortNote(p.note);
  if (!text) return null;
  const model = p.note_source === 'model';
  return (
    <Sheet>
      <p className="label">{model ? t.noteLabelModel : t.noteLabelSummary}</p>
      <p className="say">{text}</p>
      <DetailBlock>
        <p className="caption d-note">{model ? t.noteDetailModel : t.noteDetailTemplate}</p>
      </DetailBlock>
    </Sheet>
  );
}
