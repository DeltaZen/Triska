import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { MainMenu } from "./main-menu.js";
import { renderCat } from "./graphics.js";

class Trail {
  constructor(player) {
    this.startTime = Date.now();
    this.x = player.x;
    this.y = player.y;
    this.direction = player.direction || 1;
    this.rotation = player.rotation;
  }

  get alpha() {
    return (
      0.25 *
      (1 - (Date.now() - this.startTime) / 1000 / CONFIG.trailFadeDuration)
    );
  }
}

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = CONFIG.width / 2;
    this.y = 0;
    this.vY = 0;
    this.direction = 0;
    this.dead = 0;
    this.rotation = 0;

    this.power = 0;
    this.timeSinceSuperLucky = 9;
    this.superLucky = false;

    this.minY = this.y;

    this.trails = [];
  }
  cycle(elapsed) {
    let velocityX = CONFIG.velocityX;
    if (this.dead) {
      velocityX *= 0.2;
    }

    if (this.superLucky) {
      this.power -= elapsed * 0.5;
      if (this.power <= 0) {
        this.power = 0;
        this.superLucky = false;
      }

      this.timeSinceSuperLucky = 0;
    } else {
      this.timeSinceSuperLucky += elapsed;
    }

    this.x += this.direction * velocityX * elapsed;
    this.x = Math.max(CONFIG.wallX, this.x);
    this.x = Math.min(CONFIG.width - CONFIG.wallX, this.x);

    let gravity = CONFIG.gravity;
    if (this.vY < 0 && this.onWall) {
      gravity *= 4;
    } else if (this.onWall) {
      gravity *= 0.5;
    } else if (state.MOUSE_DOWN || this.superLucky) {
      gravity *= 0;
    }

    this.vY += gravity * elapsed;
    this.vY = Math.max(this.vY, -CONFIG.maxVY);

    this.y += this.vY * elapsed;
    this.y = Math.min(0, this.y);

    const shouldJump =
      !state.MENU &&
      (this.superLucky || (state.MOUSE_DOWN && !state.WAIT_FOR_RELEASE)) &&
      (this.onWall || !this.direction);
    if (shouldJump) {
      this.jump();
      state.WAIT_FOR_RELEASE = true;
    }

    if (this.onWall) {
      this.rotation = 0;
    } else {
      this.rotation += elapsed * Math.PI * 8 * this.direction;
    }

    while (this.trails.length && this.trails[0].alpha <= 0) {
      this.trails.shift();
    }

    if (!this.dead && !this.onWall && this.y !== 0) {
      if (
        !this.trails.length ||
        Date.now() - this.trails[this.trails.length - 1].startTime > 1000 / 30
      ) {
        this.trails.push(new Trail(this));
      }
    }

    for (const obstacle of state.OBSTACLES) {
      if (obstacle.collidesWithPlayer()) {
        this.die();
      }
    }

    if (this.y >= state.CAMERA.bottomY) {
      this.die();
    }

    this.minY = Math.min(this.y, this.minY);
  }

  die() {
    if (this.dead) {
      return;
    }

    this.dead = true;
    this.vY = Math.max(this.vY, 0);
    this.direction = Math.sign(CONFIG.width / 2 - this.x);

    state.CAMERA_SHAKE_END = Date.now() + CONFIG.shakeDuration * 1000;

    state.DEATHS.push({ x: this.x, y: this.y, distance: this.distance });
    setTimeout(() => (state.MENU = new MainMenu()), 1000);

    window.highscores.setScore(this.distance);
  }

  get onWall() {
    return this.x === CONFIG.wallX || this.x === CONFIG.width - CONFIG.wallX;
  }

  jump() {
    if (this.y !== 0 && !this.onWall) {
      return;
    }

    if (this.dead) {
      return;
    }

    this.direction = this.direction * -1 || 1;
    this.vY = -CONFIG.jumpVY + Math.min(this.vY, 0);
  }

  render() {
    if (!this.direction) {
      state.CTX.wrap(() => {
        state.CTX.globalAlpha = Math.max(0, (state.GAME_DURATION - 1) / 0.3);
        state.CTX.fillStyle = "#888";
        state.CTX.textBaseline = "middle";
        state.CTX.textAlign = "center";
        state.CTX.font = "24pt Courier";
        state.CTX.fillText("CLICK TO JUMP", this.x, this.y - 300);
        state.CTX.fillText("HOLD TO GO HIGHER", this.x, this.y - 250);
      });
    }

    this.trails.forEach((trail) => {
      const alpha = trail.alpha;
      if (alpha > 0) {
        this.renderPlayer(
          trail.x,
          trail.y,
          alpha,
          trail.direction,
          1,
          trail.rotation,
          false,
          false,
        );
      }
    });

    let x = this.x;
    if (this.onWall) {
      x += Math.sign(CONFIG.width / 2 - this.x) * 18;
    }

    this.renderPlayer(
      x,
      this.y,
      1,
      this.direction || 1,
      this.dead ? -1 : 1,
      this.rotation,
      this.onWall,
      this.dead,
    );
  }

  renderPlayer(x, y, alpha, scaleX, scaleY, rotation, paws, dead) {
    state.CTX.wrap(() => {
      state.CTX.translate(x, y);
      state.CTX.rotate(rotation);
      state.CTX.scale(scaleX, scaleY);
      state.CTX.globalAlpha *= Math.max(0, Math.min(1, alpha));

      renderCat(state.CTX, paws, dead);
    });
  }

  get distance() {
    return Math.round(-this.minY / CONFIG.pxPerMeter);
  }
}
