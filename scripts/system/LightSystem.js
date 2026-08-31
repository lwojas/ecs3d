import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class LightSystem extends System {
  constructor(renderer) {
    super();
    this.entities = this.entityManager.registerSystem(this, ["LightComponent"]);
    this.lightList = resolveComponentList("LightComponent", this.entities);
    this.renderLightList = renderer.lights;
  }

  update() {
    const len = this.lightList.length;
    for (let i = 0; i < len; i++) {
      const light = this.lightList[i];
      if (light.enabled) {
        this.renderLightList.push(light);
      }
    }
  }

  // Called by EventRouter's "lights.set" route -- resolves ids against
  // this system's own entity/light lists, same as everything else here.
  setLights({ on = [], off = [] } = {}) {
    const setEnabled = (id, enabled) => {
      const index = this.entities.findIndex((entity) => entity.id === id);
      if (index !== -1) this.lightList[index].enabled = enabled;
    };

    on.forEach((id) => setEnabled(id, true));
    off.forEach((id) => setEnabled(id, false));
  }
}
