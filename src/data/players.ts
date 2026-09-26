import type { PlayersData } from "../types/types";
import data from "./players.json" with { type: "json" };

/*
 * South Van player totals scraped from VMSL's goal scorer and MVP pages by
 * `npm run scrape:vmsl`. Like fixtures.json this is written by the scraper, so
 * import from here rather than from the .json file.
 */
export const playersData = data as PlayersData;
