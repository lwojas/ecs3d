export class MotionShipComponent {
  constructor() {
    this.state = "IDLE";
    this.transitions = {
      IDLE: {
        right: () => {
          this.state = "RIGHT";
        },
        left: () => {
          this.state = "LEFT";
        },
        up: () => {
          this.state = "UP";
        },
        down: () => {
          this.state = "DOWN";
        },
      },
      RIGHT: {
        rightOff: () => {
          this.state = "IDLE";
        },
        left: () => {
          this.state = "LEFT";
        },
        up: () => {
          this.state = "UP";
        },
        down: () => {
          this.state = "DOWN";
        },
      },
      LEFT: {
        leftOff: () => {
          this.state = "IDLE";
        },
        right: () => {
          this.state = "RIGHT";
        },

        up: () => {
          this.state = "UP";
        },
        down: () => {
          this.state = "DOWN";
        },
      },
      DOWN: {
        downOff: () => {
          this.state = "IDLE";
        },
        right: () => {
          this.state = "RIGHT";
        },
        left: () => {
          this.state = "LEFT";
        },
        up: () => {
          this.state = "UP";
        },
      },
      UP: {
        upOff: () => {
          this.state = "IDLE";
        },
        right: () => {
          this.state = "RIGHT";
        },
        left: () => {
          this.state = "LEFT";
        },

        down: () => {
          this.state = "DOWN";
        },
      },
    };
  }
}
