import { componentClasses } from "./ComponentClasses.js";
import { ServiceLocator } from "./ServiceLocator.js";

export function registerEvents() {
  ServiceLocator.resolve("game", "EventSystem").on(
    "G_CHANGE_SPRITE",
    changeSprite
  );
}
function changeSprite(trigger, target) {
  console.log(trigger);
  console.log(target);
  const args = trigger.getComponent("TriggerComponent").args;
  console.log(args);
  target.addComponent(
    new componentClasses["SpriteComponent"](target, args),
    target
  );
}
