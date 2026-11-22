import { Fragment } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Shows exactly the text that will be sent, with the link made tappable. */
export function MessagePreview({ text }: { text: string }) {
  return (
    <div className="message-preview" aria-label="Message preview">
      {text.split('\n').map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line.split(URL_PATTERN).map((part, partIndex) =>
            part.match(/^https?:\/\//) ? (
              <a key={partIndex} className="link" href={part} target="_blank" rel="noreferrer">
                {part}
              </a>
            ) : (
              <Fragment key={partIndex}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </div>
  );
}
