import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="signin">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>Meena's Academy</div>
          <div className="tiny">Home tuition, kept calm</div>
        </div>
      </div>
      <div className="stack">
        <h1 className="page-title">This page has moved on.</h1>
        <p className="lead">
          The link may be old, or the page was never here. Your classes, fees and messages are all one tap away.
        </p>
        <Link className="btn" to="/">
          Go to the academy
        </Link>
        <Link className="btn secondary" to="/signin">
          Sign in
        </Link>
      </div>
    </div>
  );
}
