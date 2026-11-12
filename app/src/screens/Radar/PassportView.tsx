import { useState } from 'react';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Flag } from '../../components/Flag';
import { Meter } from '../../components/Meter';
import { Sheet } from '../../components/Sheet';
import { Tag } from '../../components/Tag';
import { money, thousands } from '../../lib/format';
import { inBudget, positionCode, showsRating } from '../../lib/radar';
import { ratingOf } from '../../lib/rating';
import { radar as t } from '../../lib/text.en';
import type { Player } from '../../lib/types';

const PAGE = 20;

type Props = {
  /** Players with Bosnian citizenship, youngest first. */
  players: readonly Player[];
  budget: number;
  onOpen: (p: Player) => void;
};

/** The second radar view: players with a Bosnian passport, inside the budget or not. */
export function PassportView({ players, budget, onOpen }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (players.length === 0) {
    return (
      <div className="sheet state-block">
        <p>{t.passportEmpty}</p>
      </div>
    );
  }
  const columns: Column<Player>[] = [
    {
      key: 'player',
      header: t.headersPassport.player,
      cell: (p) => (
        <>
          <span className="name">{p.name}</span>
          <span className="sub">{t.clubLeague(p.club, p.league_name)}</span>
        </>
      ),
    },
    { key: 'pos', header: t.headersPassport.pos, cell: (p) => <span className="num">{positionCode(p)}</span> },
    { key: 'age', header: t.headersPassport.age, align: 'right', cell: (p) => <span className="num">{p.age.toFixed(1)}</span> },
    { key: 'price', header: t.headersPassport.price, align: 'right', cell: (p) => <span className="num">{money(p.value_eur)}</span> },
    { key: 'min', header: t.headersPassport.min, align: 'right', cell: (p) => <span className="num">{thousands(p.minutes)}</span> },
    {
      key: 'ga',
      header: t.headersPassport.ga,
      align: 'right',
      cell: (p) => <span className="num">{t.goalsAssists(p.goals, p.assists)}</span>,
    },
    {
      key: 'rating',
      header: t.headersPassport.rating,
      cell: (p) =>
        showsRating(p) ? (
          <Meter label={t.ratingLabel} value={ratingOf(p)} />
        ) : (
          <Flag tip={t.flags.limitedTip}>{t.flags.limited}</Flag>
        ),
    },
    {
      key: 'forYou',
      header: t.headersPassport.forYou,
      cell: (p) => (inBudget(p, budget) ? <Tag variant="model">{t.inBudget}</Tag> : <span className="caption">{t.aboveBudget}</span>),
    },
  ];
  const shown = showAll ? players : players.slice(0, PAGE);
  return (
    <Sheet className="r-table">
      <DataTable columns={columns} rows={shown} rowKey={(p) => p.id} label={t.passportTableLabel} onRowAction={onOpen} />
      <div className="r-foot">
        <p className="caption">{t.passportShowing(shown.length, players.length)}</p>
        {shown.length < players.length ? <Button onClick={() => setShowAll(true)}>{t.showAll}</Button> : null}
      </div>
    </Sheet>
  );
}
