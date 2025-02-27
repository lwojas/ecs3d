export class Position {
  constructor(entity, data) {
    this.x = data.x;
    this.y = data.y;
  }
}

export class Velocity {
  constructor(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }
}
