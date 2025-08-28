import { System } from "./System.js";

export class LightSystem extends System {
  constructor() {
    super();

    this.ambientLight = { r: 10, g: 10, b: 40, a: 1 };

    this.bitmapDataMask = game.make.bitmapData(
      game.camera.width,
      game.camera.height
    );
    this.bitmapMask = game.add.sprite(0, 0, this.bitmapDataMask);
    this.bitmapMask.fixedToCamera = true;
    this.bitmapMask.blendMode = PIXI.blendModes.MULTIPLY;

    this.entities = this.entityManager.registerSystem(this, ["LightComponent"]);
    console.log(this.entities);
    this.shadowSystem = {};
    this.shadowEntities = this.entityManager.registerSystem(this.shadowSystem, [
      "ShadowComponent",
    ]);
    this.shadowComps = this.shadowEntities.map((entity) =>
      entity.getComponent("ShadowComponent")
    );
    console.log("Shadow comps", this.shadowComps);
    this.entities.forEach((entity) => {
      const lightComp = entity.getComponent("LightComponent");
      // Use the position component first, save a ref inside the light component
      lightComp.position = entity.getComponent("Position");
      // If a sprite component is detected use the sprites' actual position
      if (entity.hasComponent("SpriteComponent")) {
        lightComp.position = entity.getComponent("SpriteComponent").sprite;
      }
      lightComp.sprites.forEach((sprite) => {
        const light = game.make.sprite(
          lightComp.position.x,
          lightComp.position.y,
          sprite
        );
        light.anchor.setTo(0.5, 0.5);
        light.scale.setTo(4, 4);
        light.blendMode = PIXI.blendModes.ADD;
        lightComp.lightSprites.push(light);
      });
    });
  }

  update() {
    this.bitmapDataMask.fill(
      this.ambientLight.r,
      this.ambientLight.g,
      this.ambientLight.b,
      this.ambientLight.a
    );
    // console.log(this.entities);
    this.entities.forEach((entity) => {
      // console.log(entity);
      // let position = entity.getComponent("Position");
      const lightComp = entity.getComponent("LightComponent");
      // console.log(this.entities);
      lightComp.lightSprites.forEach((light) => {
        this.bitmapDataMask.draw(
          light,
          lightComp.position.x - this.bitmapMask.x,
          lightComp.position.y - this.bitmapMask.y
        );
        this.castShadows(
          lightComp.position.x,
          lightComp.position.y,
          this.shadowComps
        );
      });
    });
    // this.drawDebugShadowPolygons();
  }

  castShadows(lightX, lightY, shadowComponents) {
    const ctx = this.bitmapDataMask.context;
    const far = 200; // shadow length

    ctx.beginPath(); // Start a single combined path

    // Add all rear-edge quads to the path
    shadowComponents.forEach((comp) => {
      comp.updateWorldPolygon();
      const verts = comp.worldPolygon.points;
      if (!verts || verts.length < 2) return;

      const rearEdges = [];
      for (let i = 0; i < verts.length; i++) {
        const v1 = verts[i];
        const v2 = verts[(i + 1) % verts.length];

        const ex = v2.x - v1.x;
        const ey = v2.y - v1.y;
        const nx = -ey;
        const ny = ex;

        const mx = (v1.x + v2.x) / 2 - lightX;
        const my = (v1.y + v2.y) / 2 - lightY;

        if (nx * mx + ny * my < 0) rearEdges.push([v1, v2]);
      }

      rearEdges.forEach(([v1, v2]) => {
        const dx1 =
          (v1.x - lightX) /
          Math.sqrt((v1.x - lightX) ** 2 + (v1.y - lightY) ** 2);
        const dy1 =
          (v1.y - lightY) /
          Math.sqrt((v1.x - lightX) ** 2 + (v1.y - lightY) ** 2);
        const dx2 =
          (v2.x - lightX) /
          Math.sqrt((v2.x - lightX) ** 2 + (v2.y - lightY) ** 2);
        const dy2 =
          (v2.y - lightY) /
          Math.sqrt((v2.x - lightX) ** 2 + (v2.y - lightY) ** 2);

        const v1p = { x: v1.x + dx1 * far, y: v1.y + dy1 * far };
        const v2p = { x: v2.x + dx2 * far, y: v2.y + dy2 * far };

        ctx.moveTo(v1.x - game.camera.x, v1.y - game.camera.y);
        ctx.lineTo(v2.x - game.camera.x, v2.y - game.camera.y);
        ctx.lineTo(v2p.x - game.camera.x, v2p.y - game.camera.y);
        ctx.lineTo(v1p.x - game.camera.x, v1p.y - game.camera.y);
        ctx.closePath();
      });
    });

    // Create radial gradient from light position
    const grad = ctx.createRadialGradient(
      lightX - game.camera.x, // center x
      lightY - game.camera.y, // center y
      0, // start radius
      lightX - game.camera.x, // end x
      lightY - game.camera.y, // end y
      far // end radius
    );

    grad.addColorStop(
      0,
      `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},1)`
    ); // fully opaque at the light
    grad.addColorStop(
      0.3,
      `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},1)`
    ); // fully opaque at the light
    grad.addColorStop(
      0.9,
      `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},0)`
    ); // fully opaque at the light
    grad.addColorStop(
      1,
      `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},0)`
    ); // fully opaque at the light
    // grad.addColorStop(0.3, "rgba(0,0,0,1)"); // fully opaque at the light
    // grad.addColorStop(0.9, "rgba(0,0,0,0)"); // fully opaque at the light
    // grad.addColorStop(1, "rgba(0,0,0,0)"); // fully transparent at far edge
    // ctx.save();
    // ctx.globalCompositeOperation = "darken";
    ctx.fillStyle = grad;
    ctx.fill();
    // ctx.restore();

    this.bitmapDataMask.dirty = true;
  }

