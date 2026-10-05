import type { PlayerStat, PlayersData } from "../types/types";

export type StatKey = "goals" | "assists" | "mvps";

/** Rows a leaders card shows. Anyone past this is only in the "View all" modal. */
export const LEADER_CARD_LIMIT = 5;

export interface Leader {
  name: string;
  value: number;
  /** 1 based, shared between players tied on the same value */
  rank: number;
}

/**
 * The top `limit` players for one stat. Players with none of it are left out,
 * and ties share a rank and are all kept, so a card never hides someone level
 * with the last place shown. Ties sort by name so the order is stable.
 */
export function leadersBy(data: PlayersData, stat: StatKey, limit = 5): Leader[] {
  const ranked = data.players
    .filter((player) => player[stat] > 0)
    .sort((a, b) => b[stat] - a[stat] || a.name.localeCompare(b.name));

  const leaders: Leader[] = [];
  let rank = 0;
  let previous: number | null = null;

  for (const [index, player] of ranked.entries()) {
    if (player[stat] !== previous) {
      rank = index + 1;
      previous = player[stat];
    }
    if (rank > limit) break;
    leaders.push({ name: player.name, value: player[stat], rank });
  }

  return leaders;
}

export interface PlayerTotals {
  goals: number;
  assists: number;
  mvps: number;
  yellows: number;
  reds: number;
}

export function totals(data: PlayersData): PlayerTotals {
  return data.players.reduce(
    (sum: PlayerTotals, player: PlayerStat) => ({
      goals: sum.goals + player.goals,
      assists: sum.assists + player.assists,
      mvps: sum.mvps + player.mvps,
      yellows: sum.yellows + player.yellows,
      reds: sum.reds + player.reds,
    }),
    { goals: 0, assists: 0, mvps: 0, yellows: 0, reds: 0 },
  );
}
