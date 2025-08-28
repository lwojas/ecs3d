export class ShadowComponent {
  constructor(entity, data, polygon = null) {
    const position = entity.getComponent("Position");
    this.sprite = game.make.sprite(position.x, position.y, data.sprite);
    this.sprite.scale.setTo(data.scale, data.scale);
    this.entity = entity;

    // Default polygon = rectangle matching sprite bounds
    if (!polygon) {
      polygon = new Phaser.Polygon([
        new Phaser.Point(0, 0),
        new Phaser.Point(this.sprite.width, 0),
        new Phaser.Point(this.sprite.width, this.sprite.height),
        new Phaser.Point(0, this.sprite.height),
      ]);
    }

    this.localPolygon = polygon; // local (sprite space)
    this.worldPolygon = new Phaser.Polygon(); // updated each frame
  }

  updateWorldPolygon() {
    this.worldPolygon.setTo([]);
    this.localPolygon.points.forEach((p) => {
      // Transform from local → world coords
      let worldX =
        this.sprite.world.x + p.x - this.sprite.anchor.x * this.sprite.width;
      let worldY =
        this.sprite.world.y + p.y - this.sprite.anchor.y * this.sprite.height;
      this.worldPolygon.points.push(new Phaser.Point(worldX, worldY));
    });
  }
}
