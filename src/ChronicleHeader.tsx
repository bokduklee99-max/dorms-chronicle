import type {ReactNode} from 'react';

export function ChronicleHeader({children, hidden}: {children: ReactNode; hidden?: boolean}) {
 return <header className="chronicle-header" hidden={hidden}>
  <a className="chronicle-brand" href="/">DoRms' Chronicle<span aria-hidden="true">✳</span></a>
  <nav className="chronicle-header-menu" aria-label="주요 메뉴">{children}</nav>
 </header>;
}