  // castShadows(lightX, lightY, shadowComponents) {
  //   const ctx = this.bitmapDataMask.context;
  //   const far = 200; // shadow length

  //   ctx.beginPath(); // Start a single combined path

  //   shadowComponents.forEach((comp) => {
  //     comp.updateWorldPolygon();
  //     const verts = comp.worldPolygon.points;
  //     if (!verts || verts.length < 2) return;

  //     // Identify rear edges (same as before)
  //     const rearEdges = [];
  //     for (let i = 0; i < verts.length; i++) {
  //       const v1 = verts[i];
  //       const v2 = verts[(i + 1) % verts.length];

  //       const ex = v2.x - v1.x;
  //       const ey = v2.y - v1.y;
  //       const nx = -ey;
  //       const ny = ex;

  //       const mx = (v1.x + v2.x) / 2 - lightX;
  //       const my = (v1.y + v2.y) / 2 - lightY;

  //       if (nx * mx + ny * my < 0) rearEdges.push([v1, v2]);
  //     }

  //     // Add all rear-edge quads to the path
  //     rearEdges.forEach(([v1, v2]) => {
  //       // Project vertices
  //       const dx1 =
  //         (v1.x - lightX) /
  //         Math.sqrt((v1.x - lightX) ** 2 + (v1.y - lightY) ** 2);
  //       const dy1 =
  //         (v1.y - lightY) /
  //         Math.sqrt((v1.x - lightX) ** 2 + (v1.y - lightY) ** 2);
  //       const dx2 =
  //         (v2.x - lightX) /
  //         Math.sqrt((v2.x - lightX) ** 2 + (v2.y - lightY) ** 2);
  //       const dy2 =
  //         (v2.y - lightY) /
  //         Math.sqrt((v2.x - lightX) ** 2 + (v2.y - lightY) ** 2);

  //       const v1p = { x: v1.x + dx1 * far, y: v1.y + dy1 * far };
  //       const v2p = { x: v2.x + dx2 * far, y: v2.y + dy2 * far };

  //       ctx.moveTo(v1.x - game.camera.x, v1.y - game.camera.y);
  //       ctx.lineTo(v2.x - game.camera.x, v2.y - game.camera.y);
  //       ctx.lineTo(v2p.x - game.camera.x, v2p.y - game.camera.y);
  //       ctx.lineTo(v1p.x - game.camera.x, v1p.y - game.camera.y);
  //       ctx.closePath();
  //     });
  //   });

  //   // Fill once with gradient
  //   const grad = ctx.createLinearGradient(lightX, lightY, lightX, lightY + far);
  //   grad.addColorStop(0, "rgba(0,0,0,.6)");
  //   grad.addColorStop(1, "rgba(0,0,0,0)");
  //   ctx.fillStyle = grad;
  //   ctx.fill();

  //   this.bitmapDataMask.dirty = true;
  // }

  drawDebugShadowPolygons() {
    let ctx = this.bitmapDataMask.context;

    this.shadowComps.forEach((comp) => {
      // Make sure the component’s polygon is in world space
      comp.updateWorldPolygon();

      let verts = comp.worldPolygon.points;
      if (!verts || verts.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(verts[0].x - game.camera.x, verts[0].y - game.camera.y);

      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x - game.camera.x, verts[i].y - game.camera.y);
      }

      ctx.closePath();

      // Fill bright color so you can *see* the shape
      ctx.fillStyle = "rgba(0, 255, 0, 0.6)";
      ctx.fill();

      // Optionally draw outline to debug vertex order
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}
