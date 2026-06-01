export class NPCMotionComponent {
  constructor() {
    this.state = "IDLE";
    this.transitions = {
      IDLE: {
        attack: () => {
          this.state = "ATTACK";
        },
        pursue: () => {
          this.state = "PURSUE";
        },
      },
      PURSUE: {
        attack: () => {
          this.state = "ATTACK";
        },
        idle: () => {
          this.state = "IDLE";
        },
      },
      ATTACK: {
        idle: () => {
          this.state = "IDLE";
        },
        pursue: () => {
          this.state = "PURSUE";
        },
      },
    };
  }
}
