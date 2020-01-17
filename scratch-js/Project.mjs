import Trigger from "./Trigger.mjs";
import Renderer from "./Renderer.mjs";
import Input from "./Input.mjs";
import { Stage } from "./Sprite.mjs";

export default class Project {
  constructor(stage, sprites = []) {
    this.stage = stage;
    this._spritesAndClones = [];
    this._spritesByName = new Map();

    for (const sprite of sprites) {
      this._addTarget(sprite);
      // TODO: constructor.name sounds like a shonky function that may cause the JS engine to deoptimize this.
      // Sprites should be given a "name" property anyways;
      // some valid sprite names (that may be dynamically accessed!) are not valid JS identifiers.
      if (!sprite.name) sprite.name = sprite.constructor.name;
      this._spritesByName.set(sprite.name, sprite);
    }

    this.renderer = new Renderer(this);
    this.input = new Input(this.stage, this.renderer.stage, key => {
      this.fireTrigger(Trigger.KEY_PRESSED, { key });
    });

    this.runningTriggers = [];

    this.restartTimer();

    this.answer = null;

    this.playingSounds = [];

    this.step();
  }

  sprite(spriteName) {
    return this._spritesByName.get(spriteName);
  }

  _addTarget(target, position) {
    target._project = this;

    if (position) {
      this._spritesAndClones.splice(position, 0, target);
    } else {
      this._spritesAndClones.push(target);
    }
  }

  _removeTarget(target) {
    this._project.runningTriggers = this._project.runningTriggers.filter(
      ({ triggerTarget }) => triggerTarget !== target
    );

    const index = this._spritesAndClones.indexOf(target);
    this._spritesAndClones.splice(index, 1);
  }

  attach(renderTarget) {
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.stage.addEventListener("click", () => {
      const wasClicked = sprite => {
        if (sprite instanceof Stage) {
          return true;
        }

        return this.renderer.checkPointCollision(
          sprite,
          {
            x: this.input.mouse.x,
            y: this.input.mouse.y
          },
          false
        );
      };

      let matchingTriggers = [];
      for (let i = 0; i < this.spritesAndStage.length; i++) {
        const sprite = this.spritesAndStage[i];
        const spriteClickedTriggers = sprite.triggers.filter(tr =>
          tr.matches(Trigger.CLICKED, {})
        );
        if (spriteClickedTriggers.length > 0) {
          if (wasClicked(sprite)) {
            matchingTriggers = [
              ...matchingTriggers,
              ...spriteClickedTriggers.map(trigger => ({
                trigger,
                target: sprite
              }))
            ];
          }
        }
      }

      this._startTriggers(matchingTriggers);
    });
  }

  greenFlag() {
    this.fireTrigger(Trigger.GREEN_FLAG);
    this.input.focus();
  }

  step() {
    // Step all triggers
    const alreadyRunningTriggers = this.runningTriggers;
    for (let i = 0; i < alreadyRunningTriggers.length; i++) {
      alreadyRunningTriggers[i].trigger.step();
    }

    // Remove finished triggers
    this.runningTriggers = this.runningTriggers.filter(
      ({ trigger }) => !trigger.done
    );

    this.renderer.update(this.stage, this._spritesAndClones);

    window.requestAnimationFrame(this.step.bind(this));
  }

  fireTrigger(trigger, options) {
    // Special trigger behaviors
    if (trigger === Trigger.GREEN_FLAG) {
      this.restartTimer();
      this.stopAllSounds();
      this.runningTriggers = [];

      for (const spriteName in this.sprites) {
        const sprite = this.sprites[spriteName];
        for (const clone of sprite.clones) {
          clone.deleteThisClone();
        }
      }

      for (const sprite of this.spritesAndStage) {
        sprite.effects.clear();
      }
    }

    // Find triggers which match conditions
    let matchingTriggers = [];
    for (let i = 0; i < this.spritesAndStage.length; i++) {
      const sprite = this.spritesAndStage[i];
      const spriteTriggers = sprite.triggers.filter(tr =>
        tr.matches(trigger, options)
      );

      matchingTriggers = [
        ...matchingTriggers,
        ...spriteTriggers.map(trigger => ({ trigger, target: sprite }))
      ];
    }

    return this._startTriggers(matchingTriggers);
  }

  _startTriggers(triggers) {
    // Only add these triggers to this.runningTriggers if they're not already there.
    // TODO: if the triggers are already running, they'll be restarted but their execution order is unchanged.
    // Does that match Scratch's behavior?
    for (const trigger of triggers) {
      if (
        !this.runningTriggers.find(
          runningTrigger =>
            trigger.trigger === runningTrigger.trigger &&
            trigger.target === runningTrigger.target
        )
      ) {
        this.runningTriggers.push(trigger);
      }
    }
    return Promise.all(
      triggers.map(({ trigger, target }) => {
        return trigger.start(target);
      })
    );
  }

  get spritesAndStage() {
    return [...this._spritesAndClones, this.stage];
  }

  playSound(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);

      const sound = { audio, hasStarted: false };

      const soundEnd = () => {
        this._stopSound(sound);
        resolve();
      };
      audio.addEventListener("ended", soundEnd);
      audio.addEventListener("pause", soundEnd);
      audio.addEventListener("error", reject);

      this.playingSounds.push(sound);

      audio.play().then(() => {
        sound.hasStarted = true;
      });
    });
  }

  _stopSound(sound) {
    if (sound.hasStarted) {
      sound.audio.pause();
    } else {
      // Audio can't be paused because it hasn't started yet
      // (audio.play() is async; can't pause until play starts)
      sound.audio.addEventListener("playing", () => {
        // Stop for real ASAP
        sound.audio.pause();
      });
    }

    // Remove from playingSounds
    const index = this.playingSounds.findIndex(s => s === sound);
    if (index > -1) {
      this.playingSounds.splice(index, 1);
    }
  }

  stopAllSounds() {
    const playingSoundsCopy = this.playingSounds.slice();
    for (let i = 0; i < playingSoundsCopy.length; i++) {
      this._stopSound(playingSoundsCopy[i]);
    }
  }

  restartTimer() {
    this.timerStart = new Date();
  }

  async askAndWait(question) {
    this.answer = await this.renderer.displayAskBox(question);
  }
}
