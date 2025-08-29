import { System } from "./System.js";

export class LightSystem extends System {
  constructor() {
    super();

    this.ambientLight = { r: 10, g: 10, b: 40, a: 1 };

    this.beamAngle = Math.PI / 2;

    this.bitmapDataMask = game.make.bitmapData(
      game.camera.width,
      game.camera.height
    );
    this.bitmapMask = game.add.sprite(0, 0, this.bitmapDataMask);
    this.bitmapMask.fixedToCamera = true;
    this.bitmapMask.blendMode = PIXI.blendModes.MULTIPLY;

    this.lightBuffer = document.createElement("canvas");
    this.lightBuffer.width = game.camera.width;
    this.lightBuffer.height = game.camera.height;
    this.lightBufferCtx = this.lightBuffer.getContext("2d");

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
          sprite.sprite
        );
        light.anchor.setTo(0.5, 0.5);
        light.scale.setTo(sprite.scale, sprite.scale);
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
      const sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(this.entities);
      if (sprite) lightComp.rotation = sprite.rotation;
      this.renderLight(lightComp, this.shadowComps);
      // lightComp.lightSprites.forEach((light) => {
      //   if (sprite) {
      //     light.rotation = sprite.rotation;
      //   }
      //   this.renderLight(lightComp, this.shadowComps);
      //   // this.bitmapDataMask.draw(
      //   //   light,
      //   //   lightComp.position.x - this.bitmapMask.x,
      //   //   lightComp.position.y - this.bitmapMask.y
      //   // );
      //   // // this.castShadows(lightComp, this.shadowComps);
      //   // if (lightComp.castShadows) {
      //   //   this.castShadows(lightComp, this.shadowComps, light.rotation);
      //   // }
      // });
    });
    // this.drawDebugShadowPolygons();
  }

  renderLight(lightComp, occluders) {
    const buf = this.lightBuffer;
    const ctx = this.lightBufferCtx;
    const far = lightComp.radius || 200;
    const lx = lightComp.position.x;
    const ly = lightComp.position.y;
    const x = lx - game.camera.x;
    const y = ly - game.camera.y;

    // clear buffer for this light
    ctx.clearRect(0, 0, buf.width, buf.height);

    // === 1. Draw the light cone/circle ===
    ctx.save();
    // ctx.globalCompositeOperation = "lighter"; // additive blending
    ctx.beginPath();

    if (lightComp.isSpot) {
      const rot = lightComp.rotation || 0;
      const half = (lightComp.angle || Math.PI / 3) / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(rot - half) * far,
        y + Math.sin(rot - half) * far
      );
      ctx.arc(x, y, far, rot - half, rot + half);
      ctx.closePath();
    } else {
      ctx.arc(x, y, far, 0, Math.PI * 2);
    }

    // For point lights, radial gradient works well
    let grad;
    grad = ctx.createRadialGradient(x, y, 0, x, y, far);
    grad.addColorStop(
      0,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},1)`
    );
    grad.addColorStop(
      1,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0)`
    );

    // TEMP: solid color (debug)
    // ctx.fillStyle = "rgba(0,255,255,0.3)";
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // === 2. Occlusion pass (projected shadows) ===
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();

    // Collect all occluder projections into one path
    occluders.forEach((comp) => {
      comp.updateWorldPolygon();
      const verts = comp.worldPolygon.points;
      if (!verts || verts.length === 0) return;

      // Find rear edges like before, then project them
      for (let i = 0; i < verts.length; i++) {
        const v1 = verts[i];
        const v2 = verts[(i + 1) % verts.length];

        // --- edge normal test to find rear edges ---
        const ex = v2.x - v1.x;
        const ey = v2.y - v1.y;
        const nx = -ey;
        const ny = ex;
        const mx = (v1.x + v2.x) / 2 - lightComp.position.x;
        const my = (v1.y + v2.y) / 2 - lightComp.position.y;
        if (nx * mx + ny * my >= 0) continue;

        // --- project edge vertices away from light ---
        const dx1 = v1.x - lightComp.position.x;
        const dy1 = v1.y - lightComp.position.y;
        const dx2 = v2.x - lightComp.position.x;
        const dy2 = v2.y - lightComp.position.y;
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);

        const v1p = {
          x: v1.x + (dx1 / len1) * far,
          y: v1.y + (dy1 / len1) * far,
        };
        const v2p = {
          x: v2.x + (dx2 / len2) * far,
          y: v2.y + (dy2 / len2) * far,
        };

        // --- add one continuous quad path ---
        ctx.moveTo(v1.x - game.camera.x, v1.y - game.camera.y);
        ctx.lineTo(v2.x - game.camera.x, v2.y - game.camera.y);
        ctx.lineTo(v2p.x - game.camera.x, v2p.y - game.camera.y);
        ctx.lineTo(v1p.x - game.camera.x, v1p.y - game.camera.y);
        ctx.closePath();
      }
    });

    // Fill once
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const glowRadius = far * 1.5; // slightly larger than main light
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glowGrad.addColorStop(
      0,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0.3)`
    );
    glowGrad.addColorStop(
      1,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0)`
    );

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.bitmapDataMask.context.save();
    this.bitmapDataMask.context.globalCompositeOperation = "lighter"; // additive
    this.bitmapDataMask.context.drawImage(buf, 0, 0);
    this.bitmapDataMask.context.restore();
  }

  // renderLight(lightComp, occluders) {
  //   const ctx = this.bitmapDataMask.context;
  //   const far = lightComp.radius || 200;
  //   const x = lightComp.position.x - game.camera.x;
  //   const y = lightComp.position.y - game.camera.y;

  //   ctx.save();
  //   ctx.globalCompositeOperation = "source-over"; // additive light blending
  //   ctx.beginPath();

  //   if (lightComp.isSpot) {
  //     // Cone shape
  //     const rot = lightComp.rotation || 0;
  //     const half = (lightComp.angle || Math.PI / 3) / 2;
  //     ctx.moveTo(x, y);
  //     ctx.lineTo(
  //       x + Math.cos(rot - half) * far,
  //       y + Math.sin(rot - half) * far
  //     );
  //     ctx.arc(x, y, far, rot - half, rot + half);
  //     ctx.closePath();
  //   } else {
  //     // Point light = circle
  //     ctx.arc(x, y, far, 0, Math.PI * 2);
  //   }
  //   ctx.fillStyle = "rgba(0,255,255,0.5)";
  //   ctx.fill();
  //   // ctx.restore();
  //   // Clip against occluders
  //   // ctx.save();
  //   // ctx.clip();

  //   occluders.forEach((comp) => {
  //     comp.updateWorldPolygon();
  //     const verts = comp.worldPolygon.points;
  //     if (!verts || verts.length === 0) return;
  //     ctx.globalCompositeOperation = "destination-out";
  //     ctx.beginPath();
  //     ctx.moveTo(verts[0].x - game.camera.x, verts[0].y - game.camera.y);
  //     for (let i = 1; i < verts.length; i++) {
  //       ctx.lineTo(verts[i].x - game.camera.x, verts[i].y - game.camera.y);
  //     }
  //     ctx.closePath();
  //     ctx.fill();
  //   });

  //   ctx.restore();

  //   // Gradient for the light
  //   let grad;
  //   if (lightComp.isSpot) {
  //     grad = ctx.createRadialGradient(x, y, 0, x, y, far);
  //   } else {
  //     grad = ctx.createRadialGradient(x, y, 0, x, y, far);
  //   }
  //   grad.addColorStop(
  //     0,
  //     `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},1)`
  //   );
  //   grad.addColorStop(
  //     1,
  //     `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0)`
  //   );

  //   // ctx.fillStyle = grad;
  //   // ctx.fill();
  //   // ctx.restore();
  // }

  withinCone(px, py, lx, ly, dirX, dirY, halfAngle) {
    const vx = px - lx;
    const vy = py - ly;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len === 0) return true; // at the light source
    const dot = (vx / len) * dirX + (vy / len) * dirY;
    // dot = cos(angle between)
    return dot >= Math.cos(halfAngle);
  }

  castShadows(lightComp, shadowComponents, rotation) {
    const lightX = lightComp.position.x;
    const lightY = lightComp.position.y;
    const ctx = this.bitmapDataMask.context;
    // const far = 400; // shadow length
    const far = lightComp.distance;

    const dirX = Math.cos(rotation);
    const dirY = Math.sin(rotation);
    const halfAngle = this.beamAngle / 4;

    // ctx.imageSmoothingEnabled = false;

    // ctx.save();
    // ctx.globalCompositeOperation = "destination-out";
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

        if (
          lightComp.isSpot &&
          !this.withinCone(v1.x, v1.y, lightX, lightY, dirX, dirY, halfAngle) &&
          !this.withinCone(v2.x, v2.y, lightX, lightY, dirX, dirY, halfAngle)
        ) {
          continue;
        }

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
    // ctx.fillStyle = "rgba(10,10,40,1)";

    // ctx.fill("evenodd");

    // ctx.restore();

    // ctx.save();
    // ctx.globalCompositeOperation = "overlay"; // draw normally

    // Create radial gradient from light position
    const grad = ctx.createRadialGradient(
      lightX - game.camera.x, // center x
      lightY - game.camera.y, // center y
      0, // start radius
      lightX - game.camera.x, // end x
      lightY - game.camera.y, // end y
      far // end radius
    );

    grad.addColorStop(0, "rgba(0,0,0,1)"); // fully transparent at far edge
    grad.addColorStop(0.4, "rgba(0,0,0,1)"); // fully transparent at far edge
    // grad.addColorStop(
    //   0,
    //   `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},1)`
    // ); // fully opaque at the light
    // grad.addColorStop(
    //   0.3,
    //   `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},0)`
    // ); // fully opaque at the light
    // grad.addColorStop(
    //   0.9,
    //   `rgba(${this.ambientLight.r},${this.ambientLight.g},${this.ambientLight.b},1)`
    // ); // fully opaque at the light
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
    ctx.restore();

    this.bitmapDataMask.dirty = true;
  }

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
