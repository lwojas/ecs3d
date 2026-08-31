// DynamicHUD.js

export default class DynamicHUD {
  constructor(game, parent) {
    this.game = game;

    this.text = game.add.text(game.width / 2, game.height / 2 - 48, "", {
      font: "32px monospace",
      align: "center",
      fill: "white",
    });

    // this.text.color = "#ffffff";

    this.text.anchor.setTo(0.5);
    this.text.alpha = 0;

    parent.add(this.text);

    this.messageId = 0;
  }

  notify(text, duration = 1500) {
    const id = ++this.messageId;

    this.text.text = text;
    this.text.alpha = 1;

    this.game.time.events.add(duration, () => {
      if (id !== this.messageId) {
        return;
      }

      this.game.add
        .tween(this.text)
        .to({ alpha: 0 }, 200, Phaser.Easing.Linear.None, true);
    });
  }
}
