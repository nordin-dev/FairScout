import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, logout, register, useAccount, type AccountError } from '../../lib/account';
import { account as t } from '../../lib/accountText';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import '../../components/SegmentSwitch.css';
import './Account.css';

type Mode = 'login' | 'register';

/** The login and registration at /account; for a signed-in scout, who he is and the way out. */
export function Account() {
  const who = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AccountError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await (mode === 'login' ? login : register)(name, password);
    setBusy(false);
    setError(result);
    if (result === null) {
      setPassword('');
      navigate('/my-picks');
    }
  };

  const choose = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{who ? t.signedIn(who.name) : t.title}</h1>
      <Sheet className="account-sheet">
        {who ? (
          <div className="account-in">
            <Link className="btn" to="/my-picks">
              {t.toPicks}
            </Link>
            <Button onClick={logout}>{t.logout}</Button>
          </div>
        ) : (
          <>
            <div className="seg-row" role="group" aria-label={t.switchLabel}>
              {(['login', 'register'] as const).map((m) => (
                <button key={m} type="button" className={mode === m ? 'seg on' : 'seg'} aria-pressed={mode === m} onClick={() => choose(m)}>
                  {m === 'login' ? t.modeLogin : t.modeRegister}
                </button>
              ))}
            </div>
            <form className="account-form" onSubmit={submit} noValidate>
              <label>
                <span>{t.nameLabel}</span>
                <input type="text" value={name} autoComplete="username" onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                <span>{t.passwordLabel}</span>
                <input
                  type="password"
                  value={password}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error ? (
                <p className="account-error" role="alert">
                  {t.errors[error]}
                </p>
              ) : null}
              <button type="submit" className="btn" disabled={busy}>
                {mode === 'login' ? t.submitLogin : t.submitRegister}
              </button>
            </form>
          </>
        )}
        <p className="caption account-caption">{t.caption}</p>
      </Sheet>
    </>
  );
}
