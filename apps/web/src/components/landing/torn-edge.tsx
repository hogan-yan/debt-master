/**
 * Sawtooth strip that makes a card look torn off a receipt roll. Shared by
 * the landing pages: receipt-paper cards tear against the page background
 * (the card's own surface color), CTA bands tear against the page in ink.
 */
export function TornEdge({ color, flip }: { readonly color: string; readonly flip?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 9,
        background: `linear-gradient(45deg, ${color} 5px, transparent 0) 0 0 / 10px 10px repeat-x, linear-gradient(-45deg, ${color} 5px, transparent 0) 5px 0 / 10px 10px repeat-x`,
        transform: flip ? 'rotate(180deg)' : undefined,
      }}
    />
  );
}
