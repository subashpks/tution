import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function AppBar({
  title,
  sub,
  back = false,
  right,
}: {
  title: string;
  sub?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`appbar${scrolled ? ' scrolled' : ''}`}>
      {back ? (
        <button className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={22} strokeWidth={1.5} />
        </button>
      ) : null}
      <div className="grow">
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {right}
    </header>
  );
}
