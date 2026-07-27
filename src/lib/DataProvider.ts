import type { FestivalDataResult } from "./festival-data";

export interface DataProvider {
  name: string;
  getFestivalData(role?: string): Promise<FestivalDataResult>;
}

export class RtdbProvider implements DataProvider {
  name = "Firebase Realtime Database";
  async getFestivalData(role: string = "public"): Promise<FestivalDataResult> {
    const { getFestivalDataFromRtdb } = await import("./event-data");
    return getFestivalDataFromRtdb(role);
  }
}

export class SheetsProvider implements DataProvider {
  name = "Google Sheets API (OAuth)";
  async getFestivalData(role: string = "public"): Promise<FestivalDataResult> {
    const { getFestivalDataFromSheets } = await import("./event-data");
    return getFestivalDataFromSheets(role);
  }
}

export class CsvProvider implements DataProvider {
  name = "Public CSV Export";
  async getFestivalData(): Promise<FestivalDataResult> {
    const { getFestivalDataFromCsv } = await import("./event-data");
    return getFestivalDataFromCsv();
  }
}
