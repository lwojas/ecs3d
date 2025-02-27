export class CheckConditionComponent {
  constructor(entity, conditions = []) {
    this.entity = entity;
    console.log(conditions);
    this.conditions = conditions.conditions; // List of conditions to check
  }

  isMet(sourceEntity, targetEntity) {
    // const game = ServiceLocator.get("game");
    // const inputSystem = ServiceLocator.get("inputSystem");
    const player = targetEntity;
    console.log("Checking condition");

    // for (let condition of this.conditions) {
    for (let i = 0; i < this.conditions.length; i++) {
      //  console.log(sourceEntity);
      let key;
      switch (this.conditions[i].type) {
        case "keyPress":
          key = sourceEntity.getComponent("InputComponent");
          //   console.log(key, sourceEntity);
          if (!key.keyPressed) {
            return false; // Key not pressed
          }
          break;

        case "inventoryCheck":
          if (
            !player
              .getComponent("InventoryComponent")
              ?.hasItem(this.conditions[i].item)
          ) {
            return false; // Required item not in inventory
          }
          break;
      }
    }
    return true; // All conditions met
  }
}
