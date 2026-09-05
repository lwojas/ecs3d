import { runtimeBindings } from "../../tools/runtimeBindings.js";
import { audioData } from "./audioData.js";

export class AudioAPI {
  constructor(options = {}) {
    this.game = game;

    this.runtimeBindings = runtimeBindings;

    this.userId = options.userId ?? null;

    this.masterVolume = options.masterVolume ?? 1;

    this.sounds = new Map();

    this.register(audioData);
  }

  /**
   * Register and initialise all sound definitions.
   *
   * Audio assets are expected to already exist in
   * the Phaser cache.
   */
  register(data) {
    for (const definition of data) {
      const sound = {
        ...definition,

        volume: definition.volume ?? 1,

        loop: definition.loop ?? false,

        pool: definition.pool ?? false,

        poolSize: definition.poolSize ?? 1,

        instances: [],
      };

      /*
       * Pre-create the configured pool.
       *
       * Non-pooled sounds don't need an instance until
       * they are actually played.
       */
      if (sound.pool) {
        for (let i = 0; i < sound.poolSize; i++) {
          sound.instances.push(this.createSound(sound));
        }
      }

      this.sounds.set(sound.name, sound);
    }
  }

  /**
   * Create one Phaser Sound.
   */
  createSound(definition) {
    const sound = this.game.add.audio(
      definition.key,
      definition.volume * this.masterVolume,
      definition.loop,
    );

    /*
     * The pool itself handles simultaneous playback,
     * so allowMultiple isn't required.
     */
    sound.allowMultiple = false;

    return sound;
  }

  /**
   * Play a sound.
   *
   * Non-spatial:
   *
   * audio.play("pistol");
   *
   * Spatial:
   *
   * audio.play("explosion", {
   *   x: entity.x,
   *   y: entity.y
   * });
   */
  play(name, options = {}) {
    const definition = this.sounds.get(name);

    // console.log("Playing sound:", definition);

    if (!definition) {
      return null;
    }

    let volume = definition.volume * this.masterVolume;

    /*
     * Spatial sounds are only processed when a world
     * position was supplied.
     */
    if (
      definition.spatial &&
      definition.maxDistance > 0 &&
      options.x !== undefined &&
      options.y !== undefined
    ) {
      const listener = this.getListener(options.userId);

      if (listener) {
        const attenuation = this.getDistanceVolume(
          options.x,
          options.y,
          listener,
          definition.maxDistance,
          definition.rolloff ?? 1,
        );

        /*
         * Outside the audible radius.
         */
        if (attenuation <= 0) {
          return null;
        }

        volume *= attenuation;
      }
    }

    /*
     * Optional per-play volume multiplier.
     */
    if (options.volume !== undefined) {
      volume *= options.volume;
    }

    const sound = definition.pool
      ? this.getPooledSound(definition)
      : this.createSound(definition);

    if (!sound) {
      return null;
    }

    /*
     * If every pooled instance is currently playing,
     * reuse the first one.
     */
    if (sound.isPlaying) {
      sound.stop();
    }

    sound.volume = volume;

    if (options.loop !== undefined) {
      sound.loop = options.loop;
    } else {
      sound.loop = definition.loop;
    }

    sound.play();

    return sound;
  }

  /**
   * Find an available pooled Sound.
   *
   * No allocation occurs here.
   */
  getPooledSound(definition) {
    for (const sound of definition.instances) {
      if (!sound.isPlaying) {
        return sound;
      }
    }

    /*
     * Pool exhausted.
     *
     * Reuse the first sound.
     */
    return definition.instances[0] ?? null;
  }

  /**
   * Stop all instances of a sound.
   */
  stop(name) {
    const definition = this.sounds.get(name);

    if (!definition) {
      return;
    }

    for (const sound of definition.instances) {
      if (sound.isPlaying) {
        sound.stop();
      }
    }
  }

  /**
   * Stop every pooled sound.
   */
  stopAll() {
    for (const definition of this.sounds.values()) {
      for (const sound of definition.instances) {
        if (sound.isPlaying) {
          sound.stop();
        }
      }
    }
  }

  /**
   * Cheap spatial attenuation.
   *
   * Returns 0..1.
   */
  getDistanceVolume(x, y, listener, maxDistance, rolloff = 1) {
    const dx = x - listener.x;

    const dy = y - listener.y;

    const distanceSquared = dx * dx + dy * dy;

    const maxDistanceSquared = maxDistance * maxDistance;

    /*
     * Cheap culling before sqrt.
     */
    if (distanceSquared >= maxDistanceSquared) {
      return 0;
    }

    const distance = Math.sqrt(distanceSquared);

    const normalised = distance / maxDistance;

    return Math.pow(1 - normalised, rolloff);
  }

  /**
   * Resolve the current audio listener.
   */
  getListener(userId = this.userId) {
    if (!this.runtimeBindings || !userId) {
      return null;
    }

    const bindings = this.runtimeBindings.get(userId);

    if (!bindings) {
      return null;
    }

    /*
     * Player is the preferred listener.
     * Camera provides a fallback.
     */
    const source = bindings.boundPlayer ?? bindings.boundCamera;

    if (!source) {
      return null;
    }

    /*
     * Direct x/y.
     */
    if (typeof source.x === "number" && typeof source.y === "number") {
      return source;
    }

    /*
     * position.x/y.
     */
    if (
      source.position &&
      typeof source.position.x === "number" &&
      typeof source.position.y === "number"
    ) {
      return source.position;
    }

    /*
     * movement.x/y.
     */
    if (
      source.movement &&
      typeof source.movement.x === "number" &&
      typeof source.movement.y === "number"
    ) {
      return source.movement;
    }

    return null;
  }

  /**
   * Set the default listener user.
   */
  setUser(userId) {
    this.userId = userId;
  }

  /**
   * Set the master volume.
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Check whether a sound exists.
   */
  has(name) {
    return this.sounds.has(name);
  }

  /**
   * Destroy API-owned sound instances.
   */
  destroy() {
    this.stopAll();

    for (const definition of this.sounds.values()) {
      for (const sound of definition.instances) {
        sound.destroy();
      }

      definition.instances.length = 0;
    }

    this.sounds.clear();

    this.runtimeBindings = null;
  }
}
