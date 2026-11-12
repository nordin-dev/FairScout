import type { KeyboardEvent, ReactNode } from 'react';
import './DataTable.css';

export type Column<R> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Keeps the header for screen readers only (a column of buttons needs no visible title). */
  hideHeader?: boolean;
  /** The cell content; `index` is the row's position in `rows`, from 0. */
  cell: (row: R, index: number) => ReactNode;
};

type Props<R> = {
  columns: readonly Column<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** The accessible name of the table. */
  label: string;
  /** Makes each row focusable; a click or Enter runs it. */
  onRowAction?: (row: R) => void;
};

/** A plain table with column headers. With `onRowAction` every row is a keyboard target. */
export function DataTable<R>({ columns, rows, rowKey, label, onRowAction }: Props<R>) {
  const keyDown = (e: KeyboardEvent, row: R) => {
    if (e.key === 'Enter' && e.target === e.currentTarget && onRowAction) onRowAction(row);
  };
  return (
    <table className="dtable" aria-label={label}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={c.align === 'right' ? 'r' : undefined}>
              {c.hideHeader ? <span className="vh">{c.header}</span> : c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey(row)}
            className={onRowAction ? 'go' : undefined}
            tabIndex={onRowAction ? 0 : undefined}
            onClick={onRowAction ? () => onRowAction(row) : undefined}
            onKeyDown={onRowAction ? (e) => keyDown(e, row) : undefined}
          >
            {columns.map((c) => (
              <td key={c.key} className={c.align === 'right' ? 'r' : undefined}>
                {c.cell(row, i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
