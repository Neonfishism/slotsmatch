import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS, TEAMS, ROLES } from '../src/worlds/data.js';
import { roleScore, evaluateTeam } from '../src/worlds/engine.js';

test('displayed overall rating uses the same native-position evaluation as lineup selection', () => {
  for (const player of PLAYERS) {
    assert.equal(player.rating, Math.round(roleScore(player, player.role)), `${player.id}: displayed overall rating must agree with the lineup evaluation`);
  }
});

test('one to three recorded games cannot establish an elite overall rating from team results', () => {
  const shortSamples = PLAYERS.filter(player => player.sourceStats.games <= 3);
  assert(shortSamples.length > 0, 'the data must retain actual substitute appearances');
  for (const player of shortSamples) {
    assert(player.rating < 90, `${player.id}: ${player.sourceStats.games} games must shrink toward the positional prior rather than inherit elite team strength`);
  }
});

test('historical opponents use the same team rating scale as a drafted actual roster', () => {
  assert(TEAMS.length >= 80, 'the comparison must cover every supported tournament and stage');
  for (const team of TEAMS) {
    const players = PLAYERS.filter(player => player.teamId === team.id)
      .sort((a, b) => b.sourceStats.games - a.sourceStats.games || a.id.localeCompare(b.id));
    const lineup = Object.fromEntries(ROLES.map(role => [role.id, players.find(player => player.role === role.id)]));
    assert(Object.values(lineup).every(Boolean), `${team.id}: the historical roster must cover all five positions`);
    const starters = new Set(Object.values(lineup));
    lineup.bench = players.find(player => !starters.has(player)) ?? null;
    assert.equal(team.rating, evaluateTeam(lineup).rating, `${team.id}: historical and drafted versions of the same roster must have identical strength`);
  }
});

test('player profiles retain differentiated strengths instead of perfect all-round attributes', () => {
  for (const player of PLAYERS) {
    const values = Object.values(player.stats);
    assert(!values.every(value => value >= 95), `${player.id}: all six attributes must not be elite at once`);
    assert(values.filter(value => value === 99).length < 5, `${player.id}: at least two attributes must remain below the maximum`);
  }
});
