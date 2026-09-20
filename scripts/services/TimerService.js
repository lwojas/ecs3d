export function timerDelay(ms, callback) {
  return game.time.events.add(ms, callback);
}

export function timerCancel(timer) {
  game.time.events.remove(timer);
}
