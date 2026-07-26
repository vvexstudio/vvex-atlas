// Backward compatibility wrapper forwarding calls to event-data.ts
export {
  getFestivalData,
  getFestivalDataFromRtdb,
  getFestivalDataFromSheets,
  getFestivalDataFromCsv,
  type FestivalDataResult,
  type LocationMatchDebug,
} from "./event-data";
