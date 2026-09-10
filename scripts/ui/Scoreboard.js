// A plain DOM overlay, same shape as GameMenu.js: no framework, only
// touches the DOM in response to show()/hide()/a click. It only ever
// *reads* the outcome object gameplay.finish() produced -- it never
// reaches back into Gameplay/GameplaySession itself.
//
// outcome.score uses the generic, player-id-keyed shape every rule type
// is meant to share (see WaveRules.js/Gameplay.js): { [playerId]: {
// kills, deaths } }. Rows are keyed by entity id, not a display name --
// there's no name prop on entities yet (see WaveRules.js's own notes).
export class Scoreboard {
  constructor(root, { onRestart }) {
    this.root = root;
    this.onRestart = onRestart;

    root.addEventListener("click", (event) => {
      if (event.target.dataset.action === "restart") this.onRestart();
    });
  }

  show(outcome = {}) {
    this.root.innerHTML = this.render(outcome);
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  render({ result, wave, totalWaves, score = {} }) {
    const won = result === "victory";
    const title = won ? "Victory" : "Defeat";

    const rows = Object.entries(score)
      .map(
        ([playerId, entry]) => `
          <tr>
            <td>${playerId}</td>
            <td>${entry.kills ?? 0}</td>
            <td>${entry.deaths ?? 0}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <div class="scoreboard-panel">
        <h1 class="scoreboard-title scoreboard-title--${won ? "win" : "loss"}">${title}</h1>
        <p class="scoreboard-subtitle">Reached wave ${wave} of ${totalWaves}</p>
        <table class="scoreboard-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Kills</th>
              <th>Deaths</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <button type="button" class="btn-primary" data-action="restart">Restart</button>
      </div>
    `;
  }
}
