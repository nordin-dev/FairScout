import { useEffect } from 'react';
import { Link, Outlet, useLocation, createHashRouter, redirect, RouterProvider, type RouteObject } from 'react-router-dom';
import { Tooltip } from './components/Tooltip';
import './components/Frame.css';
import { DataProvider, useData } from './lib/data';
import { money } from './lib/format';
import { useKeys } from './lib/keys';
import { reloadAt } from './lib/reload';
import { readDefaultBrief } from './lib/brief';
import { activeSection } from './lib/sections';
import { setDefaultBrief, setDefaultBudget, toggleDetails, useBudget, useDetails, useOrigin } from './lib/store';
import { frame } from './lib/text.en';
import type { MetaFile } from './lib/types';
import { screenRoutes } from './routes';

function TopBar() {
  const details = useDetails();
  const budget = useBudget();
  const { pathname } = useLocation();
  const active = activeSection(pathname, useOrigin(), frame.sections.map((s) => s.path));
  return (
    <header className="top">
      <div className="wrap">
        <div className="brand">
          <b>{frame.brand}</b>
        </div>
        <nav className="steps" aria-label={frame.sectionsLabel}>
          {frame.sections.map((s) => (
            <Link key={s.path} to={s.path} aria-current={active === s.path ? 'page' : undefined}>
              <i>{s.number}</i>
              {s.name}
            </Link>
          ))}
        </nav>
        <div className="tools">
          <button className="chip" type="button" aria-pressed={details} data-tip={frame.detailsTip} onClick={toggleDetails}>
            {frame.detailsLabel} <b>{details ? frame.detailsOn : frame.detailsOff}</b>
          </button>
          <span className="chip">{frame.budgetChip(money(budget))}</span>
        </div>
      </div>
    </header>
  );
}

/** The source line, composed from the fields of meta.json. */
export function sourceLine(meta: MetaFile): string {
  return [
    `${frame.sourceLabel}: ${meta.source}`,
    frame.leagues(meta.leagues),
    frame.seasons(meta.seasons),
    frame.built(meta.built.slice(0, 10)),
  ].join(' · ');
}

function Footer() {
  const state = useData();
  return (
    <footer className="foot">
      <div className="wrap">{state.status === 'ready' ? sourceLine(state.data.meta) : null}</div>
    </footer>
  );
}

/** Installs the keyboard and takes the default budget and brief from meta.json once it has loaded. */
function FrameEffects() {
  const state = useData();
  useKeys();
  const defaultBrief = state.status === 'ready' ? state.data.meta.default_brief : null;
  useEffect(() => {
    if (!defaultBrief) return;
    setDefaultBudget(defaultBrief.budget_eur);
    setDefaultBrief(readDefaultBrief(defaultBrief));
  }, [defaultBrief]);
  return null;
}

/** Every change of route starts at the top of the page. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Frame() {
  return (
    <DataProvider>
      <FrameEffects />
      <ScrollToTop />
      <TopBar />
      <main className="wrap">
        <Outlet />
      </main>
      <Footer />
      <Tooltip />
    </DataProvider>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <h1>{frame.notFoundTitle}</h1>
      <Link to="/blind">{frame.notFoundLink}</Link>
    </div>
  );
}

/** Shown inside the frame when a screen throws while it is drawn: the header and the other screens stay usable. */
function ScreenError() {
  return (
    <div className="not-found screen-error" role="alert">
      <h1>{frame.screenErrorTitle}</h1>
      <p>{frame.screenErrorBody}</p>
      <a
        href="#/blind"
        onClick={(event) => {
          event.preventDefault();
          reloadAt('#/blind');
        }}
      >
        {frame.screenErrorLink}
      </a>
    </div>
  );
}

/**
 * The whole route tree: the frame, the start redirect, the section screens, the catch-all. The screens sit
 * under a route without a path whose only job is the error screen, so that a screen that throws is replaced
 * inside the frame instead of taking the whole app down.
 */
export const frameRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Frame />,
    children: [
      {
        errorElement: <ScreenError />,
        children: [{ index: true, loader: () => redirect('/blind') }, ...screenRoutes, { path: '*', element: <NotFound /> }],
      },
    ],
  },
];

const router = createHashRouter(frameRoutes);

export function App() {
  return <RouterProvider router={router} />;
}
