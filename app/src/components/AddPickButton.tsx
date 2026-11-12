import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { addPick, isSaved, removePick, useAccount, type SavedPick } from '../lib/account';
import { frame } from '../lib/text.en';
import './AddPickButton.css';

type Props = Omit<SavedPick, 'added'> & {
  /** A short button for table rows: a sign with the full words as its accessible name. */
  compact?: boolean;
};

/** Adds a player to the signed-in scout's picks, or removes him again. Signed out, it leads to the login. */
export function AddPickButton({ compact = false, ...pick }: Props) {
  const account = useAccount();
  const navigate = useNavigate();
  const saved = isSaved(account, pick.sport, pick.id);
  const words = !account ? frame.picks.loginToSave : saved ? frame.picks.saved : frame.picks.add;
  const click = (event: MouseEvent) => {
    event.stopPropagation();
    if (!account) navigate('/account');
    else if (saved) removePick(pick.sport, pick.id);
    else addPick(pick);
  };
  return (
    <button
      type="button"
      className={`add-pick${saved ? ' on' : ''}${compact ? ' compact' : ''}`}
      aria-pressed={account ? saved : undefined}
      aria-label={compact ? frame.picks.label(words, pick.name) : undefined}
      title={compact ? words : undefined}
      onClick={click}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {compact ? (saved ? frame.picks.savedSign : frame.picks.addSign) : words}
    </button>
  );
}
