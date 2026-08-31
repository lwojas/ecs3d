// PersistentHUD.js

export default class PersistentHUD {
  constructor(game, parent) {
    this.game = game;

    const bottomPosition = game.camera.height - 64;
    const rightPosition = game.camera.width - 128;

    this.healthBG = game.add.sprite(48, bottomPosition - 8, "pixelWhite");
    this.healthBG.width = 128;
    this.healthBG.height = 32;
    this.group = game.add.group();
    this.group.add(this.healthBG);
    parent.add(this.group);
    // this.healthBG.tint = 0;

    this.healthText = game.add.text(64, bottomPosition, "HP 100", {
      font: "16px monospace",
    });

    // const newPadding = new Phaser.Point(32, 8);

    // this.healthText.padding.setTo(64, 16);

    // console.log(this.healthText);

    this.ammoBG = game.add.sprite(
      rightPosition - 8,
      bottomPosition - 8,
      "pixelWhite",
    );
    this.ammoBG.width = 128;
    this.ammoBG.height = 32;
    this.group.add(this.ammoBG);

    this.ammoText = game.add.text(rightPosition, bottomPosition, "AMMO 0 / 0", {
      font: "16px monospace",
    });

    this.objectiveText = game.add.text(16, 64, "", {
      font: "14px monospace",
    });

    this.group.add(this.healthText);
    this.group.add(this.ammoText);
    this.group.add(this.objectiveText);
  }

  setHealth(value) {
    this.healthText.text = "HP " + value;
  }

  setAmmo(current, reserve) {
    this.ammoText.text = "AMMO " + current + " / " + reserve;
  }

  setObjective(text) {
    this.objectiveText.text = text || "";
  }
}
