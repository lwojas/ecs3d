export function checkCondition(sourceEntity, targetEntity) {
  // const game = ServiceLocator.get("game");
  // const inputSystem = ServiceLocator.get("inputSystem");
  const player = targetEntity;
  console.log("Checking condition");

  let conditions = sourceEntity.getComponent(
    "CheckConditionComponent"
  ).conditions;

  // console.log(conditions);

  // for (let condition of conditions) {s
  for (let i = 0; i < conditions.length; i++) {
    //  console.log(sourceEntity);
    let inputComponent;
    switch (conditions[i].type) {
      case "keyPress":
        inputComponent = sourceEntity.getComponent("InputComponent");
        // console.log(inputComponent.keyCode, conditions[i].key);
        if (!inputComponent?.keyPressed) {
          console.log("Key not pressed", conditions[i].key);
          return false; // Key not pressed
        }
        if (inputComponent.keyCode !== conditions[i].key) {
          console.log("Wrong keycode");
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
  console.log("All conditions met");
  return true; // All conditions met
}
