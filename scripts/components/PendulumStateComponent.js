export class PendulumStateComponent {
  constructor() {
    this.state = "FALL";
    this.transitions = {
      FALL: {
        onTap: () => {
          this.state = "MOVE";
        },
      },
      MOVE: {
        onTap: () => {
          this.state = "FALL";
          console.log("FALL state firing");
        },
      },
      // IDLE: {
      //   idle: () => {
      //     this.state = "IDLE";
      //   },
      //   pursue: () => {
      //     this.state = "PURSUE";
      //   },
      // },
    };
  }
}
