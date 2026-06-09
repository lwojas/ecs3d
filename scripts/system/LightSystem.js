import { System } from "./System.js";
import { isLightInView } from "./utils/isLightInView.js";
import { spriteLayers } from "./utils/spriteLayers.js";

export class LightSystem extends System {
  constructor() {
    super();

    this.ambientLight = { r: 10, g: 10, b: 40, a: 1 };

    this.beamAngle = Math.PI / 2;

    this.bitmapDataMask = game.make.bitmapData(
      game.camera.width,
      game.camera.height,
    );
    BasicGame.LightBuffer = this.bitmapDataMask;
    this.bitmapMask = game.add.sprite(0, 0, this.bitmapDataMask);
    this.bitmapMask.fixedToCamera = true;
    this.bitmapMask.blendMode = PIXI.blendModes.MULTIPLY;
    spriteLayers.lighting.add(this.bitmapMask);

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
      entity.getComponent("ShadowComponent"),
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
          sprite.sprite,
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
      this.ambientLight.a,
    );
    // console.log(this.entities);
    this.entities.forEach((entity) => {
      const lightComp = entity.getComponent("LightComponent");
      const sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(this.entities);
      if (!sprite?.alive) return;
      if (sprite) lightComp.rotation = sprite.rotation;
      if (isLightInView(lightComp, 50)) {
        this.renderLight(lightComp, this.shadowComps);
      }
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
        y + Math.sin(rot - half) * far,
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
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},1)`,
    );
    grad.addColorStop(
      0.3,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},.5)`,
    );
    grad.addColorStop(
      1,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0)`,
    );

    // TEMP: solid color (debug)
    // ctx.fillStyle = "rgba(0,255,255,0.3)";
    ctx.fillStyle = grad;
    ctx.filter = "blur(4px)";
    ctx.fill();

    ctx.restore();

    // === 2. Occlusion pass (projected shadows) ===
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();

    // Collect all occluder projections into one path
    occluders.forEach((comp) => {
      const dx =
        lightComp.position.x - (comp.sprite.world.x + comp.sprite.width / 2);
      const dy =
        lightComp.position.y - (comp.sprite.world.y + comp.sprite.height / 2);
      const dist = Math.hypot(dx, dy);

      // this.drawDebugCircle(
      //   this.bitmapDataMask.context,
      //   lightComp.position.x,
      //   lightComp.position.y,
      // );
      if (dist > lightComp.radius + comp.boundingRadius) return;
      // this.drawDebugLine(
      //   this.bitmapDataMask.context,
      //   comp.origin.x,
      //   comp.origin.y,
      //   lightComp.position.x,
      //   lightComp.position.y
      // );
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

        const projectionDistance = far * 4;

        const v1p = {
          x: v1.x + (dx1 / len1) * projectionDistance,
          y: v1.y + (dy1 / len1) * projectionDistance,
        };
        const v2p = {
          x: v2.x + (dx2 / len2) * projectionDistance,
          y: v2.y + (dy2 / len2) * projectionDistance,
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
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const glowRadius = far * 1.5; // slightly larger than main light
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glowGrad.addColorStop(
      0,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0.3)`,
    );
    glowGrad.addColorStop(
      1,
      `rgba(${lightComp.color.r},${lightComp.color.g},${lightComp.color.b},0)`,
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

  withinCone(px, py, lx, ly, dirX, dirY, halfAngle) {
    const vx = px - lx;
    const vy = py - ly;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len === 0) return true; // at the light source
    const dot = (vx / len) * dirX + (vy / len) * dirY;
    // dot = cos(angle between)
    return dot >= Math.cos(halfAngle);
  }

  drawDebugCircle(ctx, x, y, radius = 5, color = "red") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x - game.camera.x, y - game.camera.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawDebugLine(ctx, x1, y1, x2, y2, color = "#0df4cdff", width = 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1 - game.camera.x, y1 - game.camera.y);
    ctx.lineTo(x2 - game.camera.x, y2 - game.camera.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
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
