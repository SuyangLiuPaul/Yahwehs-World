// A named biblical event — the layer the place index cannot produce on its own.
//
// The globe's timeline already walks 5,582 verses that name a place. What it
// cannot do is say "this is the Exodus": that arc is 397 scattered verses, and
// no free, openly licensed dataset of biblical events exists to buy the answer
// from. So events are authored, and this schema is built around the fact that
// an authored claim in a Bible product has to be checkable.
//
// Three fields carry that weight:
//   `ref`         every event names the passage it claims to be, so a reviewer
//                 can open the text and judge the boundary
//   `placeIds`    NOT authored — computed from the verse range against the
//                 OpenBible index, so the geography of an event is data even
//                 when its name is a proposal
//   `status`      nothing is 'approved' until a human says so; generated
//                 candidates stay 'candidate' no matter how confident they look

export type DateConfidence =
  /** Fixed by an external synchronism (an Assyrian eponym, a Roman consul). */
  | 'anchored'
  /** Derived from internal chronology, which assumes that chronology. */
  | 'inferred'
  /** Scholars disagree by more than the band's own width. */
  | 'disputed'
  /** The text supports no absolute date at all. Most of Genesis 1-11. */
  | 'none';

export type EventStatus = 'candidate' | 'approved' | 'edited' | 'rejected';

export interface BibleEvent {
  id: string;
  zh: string;
  en: string;
  /** Canonical book number, 1-66. */
  book: number;
  /** Inclusive canonical keys, bbbcccvvv. The timeline sorts on these. */
  start: number;
  end: number;
  ref: string;
  refZh: string;
  /** One line: what happens. Not interpretation, not application. */
  summaryZh: string;

  /** Negative years are BC. Null where the text supports no date — which is
   *  the honest answer far more often than a product usually admits. */
  yearEarly: number | null;
  yearLate: number | null;
  /** Why those numbers, or why there are none. Shown to the reader. */
  dateBasis: string;
  dateConfidence: DateConfidence;

  /** Computed from the verse range, not authored. */
  placeIds: string[];
  placeNames: string[];

  status: EventStatus;
  /** Anything the reviewer needs to decide, or decided. */
  notes: string;
}

export interface EventFile {
  meta: {
    book: number; zh: string; en: string;
    generated: string;
    /** How the candidates were produced, so a reader knows what they are. */
    provenance: string;
  };
  events: BibleEvent[];
}
