export function resolveComponent(componentName, entity) {
  const component = entity.getComponent(componentName);
  if (component) {
    return component;
  } else {
    console.log("Component not found: " + componentName);
  }
}

export function resolveComponentList(componentName, entityList) {
  const componentList = entityList.map((entity) => {
    const component = entity.getComponent(componentName);
    return component;
  });
  return componentList;
}
