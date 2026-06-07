export function getPatrolActions() {
  return {
    default: {
      points: [
        { x: 50, y: 50 },
        { x: game?.world?.width / 2, y: game?.world?.height / 2 },
        { x: game?.world?.width, y: 0 },
        { x: game.world.width - 50, y: game.world.height - 50 },
        { x: game?.world?.width / 2, y: game?.world?.height / 2 },
        { x: 50, y: game.world.height - 50 },
      ],
    },
  };
}
