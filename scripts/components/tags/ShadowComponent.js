import { getBoundingRadius } from "../../system/utils/getBoundingRadius.js";
import { subdividePolygon } from "../../system/utils/subDividePoly.js";
import { tracePolygonFromAlpha } from "../../system/utils/tracePoly.js";

export class ShadowComponent {
  constructor(entity, data, polygon = null) {
    const position = entity.getComponent("Position");
    this.sprite = game.make.sprite(position.x, position.y, data.sprite);
    this.sprite.scale.setTo(data.scale || 1, data.scale || 1);
    this.origin = {
      x: position.x + this.sprite.width / 2,
      y: position.y + this.sprite.height / 2,
    };
    this.entity = entity;
    this.complex = data.complex || false;
    this.boundingRadius = getBoundingRadius(
      this.sprite.width,
      this.sprite.height
    );

    // Choose polygon complexity
    if (!polygon) {
      if (data.complex) {
        polygon = this.buildComplexPolygon(data.sprite);
      } else {
        polygon = this.buildSimplePolygon();
      }
    }

    // this.localPolygon = polygon; // local (sprite space)
    this.localPolygon = subdividePolygon(polygon);
    this.worldPolygon = new Phaser.Polygon(); // updated each frame
  }

  buildSimplePolygon() {
    return new Phaser.Polygon([
      new Phaser.Point(0, 0),
      new Phaser.Point(this.sprite.width, 0),
      new Phaser.Point(this.sprite.width, this.sprite.height),
      new Phaser.Point(0, this.sprite.height),
    ]);
  }

  buildComplexPolygon(spriteKey) {
    const img = game.cache.getImage(spriteKey);

    // Draw to canvas to read alpha
    const temp = document.createElement("canvas");
    temp.width = img.width;
    temp.height = img.height;
    const ctx = temp.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const traced = tracePolygonFromAlpha(imageData, 255, true);
    // `traced` should return an array of {x, y}

    return new Phaser.Polygon(traced.map((p) => new Phaser.Point(p.x, p.y)));
  }

  updateWorldPolygon() {
    this.worldPolygon.setTo([]);
    this.localPolygon.points.forEach((p) => {
      // Transform local → world
      let worldX =
        this.sprite.world.x + p.x - this.sprite.anchor.x * this.sprite.width;
      let worldY =
        this.sprite.world.y + p.y - this.sprite.anchor.y * this.sprite.height;
      this.worldPolygon.points.push(new Phaser.Point(worldX, worldY));
    });
  }
}
