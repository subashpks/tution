import type { CSSProperties } from 'react';
import { Brain, Clock3, IndianRupee, Landmark, MessageCircle, Package, Table2 } from 'lucide-react';

/**
 * The "magic box" hero. Five tool tiles float in, collapse into one square
 * app card, and the card rises while the headline swaps. The whole sequence
 * is pure CSS (one keyframe timeline per element) so it runs once, holds its
 * end frame, and collapses to the final state under reduced motion.
 */
const TILES = [
  { Icon: MessageCircle, label: 'WhatsApp', sx: '-112px', sy: '-58px', sr: '-8deg', d: '0s' },
  { Icon: Table2, label: 'Excel', sx: '100px', sy: '-80px', sr: '6deg', d: '0.08s' },
  { Icon: Brain, label: 'Your head', sx: '-4px', sy: '-112px', sr: '3deg', d: '0.16s' },
  { Icon: Landmark, label: 'Tally', sx: '-118px', sy: '64px', sr: '5deg', d: '0.24s' },
  { Icon: Package, label: 'Godown', sx: '106px', sy: '74px', sr: '-5deg', d: '0.32s' },
];

export function MagicBoxHero() {
  return (
    <div className="hero">
      <div className="hero-stage" aria-hidden="true">
        <div className="hero-halo" />
        <div className="hero-app">
          <span className="mark">M</span>
          <div className="hero-app-name">Meena's Academy</div>
          <div className="hero-row">
            <Clock3 size={12} strokeWidth={1.8} />
            5:30 pm · Maths
          </div>
          <div className="hero-row">
            <IndianRupee size={12} strokeWidth={1.8} />
            ₹2,000 · Paid
          </div>
        </div>
        {TILES.map(({ Icon, label, sx, sy, sr, d }) => (
          <div
            key={label}
            className="hero-tile"
            style={{ '--sx': sx, '--sy': sy, '--sr': sr, animationDelay: d } as CSSProperties}
          >
            <div className="hero-tile-inner">
              <Icon size={20} strokeWidth={1.6} />
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hero-title">
        <h1 className="page-title hero-title-a">Tally. Excel. WhatsApp. Your head.</h1>
        <h1 className="page-title hero-title-b" aria-hidden="true">
          One app. Made for you.
        </h1>
      </div>
      <p className="lead">
        Today's classes, who came, and what is due. Parents get a WhatsApp message and one link — no
        app to install.
      </p>
    </div>
  );
}
