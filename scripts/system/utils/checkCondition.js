export function checkCondition(sourceEntity, targetEntity) {
  // const game = ServiceLocator.get("game");
  // const inputSystem = ServiceLocator.get("inputSystem");
  const player = targetEntity;
  console.log("Checking condition");

  let conditions = sourceEntity.getComponent(
    "CheckConditionComponent"
  ).conditions;

  // for (let condition of conditions) {s
  for (let i = 0; i < conditions.length; i++) {
    //  console.log(sourceEntity);
    let inputComponent;
    switch (conditions[i].type) {
      case "keyPress":
        inputComponent = sourceEntity.getComponent("InputComponent");
        console.log(inputComponent.keyCode, conditions[i].key);
        if (!inputComponent.keyPressed) {
          return false; // Key not pressed
        }
        if (inputComponent.keyCode !== conditions[i].key) {
          return false;
        }
        break;

      case "inventoryCheck":
        if (
          !player
            .getComponent("InventoryComponent")
            ?.hasItem(conditions[i].item)
        ) {
          return false; // Required item not in inventory
        }
        break;
    }
  }
  return true; // All conditions met
}
