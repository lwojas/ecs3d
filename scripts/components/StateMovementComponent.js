export class StateMovementComponent {
  constructor() {
    this.state = "IDLE";
    this.transitions = {
      IDLE: {
        right: () => {
          this.state = "RIGHT";
          console.log("Right key is firing", this.state);
        },
        left: () => {
          this.state = "LEFT";
          console.log("Right key is firing", this.state);
        },
        up: () => {
          this.state = "UP";
          console.log("Right key is firing", this.state);
        },
        down: () => {
          this.state = "DOWN";
          console.log("Right key is firing", this.state);
        },
      },
      RIGHT: {
        rightOff: () => {
          this.state = "IDLE";
          console.log("Right key is firing", this.state);
        },
        left: () => {
          this.state = "LEFT";
          console.log("Right key is firing", this.state);
        },
        up: () => {
          this.state = "UP";
          console.log("Right key is firing", this.state);
        },
        down: () => {
          this.state = "DOWN";
          console.log("Right key is firing", this.state);
        },
      },
      LEFT: {
        leftOff: () => {
          this.state = "IDLE";
          console.log("Right key is firing", this.state);
        },
        right: () => {
          this.state = "RIGHT";
          console.log("Right key is firing", this.state);
        },

        up: () => {
          this.state = "UP";
          console.log("Right key is firing", this.state);
        },
        down: () => {
          this.state = "DOWN";
          console.log("Right key is firing", this.state);
        },
      },
      DOWN: {
        downOff: () => {
          this.state = "IDLE";
          console.log("Right key is firing", this.state);
        },
        right: () => {
          this.state = "RIGHT";
          console.log("Right key is firing", this.state);
        },
        left: () => {
          this.state = "LEFT";
          console.log("Right key is firing", this.state);
        },
        up: () => {
          this.state = "UP";
          console.log("Right key is firing", this.state);
        },
      },
      UP: {
        upOff: () => {
          this.state = "IDLE";
          console.log("Right key is firing", this.state);
        },
        right: () => {
          this.state = "RIGHT";
          console.log("Right key is firing", this.state);
        },
        left: () => {
          this.state = "LEFT";
          console.log("Right key is firing", this.state);
        },

        down: () => {
          this.state = "DOWN";
          console.log("Right key is firing", this.state);
        },
      },
    };
  }
}
